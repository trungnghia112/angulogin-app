import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';

import { ProfileService } from '../../../services/profile.service';
import { Profile } from '../../../models/profile.model';

interface CleanupSuggestion {
    type: 'large' | 'unused';
    profile: Profile;
    reason: string;
}

interface HealthCheckResult {
    profile: Profile;
    isHealthy: boolean;
    issues: string[];
    warnings: string[];
    checkedFiles: number;
}

@Component({
    selector: 'app-storage-dashboard',
    templateUrl: './storage-dashboard.html',
    styleUrl: './storage-dashboard.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [CommonModule, ChartModule, ButtonModule, CardModule, TooltipModule, TableModule],
})
export class StorageDashboard implements OnInit, OnDestroy {
    private readonly profileService = inject(ProfileService);
    private readonly router = inject(Router);
    private observer: MutationObserver | null = null;

    // Dark mode signal
    readonly isDarkMode = signal(false);

    // Health check state
    readonly healthChecking = signal(false);
    readonly healthResults = signal<HealthCheckResult[]>([]);

    // Data
    readonly profiles = this.profileService.profiles;

    // Stats
    readonly totalSize = computed(() =>
        this.profiles().reduce((sum, p) => sum + (p.size || 0), 0)
    );

    readonly profileCount = computed(() => this.profiles().length);

    readonly avgSize = computed(() => {
        const count = this.profileCount();
        return count > 0 ? this.totalSize() / count : 0;
    });

    readonly largestProfile = computed(() => {
        const sorted = [...this.profiles()].sort((a, b) => (b.size || 0) - (a.size || 0));
        return sorted[0] || null;
    });

    readonly top10Profiles = computed(() => {
        return [...this.profiles()]
            .sort((a, b) => (b.size || 0) - (a.size || 0))
            .slice(0, 10);
    });

    // Pie Chart Data
    readonly pieData = computed(() => {
        const profiles = this.top10Profiles();
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#7BC043', '#EE4035'
        ];
        return {
            labels: profiles.map(p => p.name),
            datasets: [{
                data: profiles.map(p => Math.round((p.size || 0) / 1024 / 1024)), // MB
                backgroundColor: colors.slice(0, profiles.length),
                hoverBackgroundColor: colors.slice(0, profiles.length),
            }]
        };
    });

    readonly pieOptions = computed(() => {
        const textColor = this.isDarkMode() ? '#e5e7eb' : '#374151';
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right' as const,
                    labels: {
                        usePointStyle: true,
                        color: textColor
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context: { label?: string; raw?: number }) =>
                            `${context.label}: ${context.raw} MB`
                    }
                }
            }
        };
    });

    // Bar Chart Data
    readonly barData = computed(() => {
        const profiles = this.top10Profiles();
        return {
            labels: profiles.map(p => p.name.length > 15 ? p.name.substring(0, 12) + '...' : p.name),
            datasets: [{
                label: 'Size (MB)',
                data: profiles.map(p => Math.round((p.size || 0) / 1024 / 1024)),
                backgroundColor: '#36A2EB',
                borderRadius: 4,
            }]
        };
    });

    readonly barOptions = computed(() => {
        const textColor = this.isDarkMode() ? '#e5e7eb' : '#374151';
        const gridColor = this.isDarkMode() ? '#374151' : '#e5e7eb';
        return {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y' as const,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                },
                y: {
                    ticks: { color: textColor },
                    grid: { display: false }
                }
            }
        };
    });

    ngOnInit(): void {
        this.isDarkMode.set(document.documentElement.classList.contains('dark'));
        this.observer = new MutationObserver(() => {
            this.isDarkMode.set(document.documentElement.classList.contains('dark'));
        });
        this.observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }

    ngOnDestroy(): void {
        this.observer?.disconnect();
    }

    // Cleanup Suggestions
    readonly cleanupSuggestions = computed<CleanupSuggestion[]>(() => {
        const suggestions: CleanupSuggestion[] = [];
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        const oneGB = 1024 * 1024 * 1024;

        for (const profile of this.profiles()) {
            // Large profiles (> 1GB)
            if ((profile.size || 0) > oneGB) {
                suggestions.push({
                    type: 'large',
                    profile,
                    reason: `${this.formatSize(profile.size)} - Consider cleaning cache`
                });
            }

            // Unused profiles (not opened in 30 days)
            const lastOpened = profile.metadata?.lastOpened;
            if (!lastOpened || new Date(lastOpened).getTime() < thirtyDaysAgo) {
                suggestions.push({
                    type: 'unused',
                    profile,
                    reason: lastOpened
                        ? `Last used ${this.formatDate(new Date(lastOpened))}`
                        : 'Never used'
                });
            }
        }

        return suggestions.slice(0, 10); // Limit to 10 suggestions
    });

    // Helpers
    formatSize(bytes: number | undefined): string {
        if (!bytes) return '0 MB';
        const gb = bytes / (1024 * 1024 * 1024);
        if (gb >= 1) return `${gb.toFixed(1)} GB`;
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(0)} MB`;
    }

    formatDate(date: Date): string {
        return date.toLocaleDateString();
    }

    goBack(): void {
        this.router.navigate(['/']);
    }

    openProfile(profile: Profile): void {
        this.router.navigate(['/'], { queryParams: { profile: profile.path } });
    }

    async runHealthCheck(): Promise<void> {
        if (this.healthChecking()) return;

        this.healthChecking.set(true);
        this.healthResults.set([]);

        try {
            const profiles = this.profiles();
            const results: HealthCheckResult[] = [];

            // Check each profile
            for (const profile of profiles) {
                const result = await this.profileService.checkProfileHealth(profile.path);
                results.push({
                    profile,
                    isHealthy: result.isHealthy,
                    issues: result.issues,
                    warnings: result.warnings,
                    checkedFiles: result.checkedFiles,
                });
            }

            // Sort: unhealthy first, then by number of issues
            results.sort((a, b) => {
                if (a.isHealthy !== b.isHealthy) return a.isHealthy ? 1 : -1;
                return b.issues.length - a.issues.length;
            });

            this.healthResults.set(results);
        } finally {
            this.healthChecking.set(false);
        }
    }

    readonly healthySummary = computed(() => {
        const results = this.healthResults();
        if (results.length === 0) return null;
        const healthy = results.filter(r => r.isHealthy).length;
        const unhealthy = results.length - healthy;
        return { healthy, unhealthy, total: results.length };
    });
}
