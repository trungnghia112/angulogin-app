import { Component, inject, signal, effect, OnInit } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { Router } from '@angular/router';

@Component({
    selector: 'app-main-nav',
    standalone: true,
    imports: [CommonModule, ButtonModule, TooltipModule],
    templateUrl: './main-nav.html',
    styleUrl: './main-nav.css'
})
export class MainNav implements OnInit {
    private document = inject(DOCUMENT);
    private router = inject(Router);

    // Signals
    isDarkMode = signal<boolean>(false);

    features = signal<{ id: string, name: string, icon: string, badge?: string }[]>([
        { id: 'browsers', name: 'Browsers', icon: 'pi-globe' },
        { id: 'automation', name: 'Automation', icon: 'pi-bolt' },
        { id: 'extensions', name: 'Extensions', icon: 'pi-box' },
        { id: 'teams', name: 'Teams', icon: 'pi-users' }
    ]);

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
