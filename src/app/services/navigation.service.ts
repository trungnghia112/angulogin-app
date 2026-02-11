import { Injectable, signal, computed } from '@angular/core';
import { NavFeature, NAV_FEATURES } from '../models/navigation.model';

@Injectable({
    providedIn: 'root',
})
export class NavigationService {
    readonly features = signal<NavFeature[]>(NAV_FEATURES);
    readonly activeFeatureId = signal<string>('browsers');

    // Feature 6.9: Zen Mode - hides MainNav and HomeSidebar for maximum workspace
    readonly zenMode = signal<boolean>(this.loadZenMode());

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

    toggleZenMode(): void {
        const newValue = !this.zenMode();
        this.zenMode.set(newValue);
        localStorage.setItem('zen-mode', JSON.stringify(newValue));
    }

    private loadZenMode(): boolean {
        try {
            return JSON.parse(localStorage.getItem('zen-mode') || 'false');
        } catch {
            return false;
        }
    }
}
