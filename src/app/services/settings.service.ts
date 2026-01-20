import { Injectable, signal, effect } from '@angular/core';
import { AppSettings } from '../models/profile.model';

const STORAGE_KEY = 'chrome-profile-manager-settings';

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
        return this.settings().profilesPath;
    }

    setProfilesPath(path: string): void {
        this.settings.update((s) => ({ ...s, profilesPath: path }));
    }

    clearProfilesPath(): void {
        this.settings.update((s) => ({ ...s, profilesPath: null }));
    }
}
