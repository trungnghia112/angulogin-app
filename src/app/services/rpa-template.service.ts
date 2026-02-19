import { Injectable, signal, computed } from '@angular/core';
import { RpaTemplate, PLATFORM_COLORS, RPA_PLATFORMS } from '../models/rpa-template.model';

/**
 * RPA Template Service
 *
 * Manages loading, caching, filtering, and searching of RPA templates.
 * Phase 1: Loads from local assets/rpa-templates/templates.json
 * Phase 2: Will fetch from remote CDN with local cache fallback.
 */
@Injectable({ providedIn: 'root' })
export class RpaTemplateService {
    /** All available templates */
    private readonly _templates = signal<RpaTemplate[]>([]);
    readonly templates = this._templates.asReadonly();

    /** Whether templates have been loaded */
    private readonly _loaded = signal(false);
    readonly loaded = this._loaded.asReadonly();

    /** Loading state */
    private readonly _loading = signal(false);
    readonly loading = this._loading.asReadonly();

    /** Saved (acquired) templates stored in localStorage */
    private readonly _savedTemplateIds = signal<Set<string>>(new Set());

    /** Platform list for UI */
    readonly platforms = RPA_PLATFORMS;
    readonly platformColors = PLATFORM_COLORS;

    /** Derived: saved templates */
    readonly savedTemplates = computed(() => {
        const ids = this._savedTemplateIds();
        return this._templates().filter(t => ids.has(t.id));
    });

    constructor() {
        this.loadSavedIds();
    }

    /** Load templates from assets (Phase 1) or remote (Phase 2) */
    async loadTemplates(): Promise<void> {
        if (this._loaded() || this._loading()) return;

        this._loading.set(true);
        try {
            // Phase 1: Local asset
            const response = await fetch('assets/rpa-templates/templates.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data: RpaTemplate[] = await response.json();
            this._templates.set(data);
            this._loaded.set(true);
        } catch (err) {
            console.error('[RpaTemplateService] Failed to load templates:', err);
            // Fallback: try localStorage cache
            const cached = localStorage.getItem('rpa-templates-cache');
            if (cached) {
                try {
                    this._templates.set(JSON.parse(cached));
                    this._loaded.set(true);
                } catch {
                    // ignore parse errors
                }
            }
        } finally {
            this._loading.set(false);
        }

        // Cache for offline
        if (this._loaded()) {
            localStorage.setItem('rpa-templates-cache', JSON.stringify(this._templates()));
        }
    }

    /** Filter templates by platform and search query */
    filterTemplates(platform: string, query: string, sort: string): RpaTemplate[] {
        let list = [...this._templates()];

        if (platform !== 'All') {
            list = list.filter(t => t.metadata.platform === platform);
        }

        if (query) {
            const q = query.toLowerCase();
            list = list.filter(t =>
                t.metadata.title.toLowerCase().includes(q) ||
                t.metadata.description.toLowerCase().includes(q) ||
                t.metadata.tags.some(tag => tag.includes(q))
            );
        }

        switch (sort) {
            case 'popular':
                list.sort((a, b) => b.stats.usageCount - a.stats.usageCount);
                break;
            case 'name':
                list.sort((a, b) => a.metadata.title.localeCompare(b.metadata.title));
                break;
            case 'recent':
                list.sort((a, b) => b.metadata.updatedAt.localeCompare(a.metadata.updatedAt));
                break;
        }

        return list;
    }

    /** Save a template to user's process library */
    saveTemplate(templateId: string): void {
        const ids = new Set(this._savedTemplateIds());
        ids.add(templateId);
        this._savedTemplateIds.set(ids);
        this.persistSavedIds();
    }

    /** Remove a template from user's process library */
    removeTemplate(templateId: string): void {
        const ids = new Set(this._savedTemplateIds());
        ids.delete(templateId);
        this._savedTemplateIds.set(ids);
        this.persistSavedIds();
    }

    /** Check if a template is saved */
    isTemplateSaved(templateId: string): boolean {
        return this._savedTemplateIds().has(templateId);
    }

    /** Get a single template by ID */
    getTemplateById(id: string): RpaTemplate | undefined {
        return this._templates().find(t => t.id === id);
    }

    /** Get platform color */
    getPlatformColor(platform: string): string {
        return PLATFORM_COLORS[platform] || PLATFORM_COLORS['Other'];
    }

    /** Format usage count for display */
    formatCount(count: number): string {
        if (count >= 1000) {
            return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        }
        return count.toString();
    }

    private loadSavedIds(): void {
        try {
            const raw = localStorage.getItem('rpa-saved-template-ids');
            if (raw) {
                this._savedTemplateIds.set(new Set(JSON.parse(raw)));
            }
        } catch {
            // ignore
        }
    }

    private persistSavedIds(): void {
        localStorage.setItem(
            'rpa-saved-template-ids',
            JSON.stringify([...this._savedTemplateIds()])
        );
    }
}
