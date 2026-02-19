import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

interface RpaTaskItem {
    id: string;
    processName: string;
    profileCount: number;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'scheduled';
    frequency: 'once' | 'daily' | 'weekly' | 'custom';
    startTime: string;
    endTime: string | null;
    progress: number; // 0-100
}

const MOCK_TASKS: RpaTaskItem[] = [
    {
        id: 'task-001', processName: 'TikTok Search & Comment Like', profileCount: 5,
        status: 'completed', frequency: 'once', startTime: '2026-02-19T10:30:00Z', endTime: '2026-02-19T10:45:00Z', progress: 100,
    },
    {
        id: 'task-002', processName: 'FB Add Suggested Friends', profileCount: 3,
        status: 'running', frequency: 'once', startTime: '2026-02-19T15:00:00Z', endTime: null, progress: 60,
    },
    {
        id: 'task-003', processName: 'LinkedIn Auto Connect', profileCount: 10,
        status: 'scheduled', frequency: 'daily', startTime: '2026-02-20T09:00:00Z', endTime: null, progress: 0,
    },
    {
        id: 'task-004', processName: 'Etsy Browse Products', profileCount: 8,
        status: 'failed', frequency: 'once', startTime: '2026-02-19T08:00:00Z', endTime: '2026-02-19T08:12:00Z', progress: 37,
    },
    {
        id: 'task-005', processName: 'TikTok Search & Comment Like', profileCount: 2,
        status: 'pending', frequency: 'weekly', startTime: '2026-02-21T14:00:00Z', endTime: null, progress: 0,
    },
];

@Component({
    selector: 'app-rpa-task',
    templateUrl: './rpa-task.html',
    styleUrl: './rpa-task.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [ButtonModule, InputTextModule, TagModule, TooltipModule],
})
export class RpaTask {
    protected readonly activeTab = signal<'all' | 'regular' | 'scheduled'>('all');
    protected readonly searchQuery = signal('');

    protected readonly filteredTasks = computed(() => {
        let list = [...MOCK_TASKS];
        const tab = this.activeTab();
        if (tab === 'regular') {
            list = list.filter(t => t.frequency === 'once');
        } else if (tab === 'scheduled') {
            list = list.filter(t => t.frequency !== 'once');
        }
        const q = this.searchQuery().toLowerCase();
        if (q) {
            list = list.filter(t => t.processName.toLowerCase().includes(q));
        }
        return list;
    });

    protected readonly tabs = [
        { id: 'all' as const, label: 'All tasks' },
        { id: 'regular' as const, label: 'Regular task' },
        { id: 'scheduled' as const, label: 'Scheduled task' },
    ];

    selectTab(tab: 'all' | 'regular' | 'scheduled'): void {
        this.activeTab.set(tab);
    }

    onSearch(event: Event): void {
        this.searchQuery.set((event.target as HTMLInputElement).value);
    }

    getStatusSeverity(status: string): 'success' | 'danger' | 'info' | 'warn' | 'secondary' {
        switch (status) {
            case 'running': return 'info';
            case 'completed': return 'success';
            case 'failed': return 'danger';
            case 'scheduled': return 'warn';
            default: return 'secondary';
        }
    }

    formatDate(dateStr: string | null): string {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    getFrequencyLabel(freq: string): string {
        switch (freq) {
            case 'daily': return 'Daily';
            case 'weekly': return 'Weekly';
            case 'custom': return 'Custom';
            default: return 'Once';
        }
    }
}
