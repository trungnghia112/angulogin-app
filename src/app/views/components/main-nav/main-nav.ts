import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { Router } from '@angular/router';
import { NavigationService } from '../../../services/navigation.service';
import { SettingsService } from '../../../core/services/settings.service';

@Component({
    selector: 'app-main-nav',
    imports: [ButtonModule, TooltipModule],
    templateUrl: './main-nav.html',
    styleUrl: './main-nav.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainNav {
    private router = inject(Router);
    private navService = inject(NavigationService);
    protected settingsService = inject(SettingsService);

    // Filter out hidden features (like Settings which has its own button)
    features = computed(() => this.navService.features().filter(f => !f.hidden));

    // Dark mode from settings service
    isDarkMode = this.settingsService.isDarkMode;

    // Feature 6.9: Zen Mode
    zenMode = this.navService.zenMode;

    toggleTheme(): void {
        this.settingsService.toggleDarkMode();
    }

    toggleZenMode(): void {
        this.navService.toggleZenMode();
    }

    isActive(featureId: string): boolean {
        return this.router.url.includes(featureId);
    }

    selectFeature(featureId: string): void {
        this.router.navigate(['/' + featureId]);
    }
}
