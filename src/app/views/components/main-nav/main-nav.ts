import { Component, inject, computed, ChangeDetectionStrategy, viewChild, ElementRef } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { MenuModule } from 'primeng/menu';
import { Router } from '@angular/router';
import { NavigationService } from '../../../services/navigation.service';
import { SettingsService } from '../../../core/services/settings.service';
import { AuthService } from '../../../services/auth.service';
import { PlanService } from '../../../services/plan.service';
import { MenuItem } from 'primeng/api';

@Component({
    selector: 'app-main-nav',
    imports: [ButtonModule, TooltipModule, MenuModule],
    templateUrl: './main-nav.html',
    styleUrl: './main-nav.css',
    changeDetection: ChangeDetectionStrategy.OnPush
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

    // User menu items
    readonly userMenuItems: MenuItem[] = [
        {
            label: 'My Account',
            icon: 'pi pi-user',
            command: () => this.router.navigate(['/settings']),
        },
        { separator: true },
        {
            label: 'Logout',
            icon: 'pi pi-sign-out',
            command: () => this.authService.logout(),
        },
    ];

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

