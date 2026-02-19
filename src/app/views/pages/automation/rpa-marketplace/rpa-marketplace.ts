import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { RpaTemplate } from '../../../../models/rpa-template.model';
import { RpaTemplateService, CatalogEntry } from '../../../../services/rpa-template.service';

@Component({
    selector: 'app-rpa-marketplace',
    templateUrl: './rpa-marketplace.html',
    styleUrl: './rpa-marketplace.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [DialogModule, InputTextModule, SelectModule, ButtonModule, FormsModule],
})
export class RpaMarketplace implements OnInit {
    protected readonly templateService = inject(RpaTemplateService);

    protected readonly selectedPlatform = signal('All');
    protected readonly searchQuery = signal('');
    protected readonly sortBy = signal('popular');
    protected readonly selectedTemplate = signal<RpaTemplate | null>(null);
    protected readonly detailVisible = signal(false);
    protected readonly detailLoading = signal(false);

    protected readonly sortOptions = [
        { label: 'Most Popular', value: 'popular' },
        { label: 'Most Recent', value: 'recent' },
        { label: 'Name A-Z', value: 'name' },
    ];

    protected readonly platforms = this.templateService.platforms;

    /** Filtered catalog entries (lightweight, no detail) */
    protected readonly filteredEntries = computed(() =>
        this.templateService.filterCatalog(
            this.selectedPlatform(),
            this.searchQuery(),
            this.sortBy()
        )
    );

    ngOnInit(): void {
        this.templateService.subscribeCatalog();
    }

    selectPlatform(platform: string): void {
        this.selectedPlatform.set(platform);
    }

    onSearch(event: Event): void {
        this.searchQuery.set((event.target as HTMLInputElement).value);
    }

    onSortChange(event: unknown): void {
        this.sortBy.set(event as string);
    }

    /** Open detail dialog — fetches full template from Firestore (1 read, cached) */
    async openDetail(entry: CatalogEntry): Promise<void> {
        this.detailVisible.set(true);
        this.detailLoading.set(true);
        this.selectedTemplate.set(null);

        const detail = await this.templateService.getTemplateDetail(entry.id);
        this.selectedTemplate.set(detail);
        this.detailLoading.set(false);
    }

    closeDetail(): void {
        this.detailVisible.set(false);
    }

    saveProcess(): void {
        const t = this.selectedTemplate();
        if (t) {
            this.templateService.saveTemplate(t.id);
            this.detailVisible.set(false);
        }
    }

    isTemplateSaved(id: string): boolean {
        return this.templateService.isTemplateSaved(id);
    }

    formatCount(count: number): string {
        return this.templateService.formatCount(count);
    }

    getPlatformColor(platform: string): string {
        return this.templateService.getPlatformColor(platform);
    }
}
