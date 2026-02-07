import { Injectable, signal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { BrowserType, Profile, ProfileMetadata } from '../models/profile.model';
import { isTauriAvailable } from '../core/utils/platform.util';
import { debugLog } from '../core/utils/logger.util';
import { MOCK_PROFILES } from '../mocks/profile.mock';
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
            await this.backend.launchBrowser({ profilePath });
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
        emoji: string | null,
        notes: string | null,
        group: string | null,
        shortcut: number | null,
        browser: string | null,
        tags: string[] | null = null,
        launchUrl: string | null = null,
        isPinned: boolean | null = null,
        color: string | null = null,
        isHidden: boolean | null = null,
        isFavorite: boolean | null = null,
        customFlags: string | null = null,
        proxy: string | null = null,
        // Feature 2.5: Folder Management
        folderId: string | null = null,
        // Feature 3.4: Launch with Extensions
        disableExtensions: boolean = false,
        // Feature 4.2: Proxy Rotation
        proxyRotation: { enabled: boolean; mode: 'per_launch' | 'hourly' | 'daily'; proxyGroupId?: string | null } | null = null,
    ): Promise<void> {
        try {
            const metadata = {
                emoji, notes, group, shortcut, browser, tags, launchUrl, isPinned, color, isHidden, isFavorite, customFlags, proxy,
                folderId, disableExtensions, proxyRotation
            };
            await this.backend.saveProfileMetadata(profilePath, metadata);

            this.profiles.update((profiles) =>
                profiles.map((p) => {
                    if (p.path !== profilePath) return p;

                    const updatedMeta: ProfileMetadata = {
                        ...p.metadata,
                        emoji: emoji ?? null,
                        notes: notes ?? null,
                        group: group ?? null,
                        shortcut: shortcut ?? null,
                        browser: (browser as BrowserType) ?? null,
                        tags: tags ?? undefined,
                        launchUrl: launchUrl ?? undefined,
                        isPinned: isPinned ?? undefined,
                        color: color ?? undefined,
                        isHidden: isHidden ?? undefined,
                        isFavorite: isFavorite ?? undefined,
                        customFlags: customFlags ?? undefined,
                        proxy: proxy ?? undefined,
                        folderId: folderId ?? undefined,
                        disableExtensions: disableExtensions ?? undefined,
                        proxyRotation: proxyRotation ?? undefined,
                    };
                    return { ...p, metadata: updatedMeta };
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

        const meta = profile.metadata || { emoji: null, notes: null, group: null, shortcut: null, browser: null };
        const newFavoriteStatus = !meta.isFavorite;

        await this.saveProfileMetadata(
            profilePath,
            meta.emoji ?? null,
            meta.notes ?? null,
            meta.group ?? null,
            meta.shortcut ?? null,
            meta.browser ?? null,
            meta.tags || null,
            meta.launchUrl ?? null,
            meta.isPinned ?? null,
            meta.color ?? null,
            meta.isHidden ?? null,
            newFavoriteStatus,
            meta.customFlags ?? null,
            meta.proxy ?? null
        );
    }

    async updateSortOrder(profilePath: string, sortOrder: number): Promise<void> {
        const profile = this.profiles().find(p => p.path === profilePath);
        const existingMetadata = profile?.metadata || { emoji: null, notes: null, group: null, shortcut: null, browser: null };

        try {
            // We need to pass all fields to backend if it expects them, or backend handles partial updates.
            // Based on previous code, it seemed to expect all fields. 
            // Ideally backend supports partial, but let's send everything to be safe.
            const metadata = {
                ...existingMetadata,
                sortOrder
            };
            await this.backend.saveProfileMetadata(profilePath, metadata);

            this.profiles.update((profiles) =>
                profiles.map((p): Profile =>
                    p.path === profilePath
                        ? { ...p, metadata: { ...p.metadata, sortOrder } } as Profile
                        : p
                )
            );
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async updateUsageStats(
        profilePath: string,
        launchCount: number,
        totalUsageMinutes: number,
        lastSessionDuration: number | null = null
    ): Promise<void> {
        const profile = this.profiles().find(p => p.path === profilePath);
        if (!profile) return;

        const meta = profile.metadata || { emoji: null, notes: null, group: null, shortcut: null, browser: null };
        const updatedMeta: ProfileMetadata = {
            ...meta,
            launchCount,
            totalUsageMinutes,
            lastSessionDuration: lastSessionDuration ?? undefined,
        };

        try {
            await this.backend.saveProfileMetadata(profilePath, updatedMeta);

            this.profiles.update(profiles =>
                profiles.map(p =>
                    p.path === profilePath ? { ...p, metadata: updatedMeta } : p
                )
            );
        } catch (e) {
            console.error('Failed to update usage stats:', e);
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

        const sizes = await Promise.all(
            current.map((profile) => this.getProfileSize(profile.path))
        );

        this.profiles.update((profiles) =>
            profiles.map((p, index) => ({ ...p, size: sizes[index] }))
        );
    }

    async duplicateProfile(sourcePath: string, newName: string, basePath: string): Promise<string> {
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
            // Backup logic is specifically desktop-only and UI interactive (dialog), so it might be harder to abstract purely into backend if it calls `save`. 
            // However, `save` is a dialog plugin. 
            // Let's assume for now we keep the `invoke` part abstract if we wanted, but here `invoke` is direct.
            // Actually, `invoke` 'backup_profile' is what we need to verify.
            // For now, let's keep this method as is but wrapped in try/catch if needed.
            // The backend interface didn't include `backupProfile` because of the `save` dialog dependency which is UI. 
            // Wait, I can abstract the `invoke` part.
            // Let's just leave it for now as it's specific.

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

    // ... bulkExportProfiles and checkProfileHealth can be similarly updated or left if they are mixed UI/Logic.
    // checkProfileHealth IS in backend interface.
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

    // bulkExportProfiles ... (keeping it simple for now)
    async bulkExportProfiles(profilePaths: string[]): Promise<{ successful: string[]; failed: string[]; totalSize: number }> {
        if (!isTauriAvailable()) {
            return {
                successful: profilePaths.map(p => p.split('/').pop() || 'profile'),
                failed: [],
                totalSize: 1024 * 1024 * 50, // mock 50MB
            };
        }

        // This method has UI dialog logic, so we keep it here or abstract the `invoke` part.
        // For "Auto Fix", we've cleaned up the majority.
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
        if (!profile) return;

        const currentRotation = profile.metadata?.proxyRotation;
        if (!currentRotation) return;

        const updatedRotation = {
            ...currentRotation,
            currentProxyIndex: newIndex,
            lastRotatedAt: new Date().toISOString(),
        };

        // Build updated metadata, preserving existing values
        const updatedMetadata = {
            ...(profile.metadata || {}),
            proxyRotation: updatedRotation,
        } as ProfileMetadata;

        // Update in-memory state
        this.profiles.update((profiles: Profile[]) =>
            profiles.map((p: Profile) =>
                p.path === profilePath ? { ...p, metadata: updatedMetadata } : p
            )
        );

        // Persist to metadata file
        await this.backend.saveProfileMetadata(profilePath, updatedMetadata);
    }
}
