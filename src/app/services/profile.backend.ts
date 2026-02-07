import { invoke } from '@tauri-apps/api/core';
import { debugLog } from '../core/utils/logger.util';
import { MOCK_PROFILES, MOCK_AVAILABLE_BROWSERS, getMockProfileByPath } from '../mocks/profile.mock';
import { ProfileBackend } from './profile.backend.interface';
import { ProfileMetadata } from '../models/profile.model';

export class MockProfileBackend implements ProfileBackend {
    async scanProfiles(path: string): Promise<string[]> {
        debugLog('Mock scanProfiles:', path);
        return MOCK_PROFILES.map(p => p.name);
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

    async saveProfileMetadata(profilePath: string, metadata: any): Promise<void> {
        debugLog('Mock saveProfileMetadata:', profilePath, metadata);
    }

    async isProfileRunning(profilePath: string): Promise<boolean> {
        const profile = getMockProfileByPath(profilePath);
        return profile?.isRunning || false;
    }

    async launchBrowser(options: any): Promise<void> {
        debugLog('Mock launchBrowser:', options);
    }

    async getProfileSize(profilePath: string): Promise<number> {
        const profile = getMockProfileByPath(profilePath);
        return profile?.size || 0;
    }

    async listAvailableBrowsers(): Promise<string[]> {
        return MOCK_AVAILABLE_BROWSERS;
    }

    async clearProfileCookies(profilePath: string): Promise<any> {
        debugLog('Mock clearProfileCookies:', profilePath);
        return { deleted_count: 5, freed_bytes: 1024 * 1024 * 10, failed_items: [] };
    }

    async duplicateProfile(sourcePath: string, newName: string): Promise<string> {
        debugLog('Mock duplicateProfile:', sourcePath, newName);
        const basePath = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
        return `${basePath}/${newName}`;
    }

    async checkProfileHealth(profilePath: string): Promise<any> {
        debugLog('Mock checkProfileHealth:', profilePath);
        return { is_healthy: true, issues: [], warnings: [], checked_files: 4 };
    }

    async restoreFromBackup(backupPath: string, targetBasePath: string, conflictAction: string): Promise<any> {
        debugLog('Mock restoreFromBackup:', backupPath, targetBasePath, conflictAction);
        return { success: true, restored_path: targetBasePath + '/RestoredProfile', profile_name: 'RestoredProfile', was_renamed: false };
    }
}

export class TauriProfileBackend implements ProfileBackend {
    async scanProfiles(path: string): Promise<string[]> {
        return await invoke<string[]>('scan_profiles', { path });
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

    async saveProfileMetadata(profilePath: string, metadata: any): Promise<void> {
        return await invoke('save_profile_metadata', { profilePath, ...metadata });
    }

    async isProfileRunning(profilePath: string): Promise<boolean> {
        try {
            return await invoke<boolean>('is_chrome_running_for_profile', { profilePath });
        } catch {
            return false;
        }
    }

    async launchBrowser(options: any): Promise<void> {
        return await invoke('launch_browser', options);
    }

    async getProfileSize(profilePath: string): Promise<number> {
        return await invoke<number>('get_profile_size', { profilePath });
    }

    async listAvailableBrowsers(): Promise<string[]> {
        return await invoke<string[]>('list_available_browsers');
    }

    async clearProfileCookies(profilePath: string): Promise<any> {
        return await invoke('clear_profile_cookies', { profilePath });
    }

    async duplicateProfile(sourcePath: string, newName: string): Promise<string> {
        return await invoke<string>('duplicate_profile', { sourcePath, newName });
    }

    async checkProfileHealth(profilePath: string): Promise<any> {
        return await invoke('check_profile_health', { profilePath });
    }

    async restoreFromBackup(backupPath: string, targetBasePath: string, conflictAction: string): Promise<any> {
        return await invoke('restore_from_backup', { backupPath, targetBasePath, conflictAction });
    }
}
