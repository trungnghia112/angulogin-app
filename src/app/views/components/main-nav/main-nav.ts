import { Component, ChangeDetectionStrategy, inject, signal, DOCUMENT } from '@angular/core';
import { Router } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { NavigationService } from '../../../services/navigation.service';

@Component({
    selector: 'app-main-nav',
    templateUrl: './main-nav.html',
    styleUrl: './main-nav.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TooltipModule],
})
export class MainNav {
    private readonly router = inject(Router);
    private readonly document = inject(DOCUMENT);
    protected readonly navService = inject(NavigationService);

    protected readonly features = this.navService.features;
    protected readonly activeFeatureId = this.navService.activeFeatureId;

    // Dark mode toggle
    protected readonly isDarkMode = signal(true);

    constructor() {
        // Initialize from current HTML class
        this.isDarkMode.set(this.document.documentElement.classList.contains('dark'));
    }

    protected toggleDarkMode(): void {
        const newValue = !this.isDarkMode();
        this.isDarkMode.set(newValue);

        if (newValue) {
            this.document.documentElement.classList.add('dark');
        } else {
            this.document.documentElement.classList.remove('dark');
        }
    }

    protected selectFeature(featureId: string): void {
        this.navService.setActiveFeature(featureId);
        const feature = this.navService.getFeatureById(featureId);
        if (feature) {
            this.router.navigate([feature.route]);
        }
    }

    protected isActive(featureId: string): boolean {
        return this.activeFeatureId() === featureId;
    }
}
