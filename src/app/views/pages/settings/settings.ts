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

// Services
import {
    SettingsService,
    PRIMARY_COLORS,
    SURFACE_PALETTES,
    UI_SCALES,
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
