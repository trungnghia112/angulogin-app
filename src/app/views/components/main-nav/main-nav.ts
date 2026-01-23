import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
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
    protected readonly navService = inject(NavigationService);

    protected readonly features = this.navService.features;
    protected readonly activeFeatureId = this.navService.activeFeatureId;

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
