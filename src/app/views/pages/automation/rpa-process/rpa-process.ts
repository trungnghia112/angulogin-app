import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

interface RpaProcessItem {
    id: string;
    name: string;
    platform: string;
    source: 'marketplace' | 'created' | 'imported';
    status: 'ready' | 'running' | 'error';
    lastRun: string | null;
    totalRuns: number;
    createdAt: string;
}

const MOCK_PROCESSES: RpaProcessItem[] = [
    {
        id: 'proc-001', name: 'TikTok Search & Comment Like', platform: 'TikTok',
        source: 'marketplace', status: 'ready', lastRun: '2026-02-19T10:30:00Z', totalRuns: 12, createdAt: '2026-02-15T08:00:00Z',
    },
    {
        id: 'proc-002', name: 'FB Add Suggested Friends', platform: 'Facebook',
        source: 'marketplace', status: 'ready', lastRun: '2026-02-18T14:00:00Z', totalRuns: 5, createdAt: '2026-02-16T10:00:00Z',
    },
    {
        id: 'proc-003', name: 'Custom Login Flow', platform: 'Other',
        source: 'created', status: 'ready', lastRun: null, totalRuns: 0, createdAt: '2026-02-19T09:00:00Z',
    },
    {
        id: 'proc-004', name: 'LinkedIn Auto Connect', platform: 'LinkedIn',
        source: 'marketplace', status: 'error', lastRun: '2026-02-17T16:30:00Z', totalRuns: 3, createdAt: '2026-02-14T12:00:00Z',
    },
    {
        id: 'proc-005', name: 'Etsy Browse Products', platform: 'Etsy',
        source: 'imported', status: 'ready', lastRun: '2026-02-19T08:00:00Z', totalRuns: 28, createdAt: '2026-02-10T07:00:00Z',
    },
];

@Component({
    selector: 'app-rpa-process',
    templateUrl: './rpa-process.html',
    styleUrl: './rpa-process.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [ButtonModule, InputTextModule, TagModule, TooltipModule],
})
export class RpaProcess {
    protected readonly activeTab = signal<'all' | 'created' | 'marketplace' | 'imported'>('all');
    protected readonly searchQuery = signal('');

    protected readonly filteredProcesses = computed(() => {
        let list = [...MOCK_PROCESSES];
        const tab = this.activeTab();
        if (tab !== 'all') {
            list = list.filter(p => p.source === tab);
        }
        const q = this.searchQuery().toLowerCase();
        if (q) {
            list = list.filter(p => p.name.toLowerCase().includes(q) || p.platform.toLowerCase().includes(q));
        }
        return list;
    });

    protected readonly tabs = [
        { id: 'all' as const, label: 'All sources' },
        { id: 'created' as const, label: 'Created by me' },
        { id: 'marketplace' as const, label: 'From Marketplace' },
        { id: 'imported' as const, label: 'Imported' },
    ];

    selectTab(tab: 'all' | 'created' | 'marketplace' | 'imported'): void {
        this.activeTab.set(tab);
    }

    onSearch(event: Event): void {
        this.searchQuery.set((event.target as HTMLInputElement).value);
    }

    getStatusSeverity(status: string): 'success' | 'danger' | 'info' {
        switch (status) {
            case 'running': return 'info';
            case 'error': return 'danger';
            default: return 'success';
        }
    }

    getSourceLabel(source: string): string {
        switch (source) {
            case 'marketplace': return 'Marketplace';
            case 'created': return 'Created';
            case 'imported': return 'Imported';
            default: return source;
        }
    }

    formatDate(dateStr: string | null): string {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
}
