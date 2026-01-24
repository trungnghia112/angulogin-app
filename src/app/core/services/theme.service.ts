import { Injectable, computed, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { SettingsService } from './settings.service';
import { APP_THEMES, APP_SURFACE_PALETTES } from '../constants/themes.const';
import { updatePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

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

        // Effect to apply Surface
        effect(() => {
            const surfaceName = this.settings.appearance().surface;
            this.applySurface(surfaceName);
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

        updatePreset(Aura, {
            semantic: {
                primary: palette
            }
        });
    }

    private applySurface(surfaceName: string) {
        const palette = APP_SURFACE_PALETTES[surfaceName];
        if (!palette) return;

        updatePreset(Aura, {
            semantic: {
                colorScheme: {
                    light: {
                        surface: {
                            0: palette[0],
                            50: palette[50],
                            100: palette[100],
                            200: palette[200],
                            300: palette[300],
                            400: palette[400],
                            500: palette[500],
                            600: palette[600],
                            700: palette[700],
                            800: palette[800],
                            900: palette[900],
                            950: palette[950]
                        }
                    },
                    dark: {
                        surface: {
                            0: palette[950],
                            50: palette[900],
                            100: palette[800],
                            200: palette[700],
                            300: palette[600],
                            400: palette[500],
                            500: palette[400],
                            600: palette[300],
                            700: palette[200],
                            800: palette[100],
                            900: palette[50],
                            950: palette[0]
                        }
                    }
                }
            }
        });
    }

    private applyScale(scale: number) {
        const root = this.document.documentElement;
        root.style.fontSize = `${scale}px`;
    }
}
