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
    // Usage Statistics
    launchCount?: number;
    totalUsageMinutes?: number;
    lastSessionDuration?: number;
    // Custom Sort Order (for drag & drop)
    sortOrder?: number;
    // Favorites feature (2.4)
    isFavorite?: boolean;
    // Custom Chrome Flags (3.6)
    customFlags?: string | null;
    // Window Position Settings (3.7)
    windowPosition?: WindowPosition | null;
    // Phase 0: Proxy Manager
    proxy?: string | null;
    // Feature 3.4: Launch with Extensions toggle
    disableExtensions?: boolean;
    // Feature 4.2: Proxy Rotation
    proxyRotation?: ProxyRotationConfig | null;
}

// Proxy Rotation Configuration (Feature 4.2)
export interface ProxyRotationConfig {
    enabled: boolean;
    mode: 'per_launch' | 'hourly' | 'daily';
    proxyGroupId?: string | null;
    lastRotatedAt?: string | null;
    currentProxyIndex?: number;
}


// Window position and size for launching browser
export interface WindowPosition {
    x?: number | null;
    y?: number | null;
    width?: number | null;
    height?: number | null;
    maximized?: boolean;
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
