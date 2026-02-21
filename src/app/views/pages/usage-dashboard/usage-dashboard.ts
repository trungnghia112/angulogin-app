import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
    imports: [ChartModule, ButtonModule, TooltipModule, TableModule],
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

    // GitHub-style yearly heatmap (Feature 9.2)
    readonly yearlyHeatmap = computed(() => {
        const weeks: { date: Date; count: number }[][] = [];
        const now = new Date();
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        oneYearAgo.setDate(oneYearAgo.getDate() + 1); // Start from tomorrow last year

        // Align to Sunday (start of week)
        const startDay = oneYearAgo.getDay();
        if (startDay !== 0) {
            oneYearAgo.setDate(oneYearAgo.getDate() - startDay);
        }

        // Build activity count map by date string
        const activityMap = new Map<string, number>();
        for (const entry of this.activityLog()) {
            const dateStr = new Date(entry.timestamp).toDateString();
            activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1);
        }

        // Generate days
        let currentDate = new Date(oneYearAgo);
        let currentWeek: { date: Date; count: number }[] = [];

        while (currentDate <= now) {
            const count = activityMap.get(currentDate.toDateString()) || 0;
            currentWeek.push({ date: new Date(currentDate), count });

            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Push remaining days
        if (currentWeek.length > 0) {
            weeks.push(currentWeek);
        }

        return weeks;
    });

    // Month labels for yearly heatmap
    readonly heatmapMonths = computed(() => {
        const weeks = this.yearlyHeatmap();
        const months: { label: string; weekIndex: number }[] = [];
        let lastMonth = -1;

        for (let i = 0; i < weeks.length; i++) {
            const firstDay = weeks[i][0];
            if (firstDay) {
                const month = firstDay.date.getMonth();
                if (month !== lastMonth) {
                    months.push({
                        label: firstDay.date.toLocaleDateString('en-US', { month: 'short' }),
                        weekIndex: i
                    });
                    lastMonth = month;
                }
            }
        }

        return months;
    });

    // Max activity count for scaling heatmap colors
    readonly maxDailyActivity = computed(() => {
        let max = 0;
        for (const week of this.yearlyHeatmap()) {
            for (const day of week) {
                if (day.count > max) max = day.count;
            }
        }
        return Math.max(max, 1); // Avoid division by zero
    });

    // Helpers
    getHeatmapColor(count: number): string {
        if (count === 0) return 'bg-surface-100 dark:bg-surface-800';
        const max = this.maxDailyActivity();
        const intensity = count / max;
        if (intensity <= 0.25) return 'bg-green-200 dark:bg-green-900';
        if (intensity <= 0.5) return 'bg-green-400 dark:bg-green-700';
        if (intensity <= 0.75) return 'bg-green-500 dark:bg-green-600';
        return 'bg-green-600 dark:bg-green-500';
    }

    getHeatmapTooltip(day: { date: Date; count: number }): string {
        const dateStr = day.date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        if (day.count === 0) return `${dateStr}: No activity`;
        const s = day.count === 1 ? '' : 's';
        return `${dateStr}: ${day.count} action${s}`;
    }

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

        // CSV-safe: escape formula injection chars and quote fields
        const csvSafe = (val: string): string => {
            let s = val.replace(/"/g, '""');
            // Prevent formula injection (=, +, -, @, \t, \r)
            if (/^[=+\-@\t\r]/.test(s)) {
                s = "'" + s;
            }
            return `"${s}"`;
        };

        // Create CSV content
        let csv = 'Profile Usage Statistics\n';
        csv += 'Profile Name,Launch Count,Total Usage (minutes),Last Opened\n';

        for (const p of profiles) {
            const name = csvSafe(p.name);
            const launches = p.metadata?.launchCount || 0;
            const usage = p.metadata?.totalUsageMinutes || 0;
            const lastOpened = p.metadata?.lastOpened || 'Never';
            csv += `${name},${launches},${usage},${csvSafe(lastOpened)}\n`;
        }

        csv += '\nActivity Log\n';
        csv += 'Timestamp,Type,Profile Name,Browser,Details\n';

        for (const a of activity) {
            const timestamp = new Date(a.timestamp).toISOString();
            const type = a.type;
            const name = csvSafe(a.profileName);
            const browser = a.browser || '';
            const details = csvSafe(a.details || '');
            csv += `${csvSafe(timestamp)},${csvSafe(type)},${name},${csvSafe(browser)},${details}\n`;
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
