export type BrowserType = 'chrome' | 'brave' | 'edge' | 'arc';

export interface ProfileMetadata {
    emoji: string | null;
    notes: string | null;
    group: string | null;
    shortcut: number | null;
    browser: BrowserType | null;
}

export interface Profile {
    name: string;
    path: string;
    metadata?: ProfileMetadata;
    isRunning?: boolean;
    size?: number;  // Size in bytes
}

export interface AppSettings {
    profilesPath: string | null;
}

