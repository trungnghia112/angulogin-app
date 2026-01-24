import { Component, inject, signal, OnInit, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { Router } from '@angular/router';
import { NavigationService } from '../../../services/navigation.service';

@Component({
    selector: 'app-main-nav',
    standalone: true,
    imports: [CommonModule, ButtonModule, TooltipModule],
    templateUrl: './main-nav.html',
    styleUrl: './main-nav.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainNav implements OnInit {
    private document = inject(DOCUMENT);
    private router = inject(Router);
    private navService = inject(NavigationService);

    // Signals
    isDarkMode = signal<boolean>(false);

    // Filter out hidden features (like Settings which has its own button)
    features = computed(() => this.navService.features().filter(f => !f.hidden));

    constructor() {
        // No effect needed - we handle theme class directly in methods
    }

    ngOnInit() {
        this.checkInitialTheme();
    }

    private checkInitialTheme() {
        const savedTheme = localStorage.getItem('app-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            this.isDarkMode.set(true);
            this.document.documentElement.classList.add('dark');
        } else {
            this.isDarkMode.set(false);
            this.document.documentElement.classList.remove('dark');
        }
    }

    toggleTheme() {
        const newValue = !this.isDarkMode();
        this.isDarkMode.set(newValue);

        if (newValue) {
            this.document.documentElement.classList.add('dark');
        } else {
            this.document.documentElement.classList.remove('dark');
        }

        localStorage.setItem('app-theme', newValue ? 'dark' : 'light');
    }

    isActive(featureId: string): boolean {
        return this.router.url.includes(featureId);
    }

    selectFeature(featureId: string) {
        this.router.navigate(['/' + featureId]);
    }
}
