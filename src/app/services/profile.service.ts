import { Injectable, signal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { Profile, ProfileMetadata } from '../models/profile.model';
import { isTauriAvailable } from '../core/utils/platform.util';
import { debugLog } from '../core/utils/logger.util';
import { MockProfileBackend, TauriProfileBackend } from './profile.backend';
import { ProfileBackend } from './profile.backend.interface';

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
            const names = await this.backend.scanProfiles(path);

            // Build profiles with metadata and running status
            const profiles: Profile[] = await Promise.all(
                names.map(async (name: string) => {
                    const profilePath = `${path}/${name}`;
                    const [metadata, isRunning] = await Promise.all([
                        this.getProfileMetadata(profilePath),
                        this.isProfileRunning(profilePath),
                    ]);
                    return { name, path: profilePath, metadata, isRunning };
                })
            );

            this.profiles.set(profiles);
            return profiles;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        } finally {
            this.loading.set(false);
        }
    }

    async launchChrome(profilePath: string): Promise<void> {
        try {
            await this.backend.launchBrowser({ profilePath, browser: 'chrome' });
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
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
        // Sanitize input at service level
        if (/[<>:"/\\|?*]/.test(name)) {
            throw new Error('Invalid profile name');
        }

        try {
            const newPath = await this.backend.createProfile(basePath, name);

            // Mock mode adjustment to simulate scan update if backend doesn't trigger it
            if (!isTauriAvailable()) {
                const newProfile: Profile = {
                    id: crypto.randomUUID(), // FIX: Secure ID
                    name,
                    path: newPath,
                    metadata: { emoji: null, notes: null, group: null, shortcut: null, browser: null },
                    isRunning: false,
                    size: 0,
                };
                this.profiles.update(profiles => [...profiles, newProfile]);
            } else {
                await this.scanProfiles(basePath);
            }
            return newPath;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async deleteProfile(profilePath: string, basePath: string): Promise<void> {
        try {
            await this.backend.deleteProfile(profilePath);
            if (!isTauriAvailable()) {
                this.profiles.update(profiles => profiles.filter(p => p.path !== profilePath));
            } else {
                await this.scanProfiles(basePath);
            }
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async renameProfile(oldPath: string, newName: string, basePath: string): Promise<string> {
        // Sanitize input
        if (/[<>:"/\\|?*]/.test(newName)) {
            throw new Error('Invalid new profile name');
        }

        try {
            const newPath = await this.backend.renameProfile(oldPath, newName);

            if (!isTauriAvailable()) {
                this.profiles.update(profiles =>
                    profiles.map(p => p.path === oldPath ? { ...p, name: newName, path: newPath } : p)
                );
            } else {
                await this.scanProfiles(basePath);
            }
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

        // PERF FIX: Process in chunks of 10
        const CHUNK_SIZE = 10;
        let hasChanges = false;
        const updatedMap = new Map<string, boolean>();

        for (let i = 0; i < current.length; i += CHUNK_SIZE) {
            const chunk = current.slice(i, i + CHUNK_SIZE);
            const results = await Promise.all(
                chunk.map(async (p) => {
                    const isRunning = await this.isProfileRunning(p.path);
                    return { path: p.path, isRunning };
                })
            );

            for (const r of results) {
                updatedMap.set(r.path, r.isRunning);
            }
        }

        const updated = current.map((p) => {
            const newRunning = updatedMap.get(p.path);
            if (newRunning !== undefined && p.isRunning !== newRunning) {
                hasChanges = true;
                return { ...p, isRunning: newRunning };
            }
            return p;
        });

        if (hasChanges) {
            this.profiles.set(updated);
        }
    }

    async launchBrowser(
        profilePath: string,
        browser: string,
        url?: string,
        incognito?: boolean,
        proxyServer?: string,
        customFlags?: string,
        windowPosition?: { x?: number | null; y?: number | null; width?: number | null; height?: number | null; maximized?: boolean } | null,
        disableExtensions?: boolean
    ): Promise<void> {
        try {
            // Feature 3.4: Build flags with --disable-extensions if requested
            let finalFlags = customFlags || '';
            if (disableExtensions) {
                finalFlags = finalFlags ? `${finalFlags} --disable-extensions` : '--disable-extensions';
            }

            await this.backend.launchBrowser({
                profilePath,
                browser,
                url: url || null,
                incognito: incognito || null,
                proxyServer: proxyServer || null,
                customFlags: finalFlags || null,
                windowX: windowPosition?.x ?? null,
                windowY: windowPosition?.y ?? null,
                windowWidth: windowPosition?.width ?? null,
                windowHeight: windowPosition?.height ?? null,
                windowMaximized: windowPosition?.maximized ?? null,
            });

            if (!isTauriAvailable()) {
                this.profiles.update(profiles =>
                    profiles.map(p => p.path === profilePath ? { ...p, isRunning: true } : p)
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
    }

    async duplicateProfile(sourcePath: string, newName: string, basePath: string): Promise<string> {
        // Input validation (same as createProfile/renameProfile)
        if (/[<>:"/\\|?*]/.test(newName)) {
            throw new Error('Invalid profile name');
        }

        try {
            const newPath = await this.backend.duplicateProfile(sourcePath, newName);

            if (!isTauriAvailable()) {
                const sourceProfile = this.profiles().find(p => p.path === sourcePath);
                if (sourceProfile) {
                    const newProfile: Profile = {
                        id: crypto.randomUUID(),
                        name: newName,
                        path: newPath,
                        metadata: sourceProfile.metadata ? { ...sourceProfile.metadata } : undefined,
                        isRunning: false,
                        size: sourceProfile.size,
                    };
                    this.profiles.update(profiles => [...profiles, newProfile]);
                }
            } else {
                await this.scanProfiles(basePath);
            }
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
            const result = await invoke<string>('backup_profile', {
                profilePath,
                backupPath: filePath
            });
            return result;
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
            const result = await invoke<{ successful: string[]; failed: string[]; total_size: number }>(
                'bulk_export_profiles',
                { profilePaths, destinationFolder }
            );
            return {
                successful: result.successful,
                failed: result.failed,
                totalSize: result.total_size,
            };
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
