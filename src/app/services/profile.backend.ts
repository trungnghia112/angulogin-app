import { invoke } from '@tauri-apps/api/core';
import { debugLog } from '../core/utils/logger.util';
import { MOCK_PROFILES, MOCK_AVAILABLE_BROWSERS, getMockProfileByPath } from '../mocks/profile.mock';
import {
    BulkExportResult,
    ClearCookiesResult,
    CookieExportResult,
    CookieImportResult,
    LaunchBrowserOptions,
    ProfileBackend,
    ProfileHealthCheckResult,
    RawProfileInfo,
    RestoreBackupResult,
} from './profile.backend.interface';
import { Profile, ProfileMetadata } from '../models/profile.model';

export class MockProfileBackend implements ProfileBackend {
    async scanProfiles(path: string): Promise<string[]> {
        debugLog('Mock scanProfiles:', path);
        return MOCK_PROFILES.map(p => p.name);
    }

    async scanProfilesWithMetadata(path: string): Promise<Profile[]> {
        debugLog('Mock scanProfilesWithMetadata:', path);
        return MOCK_PROFILES.map(p => ({
            name: p.name,
            path: `${path}/${p.name}`,
            metadata: p.metadata,
            isRunning: p.isRunning || false,
            size: p.size,
        }));
    }

    async checkPathExists(path: string): Promise<boolean> {
        debugLog('Mock checkPathExists:', path);
        return true;
    }

    async ensureProfilesDirectory(path: string): Promise<void> {
        debugLog('Mock ensureProfilesDirectory:', path);
    }

    async createProfile(basePath: string, name: string): Promise<string> {
        debugLog('Mock createProfile:', basePath, name);
        return `${basePath}/${name}`;
    }

    async deleteProfile(profilePath: string): Promise<void> {
        debugLog('Mock deleteProfile:', profilePath);
    }

    async renameProfile(oldPath: string, newName: string): Promise<string> {
        debugLog('Mock renameProfile:', oldPath, newName);
        const basePath = oldPath.substring(0, oldPath.lastIndexOf('/'));
        return `${basePath}/${newName}`;
    }

    async getProfileMetadata(profilePath: string): Promise<ProfileMetadata> {
        const profile = getMockProfileByPath(profilePath);
        return profile?.metadata || { emoji: null, notes: null, group: null, shortcut: null, browser: null };
    }

    async saveProfileMetadata(profilePath: string, metadata: Partial<ProfileMetadata>): Promise<void> {
        debugLog('Mock saveProfileMetadata:', profilePath, metadata);
    }

    async isProfileRunning(profilePath: string): Promise<boolean> {
        const profile = getMockProfileByPath(profilePath);
        return profile?.isRunning || false;
    }

    async batchCheckRunning(profilePaths: string[]): Promise<Record<string, boolean>> {
        const result: Record<string, boolean> = {};
        for (const p of profilePaths) {
            const profile = getMockProfileByPath(p);
            result[p] = profile?.isRunning || false;
        }
        return result;
    }

    async launchBrowser(options: LaunchBrowserOptions): Promise<void> {
        debugLog('Mock launchBrowser:', options);
    }

    async getProfileSize(profilePath: string): Promise<number> {
        const profile = getMockProfileByPath(profilePath);
        return profile?.size || 0;
    }

    async listAvailableBrowsers(): Promise<string[]> {
        return MOCK_AVAILABLE_BROWSERS;
    }

    async clearProfileCookies(profilePath: string): Promise<ClearCookiesResult> {
        debugLog('Mock clearProfileCookies:', profilePath);
        return { deleted_count: 5, freed_bytes: 1024 * 1024 * 10, failed_items: [] };
    }

    async duplicateProfile(sourcePath: string, newName: string): Promise<string> {
        debugLog('Mock duplicateProfile:', sourcePath, newName);
        const basePath = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
        return `${basePath}/${newName}`;
    }

    async checkProfileHealth(profilePath: string): Promise<ProfileHealthCheckResult> {
        debugLog('Mock checkProfileHealth:', profilePath);
        return { is_healthy: true, issues: [], warnings: [], checked_files: 4 };
    }

    async restoreFromBackup(backupPath: string, targetBasePath: string, conflictAction: string): Promise<RestoreBackupResult> {
        debugLog('Mock restoreFromBackup:', backupPath, targetBasePath, conflictAction);
        return { success: true, restored_path: targetBasePath + '/RestoredProfile', profile_name: 'RestoredProfile', was_renamed: false };
    }

    async backupProfile(profilePath: string, backupPath: string): Promise<string> {
        debugLog('Mock backupProfile:', profilePath, backupPath);
        return backupPath;
    }

    async bulkExportProfiles(profilePaths: string[], destinationFolder: string): Promise<BulkExportResult> {
        debugLog('Mock bulkExportProfiles:', profilePaths, destinationFolder);
        return { successful: profilePaths, failed: [], totalSize: 0 };
    }

    async exportCookies(profilePath: string, _browser?: string): Promise<CookieExportResult> {
        debugLog('Mock exportCookies:', profilePath);
        return { cookies: [], count: 0, decryptedCount: 0, format: 'json' };
    }

    async importCookies(profilePath: string, cookiesJson: string): Promise<CookieImportResult> {
        debugLog('Mock importCookies:', profilePath, cookiesJson.substring(0, 50));
        return { imported: 0, skipped: 0, errors: [] };
    }
}

export class TauriProfileBackend implements ProfileBackend {
    async scanProfiles(path: string): Promise<string[]> {
        return await invoke<string[]>('scan_profiles', { path });
    }

    /** PERF: All-in-one scan — 1 IPC call returns names + metadata + running status */
    async scanProfilesWithMetadata(path: string): Promise<Profile[]> {
        const rawProfiles = await invoke<RawProfileInfo[]>('scan_profiles_with_metadata', { path });
        return rawProfiles.map(raw => ({
            name: raw.name,
            path: raw.path,
            metadata: raw.metadata as unknown as ProfileMetadata,
            isRunning: raw.is_running,
        }));
    }

    async checkPathExists(path: string): Promise<boolean> {
        return await invoke<boolean>('check_path_exists', { path });
    }

    async ensureProfilesDirectory(path: string): Promise<void> {
        return await invoke('ensure_profiles_directory', { path });
    }

    async createProfile(basePath: string, name: string): Promise<string> {
        return await invoke<string>('create_profile', { basePath, name });
    }

    async deleteProfile(profilePath: string): Promise<void> {
        return await invoke('delete_profile', { profilePath });
    }

    async renameProfile(oldPath: string, newName: string): Promise<string> {
        return await invoke<string>('rename_profile', { oldPath, newName });
    }

    async getProfileMetadata(profilePath: string): Promise<ProfileMetadata> {
        try {
            return await invoke<ProfileMetadata>('get_profile_metadata', { profilePath });
        } catch {
            return { emoji: null, notes: null, group: null, shortcut: null, browser: null };
        }
    }

    async saveProfileMetadata(profilePath: string, metadata: Partial<ProfileMetadata>): Promise<void> {
        return await invoke('save_profile_metadata', { profilePath, ...metadata });
    }

    async isProfileRunning(profilePath: string): Promise<boolean> {
        try {
            return await invoke<boolean>('is_chrome_running_for_profile', { profilePath });
        } catch {
            return false;
        }
    }

    async batchCheckRunning(profilePaths: string[]): Promise<Record<string, boolean>> {
        try {
            return await invoke<Record<string, boolean>>('batch_check_running', { profilePaths });
        } catch {
            // Fallback: all not running
            const result: Record<string, boolean> = {};
            for (const p of profilePaths) result[p] = false;
            return result;
        }
    }

    async launchBrowser(options: LaunchBrowserOptions): Promise<void> {
        return await invoke('launch_browser', options as unknown as Record<string, unknown>);
    }

    async getProfileSize(profilePath: string): Promise<number> {
        return await invoke<number>('get_profile_size', { profilePath });
    }

    async listAvailableBrowsers(): Promise<string[]> {
        return await invoke<string[]>('list_available_browsers');
    }

    async clearProfileCookies(profilePath: string): Promise<ClearCookiesResult> {
        return await invoke<ClearCookiesResult>('clear_profile_cookies', { profilePath });
    }

    async duplicateProfile(sourcePath: string, newName: string): Promise<string> {
        return await invoke<string>('duplicate_profile', { sourcePath, newName });
    }

    async checkProfileHealth(profilePath: string): Promise<ProfileHealthCheckResult> {
        return await invoke<ProfileHealthCheckResult>('check_profile_health', { profilePath });
    }

    async restoreFromBackup(backupPath: string, targetBasePath: string, conflictAction: string): Promise<RestoreBackupResult> {
        return await invoke<RestoreBackupResult>('restore_from_backup', { backupPath, targetBasePath, conflictAction });
    }

    async backupProfile(profilePath: string, backupPath: string): Promise<string> {
        return await invoke<string>('backup_profile', { profilePath, backupPath });
    }

    async bulkExportProfiles(profilePaths: string[], destinationFolder: string): Promise<BulkExportResult> {
        // Bulk export via sequential backup calls
        const successful: string[] = [];
        const failed: string[] = [];
        let totalSize = 0;
        for (const path of profilePaths) {
            try {
                const profileName = path.split('/').pop() || 'profile';
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const backupPath = `${destinationFolder}/${profileName}_backup_${timestamp}.zip`;
                await this.backupProfile(path, backupPath);
                successful.push(path);
            } catch {
                failed.push(path);
            }
        }
        return { successful, failed, totalSize };
    }

    async exportCookies(profilePath: string, browser?: string): Promise<CookieExportResult> {
        return await invoke<CookieExportResult>('export_profile_cookies', { profilePath, browser: browser ?? null });
    }

    async importCookies(profilePath: string, cookiesJson: string): Promise<CookieImportResult> {
        return await invoke<CookieImportResult>('import_profile_cookies', { profilePath, cookiesJson });
    }
}
