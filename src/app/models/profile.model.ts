import { ProfileNote, ProfileStatus } from './folder.model';

export type BrowserType = 'chrome' | 'brave' | 'edge' | 'arc';

export interface ProfileMetadata {
    emoji: string | null;
    notes: string | null;
    group: string | null;
    shortcut: number | null;
    browser: BrowserType | null;
    // New optional fields for mockup UI
    folderId?: string | null;
    status?: ProfileStatus;
    proxyId?: string | null;
    tagIds?: string[];
    profileNotes?: ProfileNote[];
    // New fields for Tags, Launch URL, Pinning features
    tags?: string[];
    launchUrl?: string | null;
    isPinned?: boolean;
    lastOpened?: string | null;
    proxyServer?: string | null;
    // Phase 1: Color Coding
    color?: string | null;
    // Phase 2: Hidden Profiles
    isHidden?: boolean;
}

export interface Profile {
    id?: string; // Optional for backward compatibility
    name: string;
    path: string;
    metadata?: ProfileMetadata;
    isRunning?: boolean;
    size?: number;
    // Display fields from mockup
    osIcon?: 'apple' | 'windows' | 'android';
}

export interface AppSettings {
    profilesPath: string | null;
}
