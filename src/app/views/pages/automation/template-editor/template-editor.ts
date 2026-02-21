import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import {
    RpaTemplate, RpaTemplateStep, RpaTemplateVariable,
    RPA_PLATFORMS,
} from '../../../../models/rpa-template.model';
import { RpaTemplateService } from '../../../../services/rpa-template.service';

/** Platform icon mapping */
const PLATFORM_ICONS: Record<string, string> = {
    Facebook: 'pi-facebook', TikTok: 'pi-tiktok', 'Twitter/X': 'pi-twitter',
    Instagram: 'pi-instagram', LinkedIn: 'pi-linkedin', Amazon: 'pi-amazon',
    Shopee: 'pi-shopping-bag', Reddit: 'pi-reddit', YouTube: 'pi-youtube',
    Gmail: 'pi-envelope', Etsy: 'pi-shopping-cart', Mercari: 'pi-tag',
    Poshmark: 'pi-heart', Other: 'pi-cog',
};

/** Step action options */
const STEP_ACTIONS = [
    { label: 'Navigate', value: 'navigate' },
    { label: 'Click', value: 'click' },
    { label: 'Type', value: 'type' },
    { label: 'Scroll', value: 'scroll' },
    { label: 'Wait', value: 'wait' },
    { label: 'Extract', value: 'extract' },
    { label: 'Loop', value: 'loop' },
    { label: 'AI', value: 'ai' },
    { label: 'Export', value: 'export' },
];

/** Variable type options */
const VARIABLE_TYPES = [
    { label: 'String', value: 'string' },
    { label: 'Number', value: 'number' },
    { label: 'Boolean', value: 'boolean' },
];

@Component({
    selector: 'app-template-editor',
    templateUrl: './template-editor.html',
    styleUrl: './template-editor.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [
        FormsModule, ButtonModule, InputTextModule, SelectModule,
        ToggleSwitchModule, TooltipModule,
    ],
})
export class TemplateEditor implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly templateService = inject(RpaTemplateService);
    private readonly messageService = inject(MessageService);

    // Template data
    protected readonly template = signal<RpaTemplate | null>(null);
    protected readonly isNew = signal(true);
    protected readonly saving = signal(false);

    // Editor mode: form or json
    protected readonly jsonMode = signal(false);
    protected readonly jsonText = signal('');
    protected readonly jsonError = signal('');

    // Tag input
    protected readonly newTag = signal('');

    // Options for selects
    protected readonly platformOptions = RPA_PLATFORMS.filter(p => p !== 'All')
        .map(p => ({ label: p, value: p }));
    protected readonly stepActions = STEP_ACTIONS;
    protected readonly variableTypes = VARIABLE_TYPES;

    // Derived
    protected readonly title = computed(() => {
        const t = this.template();
        return t?.metadata.title || 'Untitled Template';
    });

    protected readonly isValid = computed(() => {
        const t = this.template();
        if (!t) return false;
        return t.metadata.title.trim().length > 0;
    });

    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id');
        if (id === 'new' || !id) {
            const blank = this.templateService.createBlankTemplate();
            this.template.set(blank);
            this.isNew.set(true);
        } else {
            const existing = this.templateService.getCustomTemplate(id);
            if (existing) {
                // Deep clone to avoid mutating the original
                this.template.set(JSON.parse(JSON.stringify(existing)));
                this.isNew.set(false);
            } else {
                // Template not found, redirect back
                this.router.navigate(['/automation/my-templates']);
                return;
            }
        }
    }

    // --- Metadata ---

    updateField(field: string, value: string): void {
        const t = this.template();
        if (!t) return;
        const updated = {
            ...t,
            metadata: { ...t.metadata, [field]: value },
        };
        // Auto-set platform icon
        if (field === 'platform') {
            updated.metadata.platformIcon = PLATFORM_ICONS[value] || 'pi-cog';
        }
        this.template.set(updated);
    }

    updateOverview(value: string): void {
        const t = this.template();
        if (!t) return;
        this.template.set({ ...t, overview: value });
    }

    updateRequirementsNote(value: string): void {
        const t = this.template();
        if (!t) return;
        this.template.set({ ...t, requirements: { ...t.requirements, note: value } });
    }

    // --- Tags ---

    addTag(): void {
        const tag = this.newTag().trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (!tag) return;
        const t = this.template();
        if (!t || t.metadata.tags.includes(tag)) {
            this.newTag.set('');
            return;
        }
        this.template.set({
            ...t,
            metadata: { ...t.metadata, tags: [...t.metadata.tags, tag] },
        });
        this.newTag.set('');
    }

    removeTag(tag: string): void {
        const t = this.template();
        if (!t) return;
        this.template.set({
            ...t,
            metadata: { ...t.metadata, tags: t.metadata.tags.filter(tg => tg !== tag) },
        });
    }

    // --- Steps ---

    addStep(): void {
        const t = this.template();
        if (!t) return;
        const newStep: RpaTemplateStep = {
            order: t.steps.length + 1,
            action: 'click',
            description: '',
        };
        this.template.set({ ...t, steps: [...t.steps, newStep] });
    }

    removeStep(index: number): void {
        const t = this.template();
        if (!t) return;
        const steps = t.steps.filter((_, i) => i !== index)
            .map((s, i) => ({ ...s, order: i + 1 }));
        this.template.set({ ...t, steps });
    }

    moveStep(index: number, direction: -1 | 1): void {
        const t = this.template();
        if (!t) return;
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= t.steps.length) return;
        const steps = [...t.steps];
        [steps[index], steps[newIndex]] = [steps[newIndex], steps[index]];
        this.template.set({
            ...t,
            steps: steps.map((s, i) => ({ ...s, order: i + 1 })),
        });
    }

    updateStep(index: number, field: keyof RpaTemplateStep, value: unknown): void {
        const t = this.template();
        if (!t) return;
        const steps = [...t.steps];
        steps[index] = { ...steps[index], [field]: value };
        this.template.set({ ...t, steps });
    }

    // --- Variables ---

    addVariable(): void {
        const t = this.template();
        if (!t) return;
        const newVar: RpaTemplateVariable = {
            name: '',
            type: 'string',
            required: true,
            description: '',
        };
        this.template.set({ ...t, variables: [...t.variables, newVar] });
    }

    removeVariable(index: number): void {
        const t = this.template();
        if (!t) return;
        this.template.set({
            ...t,
            variables: t.variables.filter((_, i) => i !== index),
        });
    }

    updateVariable(index: number, field: keyof RpaTemplateVariable, value: unknown): void {
        const t = this.template();
        if (!t) return;
        const variables = [...t.variables];
        variables[index] = { ...variables[index], [field]: value };
        this.template.set({ ...t, variables });
    }

    // --- JSON Mode ---

    toggleJsonMode(): void {
        const t = this.template();
        if (!t) return;

        if (!this.jsonMode()) {
            // Switch to JSON mode
            this.jsonText.set(JSON.stringify(t, null, 2));
            this.jsonError.set('');
            this.jsonMode.set(true);
        } else {
            // Switch back to form mode
            this.applyJsonChanges();
        }
    }

    onJsonChange(value: string): void {
        this.jsonText.set(value);
        // Validate on change
        try {
            JSON.parse(value);
            this.jsonError.set('');
        } catch (e: unknown) {
            this.jsonError.set(e instanceof Error ? e.message : 'Invalid JSON');
        }
    }

    private applyJsonChanges(): void {
        try {
            const parsed = JSON.parse(this.jsonText());
            if (parsed && parsed.metadata && parsed.steps && parsed.variables) {
                // Keep the original ID
                const current = this.template();
                parsed.id = current?.id || parsed.id;
                this.template.set(parsed);
                this.jsonMode.set(false);
                this.jsonError.set('');
            } else {
                this.jsonError.set('Invalid template structure: must have metadata, steps, and variables');
            }
        } catch (e: unknown) {
            this.jsonError.set(e instanceof Error ? e.message : 'Invalid JSON');
        }
    }

    // --- Save / Cancel ---

    save(): void {
        const t = this.template();
        if (!t || !this.isValid()) return;

        // If in JSON mode, apply changes first
        if (this.jsonMode()) {
            this.applyJsonChanges();
            if (this.jsonError()) return;
        }

        const current = this.template();
        if (!current) return;

        this.saving.set(true);
        this.templateService.saveCustomTemplate(current);
        this.messageService.add({
            severity: 'success',
            summary: this.isNew() ? 'Created' : 'Saved',
            detail: `"${current.metadata.title}" saved successfully`,
        });
        this.saving.set(false);
        this.router.navigate(['/automation/my-templates']);
    }

    cancel(): void {
        this.router.navigate(['/automation/my-templates']);
    }
}
