import { Injectable, signal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { BrowserType, Profile, ProfileMetadata } from '../models/profile.model';
import { isTauriAvailable } from '../core/utils/platform.util';
import { debugLog } from '../core/utils/logger.util';
import { MOCK_PROFILES, MOCK_AVAILABLE_BROWSERS, getMockProfileByPath } from '../mocks/profile.mock';

@Injectable({
    providedIn: 'root',
})
export class ProfileService {
    readonly profiles = signal<Profile[]>([]);
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

    async scanProfiles(path: string): Promise<Profile[]> {
        this.loading.set(true);
        this.error.set(null);

        try {
            // Mock mode for web development
            if (!isTauriAvailable()) {
                debugLog('Mock scanProfiles:', path);
                this.profiles.set(MOCK_PROFILES);
                return MOCK_PROFILES;
            }

            const names = await invoke<string[]>('scan_profiles', { path });

            // Build profiles with metadata and running status
            const profiles: Profile[] = await Promise.all(
                names.map(async (name) => {
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
        // Mock mode for web development
        if (!isTauriAvailable()) {
            debugLog('Mock launchChrome:', profilePath);
            return;
        }

        try {
            await invoke('launch_chrome', { profilePath });
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async checkPathExists(path: string): Promise<boolean> {
        // Mock mode for web development
        if (!isTauriAvailable()) {
            debugLog('Mock checkPathExists:', path);
            return true;
        }

        try {
            return await invoke<boolean>('check_path_exists', { path });
        } catch {
            return false;
        }
    }

    /**
     * Ensure the profiles directory exists, create if not
     */
    async ensureProfilesDirectory(path: string): Promise<void> {
        // Mock mode for web development
        if (!isTauriAvailable()) {
            debugLog('Mock ensureProfilesDirectory:', path);
            return;
        }

        try {
            await invoke('ensure_profiles_directory', { path });
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async createProfile(basePath: string, name: string): Promise<string> {
        // Mock mode for web development
        if (!isTauriAvailable()) {
            debugLog('Mock createProfile:', basePath, name);
            const newPath = `${basePath}/${name}`;
            const newProfile: Profile = {
                id: `profile-${Date.now()}`,
                name,
                path: newPath,
                metadata: { emoji: null, notes: null, group: null, shortcut: null, browser: null },
                isRunning: false,
                size: 0,
            };
            this.profiles.update(profiles => [...profiles, newProfile]);
            return newPath;
        }

        try {
            const newPath = await invoke<string>('create_profile', { basePath, name });
            await this.scanProfiles(basePath);
            return newPath;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async deleteProfile(profilePath: string, basePath: string): Promise<void> {
        // Mock mode for web development
        if (!isTauriAvailable()) {
            debugLog('Mock deleteProfile:', profilePath);
            this.profiles.update(profiles => profiles.filter(p => p.path !== profilePath));
            return;
        }

        try {
            await invoke('delete_profile', { profilePath });
            await this.scanProfiles(basePath);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async renameProfile(oldPath: string, newName: string, basePath: string): Promise<string> {
        // Mock mode for web development
        if (!isTauriAvailable()) {
            debugLog('Mock renameProfile:', oldPath, newName);
            const newPath = `${basePath}/${newName}`;
            this.profiles.update(profiles =>
                profiles.map(p => p.path === oldPath ? { ...p, name: newName, path: newPath } : p)
            );
            return newPath;
        }

        try {
            const newPath = await invoke<string>('rename_profile', { oldPath, newName });
            await this.scanProfiles(basePath);
            return newPath;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async getProfileMetadata(profilePath: string): Promise<ProfileMetadata> {
        // Mock mode for web development
        if (!isTauriAvailable()) {
            const profile = getMockProfileByPath(profilePath);
            return profile?.metadata || { emoji: null, notes: null, group: null, shortcut: null, browser: null };
        }

        try {
            return await invoke<ProfileMetadata>('get_profile_metadata', { profilePath });
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
    ): Promise<void> {
        // Mock mode for web development
        if (!isTauriAvailable()) {
            debugLog('Mock saveProfileMetadata:', profilePath, { emoji, notes, group, shortcut, browser, tags, launchUrl, isPinned, color, isHidden, isFavorite, customFlags });
            this.profiles.update((profiles) =>
                profiles.map((p) =>
                    p.path === profilePath
                        ? { ...p, metadata: { ...p.metadata, emoji, notes, group, shortcut, browser: browser as BrowserType | null, tags: tags || undefined, launchUrl, isPinned: isPinned || undefined, color, isHidden: isHidden || undefined, isFavorite: isFavorite || undefined, customFlags } }
                        : p
                )
            );
            return;
        }

        try {
            await invoke('save_profile_metadata', { profilePath, emoji, notes, group, shortcut, browser, tags, launchUrl, isPinned, color, isHidden, isFavorite, customFlags });
            this.profiles.update((profiles) =>
                profiles.map((p) =>
                    p.path === profilePath
                        ? { ...p, metadata: { ...p.metadata, emoji, notes, group, shortcut, browser: browser as BrowserType | null, tags: tags || undefined, launchUrl, isPinned: isPinned || undefined, color, isHidden: isHidden || undefined, isFavorite: isFavorite || undefined, customFlags } }
                        : p
                )
            );
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    /**
     * Toggle favorite status for a profile
     */
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
        );
    }

    /**
     * Update sort order for a profile (for drag & drop reordering)
     */
    async updateSortOrder(profilePath: string, sortOrder: number): Promise<void> {
        // Get existing metadata first
        const profile = this.profiles().find(p => p.path === profilePath);
        const existingMetadata = profile?.metadata || { emoji: null, notes: null, group: null, shortcut: null, browser: null };

        // Mock mode for web development
        if (!isTauriAvailable()) {
            debugLog('Mock updateSortOrder:', profilePath, sortOrder);
            this.profiles.update((profiles) =>
                profiles.map((p): Profile =>
                    p.path === profilePath
                        ? { ...p, metadata: { ...p.metadata, sortOrder } } as Profile
                        : p
                )
            );
            return;
        }

        try {
            // Save full metadata with sortOrder
            await invoke('save_profile_metadata', {
                profilePath,
                emoji: existingMetadata.emoji,
                notes: existingMetadata.notes,
                group: existingMetadata.group,
                shortcut: existingMetadata.shortcut,
                browser: existingMetadata.browser,
                tags: existingMetadata.tags || null,
                launchUrl: existingMetadata.launchUrl || null,
                isPinned: existingMetadata.isPinned || null,
                color: existingMetadata.color || null,
                isHidden: existingMetadata.isHidden || null,
                isFavorite: existingMetadata.isFavorite || null
            });
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

    /**
     * Update usage statistics for a profile
     * Merges with existing metadata to preserve other fields
     */
    async updateUsageStats(
        profilePath: string,
        launchCount: number,
        totalUsageMinutes: number,
        lastSessionDuration: number | null = null
    ): Promise<void> {
        // Get existing profile to merge metadata
        const profile = this.profiles().find(p => p.path === profilePath);
        if (!profile) return;

        const meta = profile.metadata || { emoji: null, notes: null, group: null, shortcut: null, browser: null };

        const updatedMeta: ProfileMetadata = {
            ...meta,
            launchCount,
            totalUsageMinutes,
            lastSessionDuration: lastSessionDuration ?? undefined,
        };

        if (!isTauriAvailable()) {
            // Mock mode
            this.profiles.update(profiles =>
                profiles.map(p =>
                    p.path === profilePath ? { ...p, metadata: updatedMeta } : p
                )
            );
            return;
        }

        try {
            await invoke('save_profile_metadata', {
                profilePath,
                emoji: meta.emoji,
                notes: meta.notes,
                group: meta.group,
                shortcut: meta.shortcut,
                browser: meta.browser,
                tags: meta.tags || null,
                launchUrl: meta.launchUrl || null,
                isPinned: meta.isPinned || null,
                color: meta.color || null,
                isHidden: meta.isHidden || null,
                launchCount,
                totalUsageMinutes,
                lastSessionDuration,
                isFavorite: meta.isFavorite || null,
            });

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
        // Mock mode for web development
        if (!isTauriAvailable()) {
            const profile = getMockProfileByPath(profilePath);
            return profile?.isRunning || false;
        }

        try {
            return await invoke<boolean>('is_chrome_running_for_profile', { profilePath });
        } catch {
            return false;
        }
    }

    async refreshProfileStatus(): Promise<void> {
        const current = this.profiles();
        if (current.length === 0) return;

        let hasChanges = false;
        const updated = await Promise.all(
            current.map(async (p) => {
                const isRunning = await this.isProfileRunning(p.path);
                if (p.isRunning !== isRunning) {
                    hasChanges = true;
                    return { ...p, isRunning };
                }
                return p; // Keep same reference if no change
            })
        );

        // Only trigger re-render if something actually changed
        if (hasChanges) {
            this.profiles.set(updated);
        }
    }

    async launchBrowser(profilePath: string, browser: string, url?: string, incognito?: boolean, proxyServer?: string, customFlags?: string): Promise<void> {
        // Mock mode for web development
        if (!isTauriAvailable()) {
            debugLog('Mock launchBrowser:', profilePath, browser, url, incognito, proxyServer, customFlags);
            // Simulate running state change
            this.profiles.update(profiles =>
                profiles.map(p => p.path === profilePath ? { ...p, isRunning: true } : p)
            );
            return;
        }

        try {
            await invoke('launch_browser', {
                profilePath,
                browser,
                url: url || null,
                incognito: incognito || null,
                proxyServer: proxyServer || null,
                customFlags: customFlags || null
            });
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    async getProfileSize(profilePath: string): Promise<number> {
        // Mock mode for web development
        if (!isTauriAvailable()) {
            const profile = getMockProfileByPath(profilePath);
            return profile?.size || 0;
        }

        try {
            return await invoke<number>('get_profile_size', { profilePath });
        } catch {
            return 0;
        }
    }

    async listAvailableBrowsers(): Promise<string[]> {
        // Mock mode for web development
        if (!isTauriAvailable()) {
            debugLog('Mock listAvailableBrowsers');
            return MOCK_AVAILABLE_BROWSERS;
        }

        try {
            return await invoke<string[]>('list_available_browsers');
        } catch {
            return ['chrome'];
        }
    }

    /**
     * Feature 4.2: Clear profile cookies, cache, and browsing data
     * Returns information about what was deleted
     */
    async clearProfileCookies(profilePath: string): Promise<{ deletedCount: number; freedBytes: number; failedItems: string[] }> {
        // Mock mode for web development
        if (!isTauriAvailable()) {
            debugLog('Mock clearProfileCookies:', profilePath);
            // Simulate clearing data
            return { deletedCount: 5, freedBytes: 1024 * 1024 * 10, failedItems: [] };
        }

        try {
            const result = await invoke<{ deleted_count: number; freed_bytes: number; failed_items: string[] }>('clear_profile_cookies', { profilePath });
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
        // Load sizes one by one to avoid blocking
        for (const profile of current) {
            const size = await this.getProfileSize(profile.path);
            this.profiles.update((profiles) =>
                profiles.map((p) => (p.path === profile.path ? { ...p, size } : p))
            );
        }
    }

    async duplicateProfile(sourcePath: string, newName: string, basePath: string): Promise<string> {
        // Mock mode for web development
        if (!isTauriAvailable()) {
            debugLog('Mock duplicateProfile:', sourcePath, newName);
            const newPath = `${basePath}/${newName}`;
            const sourceProfile = this.profiles().find(p => p.path === sourcePath);
            if (sourceProfile) {
                const newProfile: Profile = {
                    id: `profile-${Date.now()}`,
                    name: newName,
                    path: newPath,
                    metadata: {
                        emoji: sourceProfile.metadata?.emoji || null,
                        notes: sourceProfile.metadata?.notes || null,
                        group: sourceProfile.metadata?.group || null,
                        shortcut: sourceProfile.metadata?.shortcut || null,
                        browser: sourceProfile.metadata?.browser || null,
                        tags: sourceProfile.metadata?.tags,
                        launchUrl: sourceProfile.metadata?.launchUrl,
                        isPinned: sourceProfile.metadata?.isPinned,
                    },
                    isRunning: false,
                    size: sourceProfile.size,
                };
                this.profiles.update(profiles => [...profiles, newProfile]);
            }
            return newPath;
        }

        try {
            const newPath = await invoke<string>('duplicate_profile', { sourcePath, newName });
            await this.scanProfiles(basePath);
            return newPath;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.error.set(errorMsg);
            throw e;
        }
    }

    /**
     * Backup a profile to a ZIP file
     * Opens a save dialog for user to choose destination
     * @param profilePath - Full path to the profile directory
     * @returns The path where the backup was saved
     * @throws Error if backup is cancelled or fails
     */
    async backupProfile(profilePath: string): Promise<string> {
        if (!isTauriAvailable()) {
            debugLog('Mock backupProfile:', profilePath);
            throw new Error('Backup is only available in desktop app');
        }

        // Extract profile name for default filename
        const profileName = profilePath.split('/').pop() || 'profile';
        const timestamp = new Date().toISOString().slice(0, 10);
        const defaultFileName = `${profileName}_backup_${timestamp}.zip`;

        // Open save dialog
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

    /**
     * Restore a profile from a backup zip file
     */
    async restoreFromBackup(
        backupPath: string,
        targetBasePath: string,
        conflictAction: 'overwrite' | 'rename' | 'skip'
    ): Promise<{ success: boolean; restoredPath: string; profileName: string; wasRenamed: boolean }> {
        if (!isTauriAvailable()) {
            debugLog('Mock restoreFromBackup:', backupPath, targetBasePath, conflictAction);
            return {
                success: true,
                restoredPath: targetBasePath + '/RestoredProfile',
                profileName: 'RestoredProfile',
                wasRenamed: false,
            };
        }

        try {
            const result = await invoke<{ success: boolean; restored_path: string; profile_name: string; was_renamed: boolean }>(
                'restore_from_backup',
                { backupPath, targetBasePath, conflictAction }
            );
            // Refresh profiles list after restore
            await this.scanProfiles(targetBasePath);
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
}
