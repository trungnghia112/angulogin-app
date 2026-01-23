import { Injectable, signal, effect } from '@angular/core';
import { AppSettings } from '../models/profile.model';
import { isTauriAvailable } from '../core/utils/platform.util';

const STORAGE_KEY = 'chrome-profile-manager-settings';
const MOCK_PROFILES_PATH = '/mock/profiles';

@Injectable({
    providedIn: 'root',
})
export class SettingsService {
    readonly settings = signal<AppSettings>({
        profilesPath: null,
    });

    constructor() {
        this.loadSettings();

        effect(() => {
            const current = this.settings();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        });
    }

    private loadSettings(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as AppSettings;
                this.settings.set(parsed);
            }
        } catch {
            console.warn('Failed to load settings from localStorage');
        }
    }

    getProfilesPath(): string | null {
        // In mock mode, always return a mock path to enable profile scanning
        if (!isTauriAvailable()) {
            return MOCK_PROFILES_PATH;
        }
        return this.settings().profilesPath;
    }

    setProfilesPath(path: string): void {
        this.settings.update((s) => ({ ...s, profilesPath: path }));
    }

    clearProfilesPath(): void {
        this.settings.update((s) => ({ ...s, profilesPath: null }));
    }
}
