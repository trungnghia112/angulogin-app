import { Profile, ProfileMetadata } from '../models/profile.model';

export interface ProfileBackend {
    scanProfiles(path: string): Promise<string[]>;
    checkPathExists(path: string): Promise<boolean>;
    ensureProfilesDirectory(path: string): Promise<void>;
    createProfile(basePath: string, name: string): Promise<string>;
    deleteProfile(profilePath: string): Promise<void>;
    renameProfile(oldPath: string, newName: string): Promise<string>;
    getProfileMetadata(profilePath: string): Promise<ProfileMetadata>;
    saveProfileMetadata(profilePath: string, metadata: any): Promise<void>;
    isProfileRunning(profilePath: string): Promise<boolean>;
    launchBrowser(options: any): Promise<void>;
    getProfileSize(profilePath: string): Promise<number>;
    listAvailableBrowsers(): Promise<string[]>;
    clearProfileCookies(profilePath: string): Promise<any>;
    duplicateProfile(sourcePath: string, newName: string): Promise<string>;
    checkProfileHealth(profilePath: string): Promise<any>;
    restoreFromBackup(backupPath: string, targetBasePath: string, conflictAction: string): Promise<any>;
}
