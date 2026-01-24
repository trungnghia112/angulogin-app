export interface GeneralSettings {
    startAtLogin: boolean;
    minimizeToTray: boolean;
}

export interface AppearanceSettings {
    primaryColor: string; // 'indigo', 'fuchsia', 'cyan', etc.
    surface: string; // 'zinc', 'slate', 'neutral', 'stone', 'gray'
    scale: number; // 12 to 16
}

export interface BrowserSettings {
    customPaths: Record<string, string>; // 'chrome': '/path/to/bin'
}

export interface AppSettings {
    general: GeneralSettings;
    appearance: AppearanceSettings;
    browser: BrowserSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
    general: {
        startAtLogin: false,
        minimizeToTray: false
    },
    appearance: {
        primaryColor: 'fuchsia',
        surface: 'zinc',
        scale: 14
    },
    browser: {
        customPaths: {}
    }
};
