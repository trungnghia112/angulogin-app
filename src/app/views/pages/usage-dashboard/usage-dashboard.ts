import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';

import { ProfileService } from '../../../services/profile.service';
import { ActivityLogService, ActivityEntry } from '../../../services/activity-log.service';
import { Profile } from '../../../models/profile.model';

@Component({
    selector: 'app-usage-dashboard',
    templateUrl: './usage-dashboard.html',
    styleUrl: './usage-dashboard.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [CommonModule, ChartModule, ButtonModule, TooltipModule, TableModule],
})
export class UsageDashboard {
    private readonly profileService = inject(ProfileService);
    private readonly activityLogService = inject(ActivityLogService);
    private readonly router = inject(Router);

    // Data
    readonly profiles = this.profileService.profiles;
    readonly activityLog = this.activityLogService.entries;

    // Summary Stats
    readonly totalLaunches = computed(() =>
        this.profiles().reduce((sum, p) => sum + (p.metadata?.launchCount || 0), 0)
    );

    readonly totalUsageMinutes = computed(() =>
        this.profiles().reduce((sum, p) => sum + (p.metadata?.totalUsageMinutes || 0), 0)
    );

    readonly mostUsedProfile = computed(() => {
        const sorted = [...this.profiles()].sort(
            (a, b) => (b.metadata?.launchCount || 0) - (a.metadata?.launchCount || 0)
        );
        return sorted[0] || null;
    });

    readonly todayLaunches = computed(() =>
        this.activityLogService.todayEntries().filter(e => e.type === 'launch').length
    );

    // Top profiles by launch count
    readonly topProfilesByLaunches = computed(() =>
        [...this.profiles()]
            .filter(p => (p.metadata?.launchCount || 0) > 0)
            .sort((a, b) => (b.metadata?.launchCount || 0) - (a.metadata?.launchCount || 0))
            .slice(0, 10)
    );

    // Top profiles by usage time
    readonly topProfilesByUsage = computed(() =>
        [...this.profiles()]
            .filter(p => (p.metadata?.totalUsageMinutes || 0) > 0)
            .sort((a, b) => (b.metadata?.totalUsageMinutes || 0) - (a.metadata?.totalUsageMinutes || 0))
            .slice(0, 10)
    );

    // Recent activity
    readonly recentActivity = computed(() =>
        this.activityLog().slice(0, 15)
    );

    // Bar Chart - Launches by Profile
    readonly launchesChartData = computed(() => {
        const profiles = this.topProfilesByLaunches();
        return {
            labels: profiles.map(p => p.name.length > 15 ? p.name.substring(0, 12) + '...' : p.name),
            datasets: [{
                label: 'Launches',
                data: profiles.map(p => p.metadata?.launchCount || 0),
                backgroundColor: '#36A2EB',
                borderRadius: 4,
            }]
        };
    });

    readonly launchesChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y' as const,
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: {
                ticks: { color: 'var(--p-text-color)' },
                grid: { color: 'var(--p-surface-border)' }
            },
            y: {
                ticks: { color: 'var(--p-text-color)' },
                grid: { display: false }
            }
        }
    };

    // Pie Chart - Usage distribution
    readonly usageChartData = computed(() => {
        const profiles = this.topProfilesByUsage();
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#7BC043', '#EE4035'
        ];
        return {
            labels: profiles.map(p => p.name),
            datasets: [{
                data: profiles.map(p => p.metadata?.totalUsageMinutes || 0),
                backgroundColor: colors.slice(0, profiles.length),
                hoverBackgroundColor: colors.slice(0, profiles.length),
            }]
        };
    });

    readonly usageChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right' as const,
                labels: {
                    usePointStyle: true,
                    color: 'var(--p-text-color)'
                }
            },
            tooltip: {
                callbacks: {
                    label: (context: { label?: string; raw?: number }) =>
                        `${context.label}: ${this.formatMinutes(context.raw || 0)}`
                }
            }
        }
    };

    // Activity heatmap data (last 7 days)
    readonly weeklyActivity = computed(() => {
        const days: { date: string; count: number; label: string }[] = [];
        const now = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();
            const count = this.activityLog().filter(e =>
                new Date(e.timestamp).toDateString() === dateStr
            ).length;
            days.push({
                date: dateStr,
                count,
                label: date.toLocaleDateString('en-US', { weekday: 'short' })
            });
        }
        return days;
    });

    // Helpers
    formatMinutes(minutes: number): string {
        if (!minutes) return '0m';
        if (minutes < 60) return `${Math.round(minutes)}m`;
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }

    formatTimestamp(timestamp: string): string {
        return this.activityLogService.formatTimestamp(timestamp);
    }

    getTypeIcon(type: ActivityEntry['type']): string {
        return this.activityLogService.getTypeIcon(type);
    }

    getTypeLabel(type: ActivityEntry['type']): string {
        return this.activityLogService.getTypeLabel(type);
    }

    goBack(): void {
        this.router.navigate(['/']);
    }

    openProfile(profile: Profile): void {
        this.router.navigate(['/'], { queryParams: { profile: profile.path } });
    }

    exportToCSV(): void {
        const profiles = this.profiles();
        const activity = this.activityLog();

        // Create CSV content
        let csv = 'Profile Usage Statistics\n';
        csv += 'Profile Name,Launch Count,Total Usage (minutes),Last Opened\n';

        for (const p of profiles) {
            const name = p.name.replace(/,/g, ' ');
            const launches = p.metadata?.launchCount || 0;
            const usage = p.metadata?.totalUsageMinutes || 0;
            const lastOpened = p.metadata?.lastOpened || 'Never';
            csv += `${name},${launches},${usage},${lastOpened}\n`;
        }

        csv += '\nActivity Log\n';
        csv += 'Timestamp,Type,Profile Name,Browser,Details\n';

        for (const a of activity) {
            const timestamp = new Date(a.timestamp).toISOString();
            const type = a.type;
            const name = a.profileName.replace(/,/g, ' ');
            const browser = a.browser || '';
            const details = (a.details || '').replace(/,/g, ' ');
            csv += `${timestamp},${type},${name},${browser},${details}\n`;
        }

        // Download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `usage-report-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }
}
