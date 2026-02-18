export interface Folder {
    id: string;
    name: string;
    icon: string | null; // PrimeIcon class or custom icon URL
    color: string | null; // Hex color for folder
    profileCount?: number;
}

export type ProfileStatus = 'no_status' | 'active' | 'suspended' | 'banned';

export interface ProfileProxy {
    id: string;
    name: string;
    host: string;
    port: number;
    type: 'http' | 'socks4' | 'socks5';
    username?: string | null;
    password?: string | null;
    group?: string | null;
    // Health check status (Feature 4.3)
    lastChecked?: string | null;  // ISO timestamp
    isAlive?: boolean | null;     // Last health check result
    latencyMs?: number | null;    // Response time in ms
}

export interface ProfileTag {
    id: string;
    name: string;
    color: string;
}

export interface ProfileNote {
    id: string;
    content: string;
    color: 'yellow' | 'red' | 'green' | 'blue';
    createdAt: Date;
}
