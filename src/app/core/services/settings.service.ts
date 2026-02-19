import { Injectable, signal, computed, effect } from '@angular/core';
import { homeDir, join } from '@tauri-apps/api/path';
import { type } from '@tauri-apps/plugin-os';
import { updatePrimaryPalette, updateSurfacePalette } from '@primeuix/themes';

/**
 * Available primary color palettes from PrimeNG Aura preset
 */
export const PRIMARY_COLORS = [
    { name: 'emerald', label: 'Emerald', hex: '#10b981' },
    { name: 'blue', label: 'Blue', hex: '#3b82f6' },
    { name: 'violet', label: 'Violet', hex: '#8b5cf6' },
    { name: 'amber', label: 'Amber', hex: '#f59e0b' },
    { name: 'rose', label: 'Rose', hex: '#f43f5e' },
    { name: 'fuchsia', label: 'Fuchsia', hex: '#d946ef' },
] as const;

/**
 * Available surface palettes for dark/light mode
 */
export const SURFACE_PALETTES = [
    { name: 'zinc', label: 'Zinc', hex: '#71717a' },
    { name: 'slate', label: 'Slate', hex: '#64748b' },
    { name: 'gray', label: 'Gray', hex: '#6b7280' },
    { name: 'neutral', label: 'Neutral', hex: '#737373' },
    { name: 'stone', label: 'Stone', hex: '#78716c' },
] as const;

/**
 * Available UI scales
 */
export const UI_SCALES = [
    { value: 14, label: 'Small' },
    { value: 16, label: 'Normal' },
    { value: 18, label: 'Large' },
] as const;

export type BrowserType = 'chrome' | 'brave' | 'edge' | 'arc';
export type OnLaunchBehavior = 'keep-open' | 'minimize' | 'close';
export type ProtectionLevel = 'off' | 'standard' | 'maximum';

export interface AppearanceSettings {
    primaryColor: string;
    customPrimaryHex?: string;
    surface: string;
    scale: number;
    isDarkMode: boolean;
}

export interface GeneralSettings {
    defaultBrowser: BrowserType;
    onLaunch: OnLaunchBehavior;
    launchAtStartup: boolean;
    startMinimized: boolean;
    confirmDelete: boolean;
    defaultProtectionLevel: ProtectionLevel;
}

export interface BrowserSettings {
    profilesPath: string;
    additionalPaths?: string[];
}

export interface AutoBackupSettings {
    enabled: boolean;
    intervalDays: number; // 1, 7, 14, 30
    destinationFolder: string;
    lastBackupDate: string | null; // ISO timestamp
}

export interface AppSettings {
    appearance: AppearanceSettings;
    general: GeneralSettings;
    browser: BrowserSettings;
    autoBackup: AutoBackupSettings;
}

const DEFAULT_SETTINGS: AppSettings = {
    appearance: {
        primaryColor: 'fuchsia',
        surface: 'zinc',
        scale: 16,
        isDarkMode: false,
    },
    general: {
        defaultBrowser: 'chrome',
        onLaunch: 'keep-open',
        launchAtStartup: false,
        startMinimized: false,
        confirmDelete: true,
        defaultProtectionLevel: 'off',
    },
    browser: {
        profilesPath: '',
        additionalPaths: [],
    },
    autoBackup: {
        enabled: false,
        intervalDays: 7,
        destinationFolder: '',
        lastBackupDate: null,
    },
};

const STORAGE_KEY = 'app-settings';

// AnguLogin Storage Paths (Dedicated directory for managed profiles)
const MACOS_CHROME_PATH = 'Library/Application Support/AnguLogin/Profiles';
const WINDOWS_CHROME_PATH = 'AppData\\\\Roaming\\\\AnguLogin\\\\Profiles';
const LINUX_CHROME_PATH = '.config/AnguLogin/Profiles';

@Injectable({ providedIn: 'root' })
export class SettingsService {
    // Private state
    private readonly _settings = signal<AppSettings>(this.loadSettings());

    // Public readonly signals
    readonly settings = this._settings.asReadonly();
    readonly appearance = computed(() => this._settings().appearance);
    readonly general = computed(() => this._settings().general || DEFAULT_SETTINGS.general);
    readonly browser = computed(() => this._settings().browser);
    readonly isDarkMode = computed(() => this._settings().appearance.isDarkMode);
    readonly autoBackup = computed(() => this._settings().autoBackup || DEFAULT_SETTINGS.autoBackup);
    readonly defaultProtectionLevel = computed(() => this.general().defaultProtectionLevel || 'off');

    constructor() {
        // Apply initial theme on load
        this.applyTheme(this._settings().appearance);
        this.applyDarkMode(this._settings().appearance.isDarkMode);

        // Auto-save on changes
        effect(() => {
            const settings = this._settings();
            this.saveSettings(settings);
        });
    }

    /**
     * Check if running inside Tauri desktop app (Tauri 2.x)
     */
    private isTauriEnvironment(): boolean {
        // Tauri 2.x uses __TAURI_INTERNALS__ instead of __TAURI__
        return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    }

    /**
     * Detect default Chrome User Data path based on OS
     */
    async detectDefaultPath(): Promise<string> {
        if (!this.isTauriEnvironment()) {
            console.warn('Tauri APIs not available in browser mode');
            return '';
        }

        try {
            const osType = await type();
            const home = await homeDir();

            switch (osType) {
                case 'macos':
                    return await join(home, MACOS_CHROME_PATH);
                case 'windows':
                    return await join(home, WINDOWS_CHROME_PATH);
                case 'linux':
                    return await join(home, LINUX_CHROME_PATH);
                default:
                    return '';
            }
        } catch (e) {
            console.error('Failed to detect OS/Home:', e);
            return '';
        }
    }

    /**
     * Validate if the selected path looks like a Chrome User Data folder
     */
    validatePath(path: string): boolean {
        // Basic validation - just check if it's not empty for now
        return !!path && path.length > 0;
    }

    /**
     * Update primary color palette
     */
    setPrimaryColor(colorName: string): void {
        // Find the color palette reference
        const palette = this.createColorPalette(colorName);
        updatePrimaryPalette(palette);

        this._settings.update(s => ({
            ...s,
            appearance: { ...s.appearance, primaryColor: colorName, customPrimaryHex: undefined },
        }));
    }

    /**
     * Set a custom primary color from a hex value
     * Generates a full shade palette (50-950) from a single hex color
     */
    setCustomPrimaryColor(hex: string): void {
        const palette = this.generatePaletteFromHex(hex);
        updatePrimaryPalette(palette);

        this._settings.update(s => ({
            ...s,
            appearance: { ...s.appearance, primaryColor: 'custom', customPrimaryHex: hex },
        }));
    }

    /**
     * Update surface palette (affects dark mode backgrounds)
     */
    setSurface(surfaceName: string): void {
        const palette = this.createColorPalette(surfaceName);
        updateSurfacePalette(palette);

        this._settings.update(s => ({
            ...s,
            appearance: { ...s.appearance, surface: surfaceName },
        }));
    }

    /**
     * Update UI scale
     */
    setScale(scale: number): void {
        // Clamp to safe range to prevent UI DoS
        const safeScale = Math.max(12, Math.min(24, Math.round(scale)));
        document.documentElement.style.fontSize = `${safeScale}px`;

        this._settings.update(s => ({
            ...s,
            appearance: { ...s.appearance, scale: safeScale },
        }));
    }

    /**
     * Toggle dark mode
     */
    toggleDarkMode(): void {
        const newValue = !this._settings().appearance.isDarkMode;
        this.applyDarkMode(newValue);

        this._settings.update(s => ({
            ...s,
            appearance: { ...s.appearance, isDarkMode: newValue },
        }));
    }

    /**
     * Set dark mode explicitly
     */
    setDarkMode(isDark: boolean): void {
        this.applyDarkMode(isDark);

        this._settings.update(s => ({
            ...s,
            appearance: { ...s.appearance, isDarkMode: isDark },
        }));
    }

    /**
     * Update browser profiles path
     */
    setProfilesPath(path: string): void {
        this._settings.update(s => ({
            ...s,
            browser: { ...s.browser, profilesPath: path },
        }));
    }

    /**
     * Feature 10.4: Additional profile directories (multi-drive)
     */
    readonly additionalPaths = computed(() => this._settings().browser.additionalPaths || []);
    readonly allProfilePaths = computed(() => {
        const primary = this._settings().browser.profilesPath;
        const additional = this._settings().browser.additionalPaths || [];
        return primary ? [primary, ...additional] : [...additional];
    });

    addAdditionalPath(path: string): void {
        const current = this._settings().browser.additionalPaths || [];
        if (current.includes(path) || path === this._settings().browser.profilesPath) return;
        this._settings.update(s => ({
            ...s,
            browser: { ...s.browser, additionalPaths: [...current, path] },
        }));
        this.saveSettings(this._settings());
    }

    removeAdditionalPath(path: string): void {
        const current = this._settings().browser.additionalPaths || [];
        this._settings.update(s => ({
            ...s,
            browser: { ...s.browser, additionalPaths: current.filter(p => p !== path) },
        }));
        this.saveSettings(this._settings());
    }

    /**
     * Update general settings
     */
    setGeneralSetting<K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]): void {
        this._settings.update((s) => ({
            ...s,
            general: {
                ...s.general,
                [key]: value
            }
        }));
    }

    /**
     * Update auto-backup settings
     */
    setAutoBackupSetting<K extends keyof AutoBackupSettings>(key: K, value: AutoBackupSettings[K]): void {
        this._settings.update((s) => ({
            ...s,
            autoBackup: {
                ...s.autoBackup,
                [key]: value
            }
        }));
    }

    /**
     * Update multiple auto-backup settings at once
     */
    updateAutoBackup(updates: Partial<AutoBackupSettings>): void {
        this._settings.update((s) => ({
            ...s,
            autoBackup: {
                ...s.autoBackup,
                ...updates
            }
        }));
    }

    // === Data Management Methods ===

    /**
     * Export all application data as a JSON object
     * Includes settings and can be extended to include profile metadata
     */
    exportData(): string {
        const exportPayload = {
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            settings: this._settings(),
            // Future: Add profile metadata here
        };
        return JSON.stringify(exportPayload, null, 2);
    }

    /**
     * Import application data from a JSON string
     * Returns true if successful, false otherwise
     */
    importData(jsonString: string): { success: boolean; message: string } {
        try {
            const data = JSON.parse(jsonString);

            // Validate structure
            if (!data.version || !data.settings) {
                return { success: false, message: 'Invalid backup file format.' };
            }

            // Restore settings with merge to ensure compatibility
            const restoredSettings: AppSettings = {
                ...DEFAULT_SETTINGS,
                ...data.settings,
                appearance: { ...DEFAULT_SETTINGS.appearance, ...data.settings.appearance },
                general: { ...DEFAULT_SETTINGS.general, ...data.settings.general },
                browser: { ...DEFAULT_SETTINGS.browser, ...data.settings.browser },
                autoBackup: { ...DEFAULT_SETTINGS.autoBackup, ...data.settings.autoBackup }
            };

            // Sanitize imported values to prevent invalid state
            this.sanitizeSettings(restoredSettings);

            this._settings.set(restoredSettings);
            this.applyTheme(restoredSettings.appearance);
            this.applyDarkMode(restoredSettings.appearance.isDarkMode);

            return { success: true, message: 'Settings restored successfully.' };
        } catch (e) {
            console.error('Import failed:', e);
            return { success: false, message: 'Failed to parse backup file.' };
        }
    }

    /**
     * Clear all application data (factory reset)
     * WARNING: This is destructive and should require confirmation
     */
    clearAllData(): void {
        // Clear localStorage
        localStorage.removeItem(STORAGE_KEY);

        // Reset to defaults
        this._settings.set(DEFAULT_SETTINGS);
        this.applyTheme(DEFAULT_SETTINGS.appearance);
        this.applyDarkMode(DEFAULT_SETTINGS.appearance.isDarkMode);
    }

    /**
     * Reset all settings to default
     */
    resetToDefaults(): void {
        this._settings.set(DEFAULT_SETTINGS);
        this.applyTheme(DEFAULT_SETTINGS.appearance);
        this.applyDarkMode(DEFAULT_SETTINGS.appearance.isDarkMode);
    }

    // === Private Methods ===

    /**
     * Validate and sanitize settings values to prevent invalid state from imports
     */
    private sanitizeSettings(settings: AppSettings): void {
        const validPrimary: string[] = PRIMARY_COLORS.map(c => c.name);
        const validSurface: string[] = SURFACE_PALETTES.map(s => s.name);
        const validScales: number[] = UI_SCALES.map(s => s.value);

        // Appearance
        if (!validPrimary.includes(settings.appearance.primaryColor) && settings.appearance.primaryColor !== 'custom') {
            settings.appearance.primaryColor = DEFAULT_SETTINGS.appearance.primaryColor;
        }
        if (!validSurface.includes(settings.appearance.surface)) {
            settings.appearance.surface = DEFAULT_SETTINGS.appearance.surface;
        }
        if (!validScales.includes(settings.appearance.scale)) {
            settings.appearance.scale = Math.max(12, Math.min(24, Math.round(settings.appearance.scale)));
        }
        settings.appearance.isDarkMode = !!settings.appearance.isDarkMode;

        // Auto backup
        settings.autoBackup.intervalDays = Math.max(1, Math.min(365, Math.round(settings.autoBackup.intervalDays || 7)));
        settings.autoBackup.enabled = !!settings.autoBackup.enabled;

        // General: validate protection level
        const validLevels: ProtectionLevel[] = ['off', 'standard', 'maximum'];
        if (!validLevels.includes(settings.general.defaultProtectionLevel)) {
            settings.general.defaultProtectionLevel = 'off';
        }
    }

    private loadSettings(): AppSettings {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as Partial<AppSettings>;
                // Merge with defaults to ensure new fields are present
                return {
                    ...DEFAULT_SETTINGS,
                    ...parsed,
                    appearance: { ...DEFAULT_SETTINGS.appearance, ...parsed.appearance },
                    general: { ...DEFAULT_SETTINGS.general, ...parsed.general },
                    browser: { ...DEFAULT_SETTINGS.browser, ...parsed.browser },
                    autoBackup: { ...DEFAULT_SETTINGS.autoBackup, ...parsed.autoBackup }
                };
            }
        } catch (e) {
            console.warn('Failed to load settings:', e);
        }
        return DEFAULT_SETTINGS;
    }

    private saveSettings(settings: AppSettings): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to save settings:', e);
        }
    }

    private applyTheme(appearance: AppearanceSettings): void {
        // Apply primary color
        if (appearance.primaryColor === 'custom' && appearance.customPrimaryHex) {
            const customPalette = this.generatePaletteFromHex(appearance.customPrimaryHex);
            updatePrimaryPalette(customPalette);
        } else {
            const primaryPalette = this.createColorPalette(appearance.primaryColor);
            updatePrimaryPalette(primaryPalette);
        }

        // Apply surface palette
        const surfacePalette = this.createColorPalette(appearance.surface);
        updateSurfacePalette(surfacePalette);

        // Apply scale
        document.documentElement.style.fontSize = `${appearance.scale}px`;
    }

    private applyDarkMode(isDark: boolean): void {
        const html = document.documentElement;
        if (isDark) {
            html.classList.add('dark');
        } else {
            html.classList.remove('dark');
        }
    }

    /**
     * Creates a palette object using PrimeNG token references
     */
    private createColorPalette(colorName: string): Record<string, string> {
        return {
            50: `{${colorName}.50}`,
            100: `{${colorName}.100}`,
            200: `{${colorName}.200}`,
            300: `{${colorName}.300}`,
            400: `{${colorName}.400}`,
            500: `{${colorName}.500}`,
            600: `{${colorName}.600}`,
            700: `{${colorName}.700}`,
            800: `{${colorName}.800}`,
            900: `{${colorName}.900}`,
            950: `{${colorName}.950}`,
        };
    }

    /**
     * Generate a palette of 50-950 shades from a single hex color using HSL manipulation
     */
    private generatePaletteFromHex(hex: string): Record<string, string> {
        const { h, s, l } = this.hexToHsl(hex);
        // Map shade levels to lightness values (light to dark)
        const shadeMap: Record<string, number> = {
            50: Math.min(97, l + 45),
            100: Math.min(95, l + 35),
            200: Math.min(90, l + 25),
            300: Math.min(82, l + 15),
            400: Math.min(70, l + 5),
            500: l,
            600: Math.max(20, l - 10),
            700: Math.max(15, l - 20),
            800: Math.max(10, l - 30),
            900: Math.max(7, l - 38),
            950: Math.max(4, l - 44),
        };

        const palette: Record<string, string> = {};
        for (const [shade, lightness] of Object.entries(shadeMap)) {
            palette[shade] = this.hslToHex(h, s, lightness);
        }
        return palette;
    }

    private hexToHsl(hex: string): { h: number; s: number; l: number } {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return { h: 0, s: 0, l: 50 };
        const r = parseInt(result[1], 16) / 255;
        const g = parseInt(result[2], 16) / 255;
        const b = parseInt(result[3], 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    }

    private hslToHex(h: number, s: number, l: number): string {
        const sn = s / 100, ln = l / 100;
        const a = sn * Math.min(ln, 1 - ln);
        const f = (n: number) => {
            const k = (n + h / 30) % 12;
            const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }
}
