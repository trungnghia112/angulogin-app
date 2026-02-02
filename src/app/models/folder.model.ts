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
    type: 'http' | 'socks5';
    username?: string | null;
    password?: string | null;
    group?: string | null;
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
