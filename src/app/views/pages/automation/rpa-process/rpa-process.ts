import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { RpaTemplateService, CatalogEntry } from '../../../../services/rpa-template.service';

@Component({
    selector: 'app-rpa-process',
    templateUrl: './rpa-process.html',
    styleUrl: './rpa-process.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [ButtonModule, InputTextModule, IconFieldModule, InputIconModule, TooltipModule],
})
export class RpaProcess implements OnInit {
    private readonly templateService = inject(RpaTemplateService);

    protected readonly searchQuery = signal('');

    protected readonly savedEntries = computed(() => {
        const saved = this.templateService.savedEntries();
        const q = this.searchQuery().toLowerCase();
        if (!q) return saved;
        return saved.filter(t =>
            t.title.toLowerCase().includes(q) ||
            t.platform.toLowerCase().includes(q)
        );
    });

    ngOnInit(): void {
        this.templateService.subscribeCatalog();
    }

    onSearch(event: Event): void {
        this.searchQuery.set((event.target as HTMLInputElement).value);
    }

    removeProcess(entry: CatalogEntry): void {
        this.templateService.removeTemplate(entry.id);
    }

    formatDate(dateStr: string): string {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    getPlatformColor(platform: string): string {
        return this.templateService.getPlatformColor(platform);
    }
}
