import { Component, inject, signal, effect, OnInit, computed, ChangeDetectionStrategy } from '@angular/core';
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
        // Effect to apply theme class when signal changes
        effect(() => {
            const isDark = this.isDarkMode();
            const html = this.document.documentElement;

            if (isDark) {
                html.classList.add('dark');
            } else {
                html.classList.remove('dark');
            }

            localStorage.setItem('app-theme', isDark ? 'dark' : 'light');
        });
    }

    ngOnInit() {
        this.checkInitialTheme();
    }

    private checkInitialTheme() {
        const savedTheme = localStorage.getItem('app-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            this.isDarkMode.set(true);
        } else {
            this.isDarkMode.set(false);
        }
    }

    toggleTheme() {
        this.isDarkMode.update(curr => !curr);
    }

    isActive(featureId: string): boolean {
        return this.router.url.includes(featureId);
    }

    selectFeature(featureId: string) {
        this.router.navigate(['/' + featureId]);
    }
}
