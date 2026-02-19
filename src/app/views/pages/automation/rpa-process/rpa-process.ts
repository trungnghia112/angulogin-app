import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { RpaTemplate } from '../../../../models/rpa-template.model';
import { RpaTemplateService } from '../../../../services/rpa-template.service';

@Component({
    selector: 'app-rpa-process',
    templateUrl: './rpa-process.html',
    styleUrl: './rpa-process.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [ButtonModule, InputTextModule, TagModule, TooltipModule],
})
export class RpaProcess implements OnInit {
    private readonly templateService = inject(RpaTemplateService);

    protected readonly searchQuery = signal('');

    protected readonly savedTemplates = computed(() => {
        const saved = this.templateService.savedTemplates();
        const q = this.searchQuery().toLowerCase();
        if (!q) return saved;
        return saved.filter(t =>
            t.metadata.title.toLowerCase().includes(q) ||
            t.metadata.platform.toLowerCase().includes(q)
        );
    });

    ngOnInit(): void {
        this.templateService.loadTemplates();
    }

    onSearch(event: Event): void {
        this.searchQuery.set((event.target as HTMLInputElement).value);
    }

    removeProcess(template: RpaTemplate): void {
        this.templateService.removeTemplate(template.id);
    }

    formatDate(dateStr: string): string {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    getPlatformColor(platform: string): string {
        return this.templateService.getPlatformColor(platform);
    }
}
