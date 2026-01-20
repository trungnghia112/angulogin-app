export interface ProfileMetadata {
    emoji: string | null;
    notes: string | null;
}

export interface Profile {
    name: string;
    path: string;
    metadata?: ProfileMetadata;
    isRunning?: boolean;
}

export interface AppSettings {
    profilesPath: string | null;
}
