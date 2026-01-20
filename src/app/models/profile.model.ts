export interface ProfileMetadata {
    emoji: string | null;
    notes: string | null;
    group: string | null;
    shortcut: number | null;  // 1-9 for Cmd+1 through Cmd+9
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
