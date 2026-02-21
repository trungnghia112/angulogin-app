import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { RpaTemplate } from '../../../../models/rpa-template.model';
import { RpaTemplateService } from '../../../../services/rpa-template.service';

@Component({
    selector: 'app-my-templates',
    templateUrl: './my-templates.html',
    styleUrl: './my-templates.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [
        ButtonModule, InputTextModule, IconFieldModule, InputIconModule,
        TooltipModule,
    ],
})
export class MyTemplates {
    private readonly templateService = inject(RpaTemplateService);
    private readonly router = inject(Router);
    private readonly messageService = inject(MessageService);
    private readonly confirmationService = inject(ConfirmationService);

    protected readonly searchQuery = signal('');

    protected readonly filteredTemplates = computed(() => {
        const templates = this.templateService.customTemplates();
        const q = this.searchQuery().toLowerCase();
        if (!q) return templates;
        return templates.filter(t =>
            t.metadata.title.toLowerCase().includes(q) ||
            t.metadata.platform.toLowerCase().includes(q) ||
            t.metadata.tags.some(tag => tag.toLowerCase().includes(q))
        );
    });

    protected readonly templateCount = computed(() => this.templateService.customTemplates().length);

    onSearch(event: Event): void {
        this.searchQuery.set((event.target as HTMLInputElement).value);
    }

    createNew(): void {
        this.router.navigate(['/automation/template-editor', 'new']);
    }

    editTemplate(template: RpaTemplate): void {
        this.router.navigate(['/automation/template-editor', template.id]);
    }

    duplicateTemplate(template: RpaTemplate): void {
        const copy = this.templateService.duplicateTemplate(template);
        this.templateService.saveCustomTemplate(copy);
        this.messageService.add({
            severity: 'success',
            summary: 'Duplicated',
            detail: `"${copy.metadata.title}" created`,
        });
    }

    exportTemplate(template: RpaTemplate): void {
        this.templateService.exportTemplateAsJson(template);
    }

    confirmDelete(template: RpaTemplate): void {
        this.confirmationService.confirm({
            key: 'confirmDialog',
            header: 'Delete Template',
            message: `Are you sure you want to delete "${template.metadata.title}"?`,
            icon: 'pi pi-trash',
            acceptButtonProps: { severity: 'danger', label: 'Delete' },
            rejectButtonProps: { severity: 'secondary', label: 'Cancel' },
            accept: () => {
                this.templateService.deleteCustomTemplate(template.id);
                this.messageService.add({
                    severity: 'success',
                    summary: 'Deleted',
                    detail: `"${template.metadata.title}" removed`,
                });
            },
        });
    }

    async onImportFile(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        const template = await this.templateService.importTemplateFromFile(file);
        if (template) {
            this.templateService.saveCustomTemplate(template);
            this.messageService.add({
                severity: 'success',
                summary: 'Imported',
                detail: `"${template.metadata.title}" imported successfully`,
            });
        } else {
            this.messageService.add({
                severity: 'error',
                summary: 'Import Failed',
                detail: 'Invalid template file. Ensure it is a valid JSON template (max 1MB).',
            });
        }
        // Reset file input
        input.value = '';
    }

    getPlatformColor(platform: string): string {
        return this.templateService.getPlatformColor(platform);
    }

    formatDate(dateStr: string): string {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}
