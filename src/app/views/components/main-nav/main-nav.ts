import { Component, inject, computed, ChangeDetectionStrategy, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { Router } from '@angular/router';
import { NavigationService } from '../../../services/navigation.service';
import { SettingsService } from '../../../core/services/settings.service';
import { AuthService } from '../../../services/auth.service';
import { PlanService } from '../../../services/plan.service';

@Component({
    selector: 'app-main-nav',
    imports: [ButtonModule, TooltipModule],
    templateUrl: './main-nav.html',
    styleUrl: './main-nav.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(document:click)': 'onDocumentClick($event)',
    },
})
export class MainNav {
    private router = inject(Router);
    private navService = inject(NavigationService);
    protected settingsService = inject(SettingsService);
    protected readonly authService = inject(AuthService);
    protected readonly planService = inject(PlanService);

    // Filter out hidden features (like Settings which has its own button)
    features = computed(() => this.navService.features().filter(f => !f.hidden));

    // Dark mode from settings service
    isDarkMode = this.settingsService.isDarkMode;

    // Feature 6.9: Zen Mode
    zenMode = this.navService.zenMode;

    // Custom user menu state
    readonly userMenuOpen = signal(false);

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

    toggleUserMenu(event: Event): void {
        event.stopPropagation();
        this.userMenuOpen.update(v => !v);
    }

    navigateToProfile(): void {
        this.router.navigate(['/profile']);
    }

    onLogout(): void {
        this.authService.logout();
    }

    onDocumentClick(event: Event): void {
        if (this.userMenuOpen()) {
            this.userMenuOpen.set(false);
        }
    }
}
