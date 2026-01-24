import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { open } from '@tauri-apps/plugin-dialog';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { MessageService } from 'primeng/api';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

// Services
import {
    SettingsService,
    PRIMARY_COLORS,
    SURFACE_PALETTES,
    UI_SCALES,
    GeneralSettings
} from '../../../core/services/settings.service';

interface SettingsCategory {
    id: string;
    label: string;
    icon: string;
}

@Component({
    selector: 'app-settings',
    templateUrl: './settings.html',
    styleUrl: './settings.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex min-h-0 overflow-hidden' },
    imports: [
        FormsModule,
        ButtonModule,
        SelectButtonModule,
        InputTextModule,
        InputTextModule,
        TooltipModule,
        InputGroupModule,
        InputGroupAddonModule,
        ToggleSwitchModule
    ],
})
export class Settings {
    protected readonly settingsService = inject(SettingsService);
    private readonly messageService = inject(MessageService);

    // Settings categories for sidebar navigation
    protected readonly categories: SettingsCategory[] = [
        { id: 'general', label: 'General', icon: 'pi pi-cog' },
        { id: 'appearance', label: 'Appearance', icon: 'pi pi-palette' },
        { id: 'browser', label: 'Browser Paths', icon: 'pi pi-folder' },
        { id: 'data', label: 'Data', icon: 'pi pi-database' },
    ];

    // Active category
    protected readonly activeCategory = signal<string>('appearance');

    // Theme options
    protected readonly primaryColors = PRIMARY_COLORS;
    protected readonly surfacePalettes = SURFACE_PALETTES;
    protected readonly uiScales = UI_SCALES;

    // General Options
    protected readonly browserOptions = [
        { label: 'Chrome', value: 'chrome', icon: 'pi pi-google' },
        { label: 'Brave', value: 'brave', icon: 'pi pi-shield' },
        { label: 'Edge', value: 'edge', icon: 'pi pi-microsoft' },
        { label: 'Arc', value: 'arc', icon: 'pi pi-globe' }
    ];

    protected readonly launchOptions = [
        { label: 'Keep Open', value: 'keep-open', icon: 'pi pi-window-maximize' },
        { label: 'Minimize', value: 'minimize', icon: 'pi pi-window-minimize' },
        { label: 'Close', value: 'close', icon: 'pi pi-times' }
    ];

    // Navigate to category
    selectCategory(id: string): void {
        this.activeCategory.set(id);
    }

    // Theme methods
    setPrimaryColor(colorName: string): void {
        this.settingsService.setPrimaryColor(colorName);
    }

    setSurface(surfaceName: string): void {
        this.settingsService.setSurface(surfaceName);
    }

    setScale(scale: number): void {
        this.settingsService.setScale(scale);
    }

    toggleDarkMode(): void {
        this.settingsService.toggleDarkMode();
    }

    // General Settings Methods
    updateGeneral<K extends keyof GeneralSettings>(key: K, event: any): void {
        // Handle different event types (p-inputSwitch emits event.checked or direct value for SelectButton)
        let value: any;
        if (event && typeof event === 'object' && 'checked' in event) {
            value = event.checked; // InputSwitch
        } else if (event && typeof event === 'object' && 'value' in event) {
            value = event.value; // SelectButton (sometimes)
        } else {
            value = event; // Direct value binding
        }

        // Ensure strictly typed value
        this.settingsService.setGeneralSetting(key, value as GeneralSettings[K]);
    }

    async browseProfilesPath(): Promise<void> {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: 'Select Chrome User Data Directory',
            });

            if (selected && typeof selected === 'string') {
                this.settingsService.setProfilesPath(selected);
            }
        } catch (err) {
            console.error('Failed to open folder picker:', err);
        }
    }

    async resetProfilesPath(): Promise<void> {
        const defaultPath = await this.settingsService.detectDefaultPath();
        if (defaultPath) {
            this.settingsService.setProfilesPath(defaultPath);
            this.messageService.add({
                severity: 'success',
                summary: 'Path Reset',
                detail: 'Default Chrome path has been set.',
            });
        } else {
            this.messageService.add({
                severity: 'warn',
                summary: 'Desktop Mode Required',
                detail: 'This feature only works in the desktop app.',
            });
        }
    }
}
