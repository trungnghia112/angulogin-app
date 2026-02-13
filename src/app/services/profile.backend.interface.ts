import { Profile, ProfileMetadata } from '../models/profile.model';

/** Options for launching a browser with a specific profile */
/** Options for launching a browser with a specific profile */
export interface LaunchBrowserOptions {
    profilePath: string;
    browser: string;
    url?: string | null;
    incognito?: boolean | null;
    proxyServer?: string | null;
    proxyUsername?: string | null;
    proxyPassword?: string | null;
    customFlags?: string | null;
}

/** Result from clearing profile cookies and cache */
export interface ClearCookiesResult {
    deleted_count: number;
    freed_bytes: number;
    failed_items: string[];
}

/** Result from a profile health check */
export interface ProfileHealthCheckResult {
    is_healthy: boolean;
    issues: string[];
    warnings: string[];
    checked_files: number;
}

/** Result from restoring a profile backup */
export interface RestoreBackupResult {
    success: boolean;
    restored_path: string;
    profile_name: string;
    was_renamed: boolean;
}

/** Raw profile info from Rust backend (snake_case fields) */
export interface RawProfileInfo {
    name: string;
    path: string;
    metadata: Record<string, unknown>;
    is_running: boolean;
}

/** Result from a bulk export operation */
export interface BulkExportResult {
    successful: string[];
    failed: string[];
    totalSize: number;
}

export interface ProfileBackend {
    scanProfiles(path: string): Promise<string[]>;
    scanProfilesWithMetadata(path: string): Promise<Profile[]>;
    checkPathExists(path: string): Promise<boolean>;
    ensureProfilesDirectory(path: string): Promise<void>;
    createProfile(basePath: string, name: string): Promise<string>;
    deleteProfile(profilePath: string): Promise<void>;
    renameProfile(oldPath: string, newName: string): Promise<string>;
    getProfileMetadata(profilePath: string): Promise<ProfileMetadata>;
    saveProfileMetadata(profilePath: string, metadata: Partial<ProfileMetadata>): Promise<void>;
    isProfileRunning(profilePath: string): Promise<boolean>;
    batchCheckRunning(profilePaths: string[]): Promise<Record<string, boolean>>;
    launchBrowser(options: LaunchBrowserOptions): Promise<void>;
    getProfileSize(profilePath: string): Promise<number>;
    listAvailableBrowsers(): Promise<string[]>;
    clearProfileCookies(profilePath: string): Promise<ClearCookiesResult>;
    duplicateProfile(sourcePath: string, newName: string): Promise<string>;
    checkProfileHealth(profilePath: string): Promise<ProfileHealthCheckResult>;
    restoreFromBackup(backupPath: string, targetBasePath: string, conflictAction: string): Promise<RestoreBackupResult>;
    backupProfile(profilePath: string, backupPath: string): Promise<string>;
    bulkExportProfiles(profilePaths: string[], destinationFolder: string): Promise<BulkExportResult>;
}
