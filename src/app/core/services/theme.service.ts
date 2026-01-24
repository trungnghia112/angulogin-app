import { Injectable, computed, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { SettingsService } from './settings.service';
import { APP_THEMES } from '../constants/themes.const';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private document = inject(DOCUMENT);
    private settings = inject(SettingsService);

    constructor() {
        // Effect to apply Primary Color
        effect(() => {
            const colorName = this.settings.appearance().primaryColor;
            this.applyPrimaryColor(colorName);
        });

        // Effect to apply Scale
        effect(() => {
            const scale = this.settings.appearance().scale;
            this.applyScale(scale);
        });
    }

    private applyPrimaryColor(colorName: string) {
        const palette = APP_THEMES[colorName];
        if (!palette) return;

        const root = this.document.documentElement;

        // Apply each shade as a CSS variable
        for (const [shade, value] of Object.entries(palette)) {
            root.style.setProperty(`--p-primary-${shade}`, value as string);
        }
    }

    private applyScale(scale: number) {
        const root = this.document.documentElement;
        root.style.fontSize = `${scale}px`;
    }
}
