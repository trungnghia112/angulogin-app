import { Injectable, computed, effect, signal } from '@angular/core';
import { AppSettings, DEFAULT_SETTINGS } from '../models/settings.model';

@Injectable({
    providedIn: 'root'
})
export class SettingsService {
    private readonly STORAGE_KEY = 'app-settings';

    // State
    private _settings = signal<AppSettings>(this.loadSettings());
    private _isDialogVisible = signal<boolean>(false);
    private _activeCategory = signal<string>('appearance');

    // Selectors
    readonly settings = this._settings.asReadonly();
    readonly isDialogVisible = this._isDialogVisible.asReadonly();
    readonly activeCategory = this._activeCategory.asReadonly();

    // Specific selectors
    readonly general = computed(() => this.settings().general);
    readonly appearance = computed(() => this.settings().appearance);
    readonly browser = computed(() => this.settings().browser);

    constructor() {
        // Persistence Effect
        effect(() => {
            const currentSettings = this._settings();
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(currentSettings));
            } catch (error) {
                console.error('Failed to save settings:', error);
            }
        });
    }

    // Actions
    setActiveCategory(category: string) {
        this._activeCategory.set(category);
    }

    // Actions
    updateSettings(partialSettings: Partial<AppSettings> | ((current: AppSettings) => Partial<AppSettings>)) {
        this._settings.update(current => {
            const updates = typeof partialSettings === 'function'
                ? partialSettings(current)
                : partialSettings;

            // Deep merge logic (simplified for 2 levels)
            return {
                ...current,
                ...updates,
                general: { ...current.general, ...(updates.general || {}) },
                appearance: { ...current.appearance, ...(updates.appearance || {}) },
                browser: { ...current.browser, ...(updates.browser || {}) }
            };
        });
    }

    resetSettings() {
        this._settings.set(DEFAULT_SETTINGS);
    }

    // Dialog Methods
    openDialog() {
        this._isDialogVisible.set(true);
    }

    closeDialog() {
        this._isDialogVisible.set(false);
    }

    // Private Methods
    private loadSettings(): AppSettings {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) return DEFAULT_SETTINGS;

            const parsed = JSON.parse(stored);
            // Merge with defaults to ensure new fields are present
            return {
                general: { ...DEFAULT_SETTINGS.general, ...(parsed.general || {}) },
                appearance: { ...DEFAULT_SETTINGS.appearance, ...(parsed.appearance || {}) },
                browser: { ...DEFAULT_SETTINGS.browser, ...(parsed.browser || {}) }
            };
        } catch (error) {
            console.error('Failed to load settings:', error);
            return DEFAULT_SETTINGS;
        }
    }
}
