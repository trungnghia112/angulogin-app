import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { SettingsService } from '../../../core/services/settings.service';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [CommonModule, ButtonModule],
    templateUrl: './settings.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
    settingsService = inject(SettingsService);

    // Appearance Options

    // Appearance Options
    colors = [
        { name: 'indigo', hex: '#6366f1' },
        { name: 'blue', hex: '#3b82f6' },
        { name: 'fuchsia', hex: '#d946ef' },
        { name: 'teal', hex: '#14b8a6' },
        { name: 'orange', hex: '#f97316' }
    ];

    surfaces = [
        { name: 'zinc', label: 'Zinc', hex: '#52525b' },
        { name: 'slate', label: 'Slate', hex: '#64748b' },
        { name: 'gray', label: 'Gray', hex: '#6b7280' },
        { name: 'neutral', label: 'Neutral', hex: '#737373' },
        { name: 'stone', label: 'Stone', hex: '#78716c' }
    ];

    scales = [
        { label: 'Small', value: 12 },
        { label: 'Normal', value: 14 },
        { label: 'Large', value: 16 }
    ];



    setPrimaryColor(color: string) {
        this.settingsService.updateSettings(current => ({
            appearance: { ...current.appearance, primaryColor: color }
        }));
    }

    setSurface(surface: string) {
        this.settingsService.updateSettings(current => ({
            appearance: { ...current.appearance, surface }
        }));
    }

    setScale(scale: number) {
        this.settingsService.updateSettings(current => ({
            appearance: { ...current.appearance, scale }
        }));
    }
}
