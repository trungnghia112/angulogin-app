import { Injectable, signal, computed } from '@angular/core';
import { NavFeature, NAV_FEATURES } from '../models/navigation.model';

@Injectable({
    providedIn: 'root',
})
export class NavigationService {
    readonly features = signal<NavFeature[]>(NAV_FEATURES);
    readonly activeFeatureId = signal<string>('browsers');

    readonly activeFeature = computed(() => {
        const id = this.activeFeatureId();
        return this.features().find((f) => f.id === id) ?? null;
    });

    readonly hasSidebar = computed(() => {
        return this.activeFeature()?.hasSidebar ?? false;
    });

    readonly sidebarType = computed(() => {
        return this.activeFeature()?.sidebarType ?? null;
    });

    setActiveFeature(featureId: string): void {
        this.activeFeatureId.set(featureId);
    }

    getFeatureById(id: string): NavFeature | undefined {
        return this.features().find((f) => f.id === id);
    }
}
