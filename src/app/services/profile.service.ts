import { Injectable, signal } from '@angular/core';
import { save } from '@tauri-apps/plugin-dialog';
import { Profile, ProfileMetadata } from '../models/profile.model';
import { isTauriAvailable } from '../core/utils/platform.util';
import { debugLog } from '../core/utils/logger.util';
import { validateProfileName } from '../core/utils/validation.util';
import { MockProfileBackend, TauriProfileBackend } from './profile.backend';
import { CookieExportResult, CookieImportResult, LaunchBrowserOptions, ProfileBackend } from './profile.backend.interface';

@Injectable({
    providedIn: 'root',
})
export class ProfileService {
    private readonly backend: ProfileBackend;

    readonly profiles = signal<Profile[]>([]);
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

    constructor() {
        // Initialize backend based on environment
        this.backend = isTauriAvailable() ? new TauriProfileBackend() : new MockProfileBackend();
    }

    async scanProfiles(path: string): Promise<Profile[]> {
        this.loading.set(true);
        this.error.set(null);

        try {
            console.time('[PERF] scanProfiles IPC');
            const profiles = await this.backend.scanProfilesWithMetadata(path);
            console.timeEnd('[PERF] scanProfiles IPC');
            console.log(`[PERF] scanProfiles: ${profiles.length} profiles loaded`);

            console.time('[PERF] profiles.set (signal update)');
            this.profiles.set(profiles);
            console.timeEnd('[PERF] profiles.set (signal update)');

            return profiles;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        } finally {
            this.loading.set(false);
        }
    }

    async checkPathExists(path: string): Promise<boolean> {
        try {
            return await this.backend.checkPathExists(path);
        } catch {
            return false;
        }
    }

    async ensureProfilesDirectory(path: string): Promise<void> {
        try {
            await this.backend.ensureProfilesDirectory(path);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async createProfile(basePath: string, name: string): Promise<string> {
        const validationError = validateProfileName(name);
        if (validationError) {
            throw new Error(validationError);
        }

        try {
            const newPath = await this.backend.createProfile(basePath, name);

            // PERF: Incremental add — don't rescan all profiles
            const metadata = await this.getProfileMetadata(newPath);
            const newProfile: Profile = {
                name,
                path: newPath,
                metadata,
                isRunning: false,
                size: 0,
            };
            this.profiles.update(profiles => [...profiles, newProfile]);

            return newPath;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    /** Bulk create profiles with a naming pattern (e.g., Shop_001, Shop_002...) */
    async bulkCreateProfiles(
        basePath: string,
        prefix: string,
        count: number,
        startNum: number,
    ): Promise<{ created: string[]; skipped: string[]; errors: string[] }> {
        const created: string[] = [];
        const skipped: string[] = [];
        const errors: string[] = [];
        const padLength = String(startNum + count - 1).length.toString().length > 2 ? String(startNum + count - 1).length : 3;
        const newProfiles: Profile[] = [];

        for (let i = 0; i < count; i++) {
            const num = startNum + i;
            const name = `${prefix}_${String(num).padStart(padLength, '0')}`;

            // Skip if already exists
            const exists = this.profiles().some(p => p.name.toLowerCase() === name.toLowerCase());
            if (exists) {
                skipped.push(name);
                continue;
            }

            try {
                const newPath = await this.backend.createProfile(basePath, name);
                created.push(name);
                newProfiles.push({
                    name,
                    path: newPath,
                    isRunning: false,
                    size: 0,
                });
            } catch (e) {
                errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }

        // PERF: Batch-update profiles signal once
        if (newProfiles.length > 0) {
            this.profiles.update(profiles => [...profiles, ...newProfiles]);
        }

        return { created, skipped, errors };
    }

    async deleteProfile(profilePath: string, basePath: string): Promise<void> {
        try {
            await this.backend.deleteProfile(profilePath);
            // PERF: Incremental remove — don't rescan all profiles
            this.profiles.update(profiles => profiles.filter(p => p.path !== profilePath));
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async renameProfile(oldPath: string, newName: string, basePath: string): Promise<string> {
        const validationError = validateProfileName(newName);
        if (validationError) {
            throw new Error(validationError);
        }

        try {
            const newPath = await this.backend.renameProfile(oldPath, newName);

            // PERF: Incremental update — don't rescan all profiles
            const metadata = await this.getProfileMetadata(newPath);
            this.profiles.update(profiles =>
                profiles.map(p => p.path === oldPath
                    ? { ...p, name: newName, path: newPath, metadata }
                    : p
                )
            );

            return newPath;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async getProfileMetadata(profilePath: string): Promise<ProfileMetadata> {
        try {
            return await this.backend.getProfileMetadata(profilePath);
        } catch {
            return { emoji: null, notes: null, group: null, shortcut: null, browser: null };
        }
    }

    async saveProfileMetadata(
        profilePath: string,
        updates: Partial<ProfileMetadata>,
    ): Promise<void> {
        try {
            const profile = this.profiles().find(p => p.path === profilePath);
            const merged: Partial<ProfileMetadata> = {
                ...profile?.metadata,
                ...updates,
            };

            await this.backend.saveProfileMetadata(profilePath, merged);

            this.profiles.update((profiles) =>
                profiles.map((p) => {
                    if (p.path !== profilePath) return p;
                    return { ...p, metadata: { ...p.metadata, ...updates } as ProfileMetadata };
                })
            );
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async toggleFavorite(profilePath: string): Promise<void> {
        const profile = this.profiles().find(p => p.path === profilePath);
        if (!profile) return;

        await this.saveProfileMetadata(profilePath, {
            isFavorite: !profile.metadata?.isFavorite,
        });
    }

    async updateSortOrder(profilePath: string, sortOrder: number): Promise<void> {
        await this.saveProfileMetadata(profilePath, { sortOrder });
    }

    async updateUsageStats(
        profilePath: string,
        launchCount: number,
        totalUsageMinutes: number,
        lastSessionDuration: number | null = null
    ): Promise<void> {
        try {
            await this.saveProfileMetadata(profilePath, {
                launchCount,
                totalUsageMinutes,
                lastSessionDuration: lastSessionDuration ?? undefined,
            });
        } catch (e) {
            debugLog('Failed to update usage stats:', e);
        }
    }

    async isProfileRunning(profilePath: string): Promise<boolean> {
        return await this.backend.isProfileRunning(profilePath);
    }

    async refreshProfileStatus(): Promise<void> {
        const current = this.profiles();
        if (current.length === 0) return;

        console.time(`[PERF] refreshProfileStatus (${current.length} profiles)`);
        // PERF: 1 batch call instead of N individual pgrep spawns
        const allPaths = current.map(p => p.path);
        const runningMap = await this.backend.batchCheckRunning(allPaths);

        let hasChanges = false;
        const updated = current.map((p) => {
            const newRunning = runningMap[p.path] || false;
            if (p.isRunning !== newRunning) {
                hasChanges = true;
                return { ...p, isRunning: newRunning };
            }
            return p;
        });

        if (hasChanges) {
            this.profiles.set(updated);
        }
        console.timeEnd(`[PERF] refreshProfileStatus (${current.length} profiles)`);
    }

    async launchBrowser(options: LaunchBrowserOptions & { disableExtensions?: boolean }): Promise<void> {
        try {
            // Feature 3.4: Build flags with --disable-extensions if requested
            let finalFlags = options.customFlags || '';
            if (options.disableExtensions) {
                finalFlags = finalFlags ? `${finalFlags} --disable-extensions` : '--disable-extensions';
            }

            await this.backend.launchBrowser({
                profilePath: options.profilePath,
                browser: options.browser,
                url: options.url || null,
                incognito: options.incognito || null,
                proxyServer: options.proxyServer || null,
                proxyUsername: options.proxyUsername || null,
                proxyPassword: options.proxyPassword || null,
                customFlags: finalFlags || null,
                antidetectEnabled: options.antidetectEnabled || null,
            });

            if (!isTauriAvailable()) {
                this.profiles.update(profiles =>
                    profiles.map(p => p.path === options.profilePath ? { ...p, isRunning: true } : p)
                );
            }
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async getProfileSize(profilePath: string): Promise<number> {
        return await this.backend.getProfileSize(profilePath);
    }

    async listAvailableBrowsers(): Promise<string[]> {
        return await this.backend.listAvailableBrowsers();
    }

    async clearProfileCookies(profilePath: string): Promise<{ deletedCount: number; freedBytes: number; failedItems: string[] }> {
        try {
            const result = await this.backend.clearProfileCookies(profilePath);
            return {
                deletedCount: result.deleted_count,
                freedBytes: result.freed_bytes,
                failedItems: result.failed_items
            };
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async loadProfileSizes(): Promise<void> {
        const current = this.profiles();
        if (current.length === 0) return;

        console.time(`[PERF] loadProfileSizes (${current.length} profiles)`);
        const CHUNK_SIZE = 10;
        const sizeMap = new Map<string, number>();

        for (let i = 0; i < current.length; i += CHUNK_SIZE) {
            const chunk = current.slice(i, i + CHUNK_SIZE);
            const results = await Promise.all(
                chunk.map(async (p) => ({
                    path: p.path,
                    size: await this.getProfileSize(p.path).catch(() => 0),
                }))
            );
            for (const r of results) {
                sizeMap.set(r.path, r.size);
            }
        }

        let hasChanges = false;
        const updated = current.map((p) => {
            const newSize = sizeMap.get(p.path);
            if (newSize !== undefined && p.size !== newSize) {
                hasChanges = true;
                return { ...p, size: newSize };
            }
            return p;
        });

        if (hasChanges) {
            this.profiles.set(updated);
        }
        console.timeEnd(`[PERF] loadProfileSizes (${current.length} profiles)`);
    }

    async duplicateProfile(sourcePath: string, newName: string, basePath: string): Promise<string> {
        const validationError = validateProfileName(newName);
        if (validationError) {
            throw new Error(validationError);
        }

        try {
            const newPath = await this.backend.duplicateProfile(sourcePath, newName);

            // PERF: Incremental add — don't rescan all profiles
            const sourceProfile = this.profiles().find(p => p.path === sourcePath);
            const metadata = await this.getProfileMetadata(newPath);
            const newProfile: Profile = {
                name: newName,
                path: newPath,
                metadata,
                isRunning: false,
                size: sourceProfile?.size,
            };
            this.profiles.update(profiles => [...profiles, newProfile]);

            return newPath;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async backupProfile(profilePath: string): Promise<string> {
        if (!isTauriAvailable()) {
            throw new Error('Backup is only available in desktop app');
        }

        const profileName = profilePath.split('/').pop() || 'profile';
        const timestamp = new Date().toISOString().slice(0, 10);
        const defaultFileName = `${profileName}_backup_${timestamp}.zip`;

        const filePath = await save({
            title: 'Save Profile Backup',
            defaultPath: defaultFileName,
            filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
        });

        if (!filePath) {
            throw new Error('Backup cancelled');
        }

        try {
            return await this.backend.backupProfile(profilePath, filePath);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async restoreFromBackup(
        backupPath: string,
        targetBasePath: string,
        conflictAction: 'overwrite' | 'rename' | 'skip'
    ): Promise<{ success: boolean; restoredPath: string; profileName: string; wasRenamed: boolean }> {
        try {
            const result = await this.backend.restoreFromBackup(backupPath, targetBasePath, conflictAction);
            if (isTauriAvailable()) {
                await this.scanProfiles(targetBasePath);
            }
            return {
                success: result.success,
                restoredPath: result.restored_path,
                profileName: result.profile_name,
                wasRenamed: result.was_renamed,
            };
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async checkProfileHealth(profilePath: string): Promise<{
        isHealthy: boolean;
        issues: string[];
        warnings: string[];
        checkedFiles: number;
    }> {
        try {
            const result = await this.backend.checkProfileHealth(profilePath);
            return {
                isHealthy: result.is_healthy,
                issues: result.issues,
                warnings: result.warnings,
                checkedFiles: result.checked_files,
            };
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async bulkExportProfiles(profilePaths: string[]): Promise<{ successful: string[]; failed: string[]; totalSize: number }> {
        if (!isTauriAvailable()) {
            return {
                successful: profilePaths.map(p => p.split('/').pop() || 'profile'),
                failed: [],
                totalSize: 1024 * 1024 * 50,
            };
        }

        const { open } = await import('@tauri-apps/plugin-dialog');
        const destinationFolder = await open({
            title: 'Select Export Destination Folder',
            directory: true,
            multiple: false,
        });

        if (!destinationFolder) {
            throw new Error('Export cancelled');
        }

        try {
            return await this.backend.bulkExportProfiles(profilePaths, destinationFolder as string);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    // Cookie Import/Export
    async exportCookies(profilePath: string, browser?: string): Promise<CookieExportResult> {
        try {
            const result = await this.backend.exportCookies(profilePath, browser);

            if (result.cookies.length > 0 && isTauriAvailable()) {
                const profileName = profilePath.split('/').pop() || 'profile';
                const defaultFileName = `${profileName}_cookies.json`;

                const filePath = await save({
                    title: 'Export Cookies',
                    defaultPath: defaultFileName,
                    filters: [{ name: 'JSON', extensions: ['json'] }],
                });

                if (filePath) {
                    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
                    await writeTextFile(filePath, JSON.stringify(result.cookies, null, 2));
                }
            }

            return result;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async importCookies(profilePath: string, cookiesJson: string): Promise<CookieImportResult> {
        try {
            return await this.backend.importCookies(profilePath, cookiesJson);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    // Feature 4.2: Update proxy rotation state (currentProxyIndex and lastRotatedAt)
    async saveProxyRotationState(profilePath: string, newIndex: number): Promise<void> {
        const profile = this.profiles().find((p: Profile) => p.path === profilePath);
        if (!profile?.metadata?.proxyRotation) return;

        await this.saveProfileMetadata(profilePath, {
            proxyRotation: {
                ...profile.metadata.proxyRotation,
                currentProxyIndex: newIndex,
                lastRotatedAt: new Date().toISOString(),
            },
        });
    }
}
