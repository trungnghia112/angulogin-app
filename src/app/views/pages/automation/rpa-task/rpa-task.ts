import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { ProgressBarModule } from 'primeng/progressbar';
import { FormsModule } from '@angular/forms';
import { RpaExecutorService } from '../../../../services/rpa-executor.service';
import { RpaTemplateService } from '../../../../services/rpa-template.service';
import { ProfileService } from '../../../../services/profile.service';
import { RpaTaskStatus } from '../../../../models/rpa-template.model';

@Component({
    selector: 'app-rpa-task',
    templateUrl: './rpa-task.html',
    styleUrl: './rpa-task.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [ButtonModule, InputTextModule, TagModule, TooltipModule, DialogModule, SelectModule, ProgressBarModule, FormsModule, DatePipe],
})
export class RpaTask implements OnInit {
    private readonly executor = inject(RpaExecutorService);
    private readonly templateService = inject(RpaTemplateService);
    private readonly profileService = inject(ProfileService);
    private readonly route = inject(ActivatedRoute);
    private readonly destroyRef = inject(DestroyRef);

    // --- Tabs & Filters ---
    protected readonly activeTab = signal<'all' | 'active' | 'history'>('all');
    protected readonly searchQuery = signal('');

    // --- Create Task Dialog ---
    protected readonly showCreateDialog = signal(false);
    protected readonly selectedTemplateId = signal<string | null>(null);
    protected readonly selectedProfilePath = signal<string | null>(null);
    protected readonly selectedBrowser = signal('chrome');
    protected readonly templateVariables = signal<Record<string, string | number | boolean>>({});

    // --- Log Viewer ---
    protected readonly showLogDialog = signal(false);
    protected readonly viewingTaskId = signal<string | null>(null);

    // --- Data from executor ---
    protected readonly tasks = this.executor.tasks;

    protected readonly filteredTasks = computed(() => {
        let list = [...this.tasks()];
        const tab = this.activeTab();
        if (tab === 'active') {
            list = list.filter(t => t.status === 'running' || t.status === 'paused' || t.status === 'pending');
        } else if (tab === 'history') {
            list = list.filter(t => ['completed', 'failed', 'cancelled'].includes(t.status));
        }
        const q = this.searchQuery().toLowerCase();
        if (q) {
            list = list.filter(t => t.templateTitle.toLowerCase().includes(q));
        }
        return list;
    });

    protected readonly tabs = [
        { id: 'all' as const, label: 'All tasks' },
        { id: 'active' as const, label: 'Active' },
        { id: 'history' as const, label: 'History' },
    ];

    // --- Available templates & profiles for Create dialog ---
    protected readonly savedTemplates = computed(() => {
        const entries = this.templateService.savedEntries();
        return entries.map(e => ({
            label: e.title,
            value: e.id,
        }));
    });

    protected readonly availableProfiles = computed(() => {
        return this.profileService.profiles().map(p => ({
            label: p.name,
            value: p.path,
        }));
    });

    protected readonly viewingTaskLogs = computed(() => {
        const taskId = this.viewingTaskId();
        if (!taskId) return [];
        const task = this.tasks().find(t => t.id === taskId);
        return task?.logs || [];
    });

    // --- Actions ---

    ngOnInit(): void {
        this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
            const templateId = params['templateId'];
            if (templateId) {
                this.selectedTemplateId.set(templateId);
                this.selectedProfilePath.set(null);
                this.selectedBrowser.set('chrome');
                this.onTemplateSelected();
                this.showCreateDialog.set(true);
            }
        });
    }

    selectTab(tab: 'all' | 'active' | 'history'): void {
        this.activeTab.set(tab);
    }

    onSearch(event: Event): void {
        this.searchQuery.set((event.target as HTMLInputElement).value);
    }

    openCreateDialog(): void {
        this.selectedTemplateId.set(null);
        this.selectedProfilePath.set(null);
        this.selectedBrowser.set('chrome');
        this.templateVariables.set({});
        this.showCreateDialog.set(true);
    }

    async startTask(): Promise<void> {
        const templateId = this.selectedTemplateId();
        const profilePath = this.selectedProfilePath();
        if (!templateId || !profilePath) return;

        const template = await this.templateService.getTemplateDetail(templateId);
        if (!template) return;

        const profile = this.profileService.profiles().find(p => p.path === profilePath);
        const profileName = profile?.name || 'Unknown';

        // Merge default variable values
        const variables = { ...this.templateVariables() };
        for (const v of template.variables || []) {
            if (variables[v.name] === undefined && v.default !== undefined) {
                variables[v.name] = v.default;
            }
        }

        this.executor.startTask(
            template,
            profilePath,
            profileName,
            this.selectedBrowser(),
            variables,
        );

        this.showCreateDialog.set(false);
        this.activeTab.set('active');
    }

    cancelTask(taskId: string): void {
        this.executor.cancelTask(taskId);
    }

    removeTask(taskId: string): void {
        this.executor.removeTask(taskId);
    }

    viewLogs(taskId: string): void {
        this.viewingTaskId.set(taskId);
        this.showLogDialog.set(true);
    }

    // --- Helpers ---

    getStatusSeverity(status: RpaTaskStatus): 'success' | 'danger' | 'info' | 'warn' | 'secondary' {
        switch (status) {
            case 'running': return 'info';
            case 'completed': return 'success';
            case 'failed': return 'danger';
            case 'paused': return 'warn';
            case 'cancelled': return 'secondary';
            default: return 'secondary';
        }
    }





    onTemplateSelected(): void {
        const id = this.selectedTemplateId();
        if (!id) return;
        // Pre-load template detail for variables
        this.templateService.getTemplateDetail(id).then(detail => {
            if (detail?.variables) {
                const vars: Record<string, string | number | boolean> = {};
                for (const v of detail.variables) {
                    if (v.default !== undefined) {
                        vars[v.name] = v.default;
                    }
                }
                this.templateVariables.set(vars);
            }
        });
    }
}
