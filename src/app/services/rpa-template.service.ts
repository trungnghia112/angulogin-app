import { Injectable, signal, computed, inject } from '@angular/core';
import {
    Firestore, doc,
    onSnapshot, getDoc,
} from '@angular/fire/firestore';
import {
    RpaTemplate,
    PLATFORM_COLORS, PLATFORM_COLORS_DARK, RPA_PLATFORMS,
} from '../models/rpa-template.model';

/**
 * Catalog entry — lightweight summary for the marketplace grid.
 * Stored as array in rpa-catalog/index document.
 */
export interface CatalogEntry {
    id: string;
    title: string;
    description: string;
    platform: string;
    platformIcon: string;
    author: string;
    tags: string[];
    isPremium: boolean;
    usageCount: number;
    version: string;
    updatedAt: string;
}

/** Cached detail with version for smart invalidation */
interface CachedDetail {
    version: string;
    data: RpaTemplate;
}

const CATALOG_CACHE_KEY = 'rpa-catalog-cache';
const DETAIL_CACHE_KEY = 'rpa-detail-cache';
const SAVED_IDS_KEY = 'rpa-saved-template-ids';
const CUSTOM_TEMPLATES_KEY = 'rpa-custom-templates';

/**
 * RPA Template Service — Firestore 2-Tier Architecture
 *
 * Tier 1: rpa-catalog/index → 1 document with all summaries (1 read/session)
 * Tier 2: rpa-templates/{id} → full detail per template (1 read/click, cached)
 *
 * Cost: ~2K reads/day for 500 users = 4% free tier
 */
@Injectable({ providedIn: 'root' })
export class RpaTemplateService {
    private readonly firestore = inject(Firestore);

    /** Catalog entries (lightweight, loaded on init) */
    private readonly _catalog = signal<CatalogEntry[]>([]);
    readonly catalog = this._catalog.asReadonly();

    /** Whether catalog has been loaded */
    private readonly _loaded = signal(false);
    readonly loaded = this._loaded.asReadonly();

    /** Loading state */
    private readonly _loading = signal(false);
    readonly loading = this._loading.asReadonly();

    /** Detail cache (templateId → full template) */
    private detailCache = new Map<string, CachedDetail>();

    /** Saved template IDs (localStorage for now, Firestore user doc later) */
    private readonly _savedTemplateIds = signal<Set<string>>(new Set());

    /** Snapshot unsubscribe function */
    private unsubCatalog?: () => void;

    /** Platform list for UI */
    readonly platforms = RPA_PLATFORMS;
    readonly platformColors = PLATFORM_COLORS;

    /** Derived: saved catalog entries */
    readonly savedEntries = computed(() => {
        const ids = this._savedTemplateIds();
        return this._catalog().filter(t => ids.has(t.id));
    });

    /** User's custom templates (localStorage, Firestore-ready later) */
    private readonly _customTemplates = signal<RpaTemplate[]>([]);
    readonly customTemplates = this._customTemplates.asReadonly();

    constructor() {
        this.loadSavedIds();
        this.loadDetailCacheFromStorage();
        this.loadCustomTemplates();
    }

    // --- Custom Template CRUD ---

    /** Create or update a custom template */
    saveCustomTemplate(template: RpaTemplate): void {
        const templates = [...this._customTemplates()];
        const idx = templates.findIndex(t => t.id === template.id);
        const now = new Date().toISOString();
        const sanitized: RpaTemplate = {
            ...template,
            metadata: {
                ...template.metadata,
                title: template.metadata.title.trim().slice(0, 100),
                description: template.metadata.description.trim().slice(0, 500),
                updatedAt: now,
                createdAt: idx === -1 ? now : template.metadata.createdAt,
            },
        };
        if (idx >= 0) {
            templates[idx] = sanitized;
        } else {
            templates.push(sanitized);
        }
        this._customTemplates.set(templates);
        this.persistCustomTemplates();
    }

    /** Delete a custom template by ID */
    deleteCustomTemplate(id: string): void {
        const templates = this._customTemplates().filter(t => t.id !== id);
        this._customTemplates.set(templates);
        this.persistCustomTemplates();
    }

    /** Get a single custom template by ID */
    getCustomTemplate(id: string): RpaTemplate | null {
        return this._customTemplates().find(t => t.id === id) ?? null;
    }

    /** Duplicate a template (marketplace or custom) with a new ID */
    duplicateTemplate(source: RpaTemplate): RpaTemplate {
        const now = new Date().toISOString();
        return {
            ...source,
            id: this.generateId(),
            version: '1.0',
            metadata: {
                ...source.metadata,
                title: `${source.metadata.title} (Copy)`.slice(0, 100),
                createdAt: now,
                updatedAt: now,
                author: 'Me',
            },
            stats: { usageCount: 0 },
        };
    }

    /** Create a blank template scaffold */
    createBlankTemplate(): RpaTemplate {
        const now = new Date().toISOString();
        return {
            id: this.generateId(),
            version: '1.0',
            metadata: {
                title: '',
                description: '',
                longDescription: '',
                platform: 'Other',
                platformIcon: 'pi-cog',
                author: 'Me',
                tags: [],
                createdAt: now,
                updatedAt: now,
                isPremium: false,
            },
            stats: { usageCount: 0 },
            requirements: { note: '' },
            overview: '',
            steps: [],
            variables: [],
        };
    }

    /** Export a template as a downloadable JSON file */
    exportTemplateAsJson(template: RpaTemplate): void {
        const json = JSON.stringify(template, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${template.metadata.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'template'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /** Import a template from a JSON file. Returns null on invalid input. */
    async importTemplateFromFile(file: File): Promise<RpaTemplate | null> {
        if (file.size > 1_048_576) return null; // 1MB limit
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!this.isValidTemplate(parsed)) return null;
            // Assign new ID to avoid collisions
            parsed.id = this.generateId();
            parsed.metadata.createdAt = new Date().toISOString();
            parsed.metadata.updatedAt = new Date().toISOString();
            return parsed as RpaTemplate;
        } catch {
            return null;
        }
    }

    /** Basic validation for imported JSON */
    private isValidTemplate(obj: unknown): boolean {
        if (!obj || typeof obj !== 'object') return false;
        const t = obj as Record<string, unknown>;
        if (!t['metadata'] || typeof t['metadata'] !== 'object') return false;
        const m = t['metadata'] as Record<string, unknown>;
        if (typeof m['title'] !== 'string' || !m['title']) return false;
        if (!Array.isArray(t['steps'])) return false;
        if (!Array.isArray(t['variables'])) return false;
        return true;
    }

    /** Generate a unique ID for custom templates */
    private generateId(): string {
        return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    private loadCustomTemplates(): void {
        try {
            const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
            if (raw) this._customTemplates.set(JSON.parse(raw));
        } catch { /* ignore corrupted data */ }
    }

    private persistCustomTemplates(): void {
        try {
            localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(this._customTemplates()));
        } catch { /* quota exceeded */ }
    }

    /**
     * Subscribe to catalog index — realtime updates from Firestore.
     * Only 1 read on connect + 1 read per catalog change (rare).
     */
    subscribeCatalog(): void {
        if (this.unsubCatalog || this._loading()) return;
        this._loading.set(true);

        // Try local cache first for instant render
        const cached = this.loadCatalogFromStorage();
        if (cached.length > 0) {
            this._catalog.set(cached);
            this._loaded.set(true);
            this._loading.set(false);
        }

        // Then subscribe to Firestore for live updates
        const catalogDoc = doc(this.firestore, 'rpa-catalog', 'index');
        this.unsubCatalog = onSnapshot(
            catalogDoc,
            (snap) => {
                if (snap.exists()) {
                    const data = snap.data() as { templates: CatalogEntry[] };
                    this._catalog.set(data.templates || []);
                    this._loaded.set(true);
                    // Cache for offline
                    this.saveCatalogToStorage(data.templates);
                } else if (!this._loaded()) {
                    // Doc doesn't exist (e.g. empty emulator) — fallback to local asset
                    this.fallbackToLocalAsset();
                }
                this._loading.set(false);
            },
            (err) => {
                console.error('[RpaTemplateService] Firestore catalog error:', err);
                this._loading.set(false);
                // Fallback to local asset if Firestore fails
                if (!this._loaded()) {
                    this.fallbackToLocalAsset();
                }
            }
        );
    }

    /** Cleanup snapshot listener */
    destroy(): void {
        this.unsubCatalog?.();
    }

    /**
     * Get full template detail — 1 Firestore read, then cached by version.
     * Subsequent calls with same version = 0 reads.
     */
    async getTemplateDetail(id: string): Promise<RpaTemplate | null> {
        // Check memory cache
        const catalogEntry = this._catalog().find(e => e.id === id);
        const cached = this.detailCache.get(id);
        if (cached && catalogEntry && cached.version === catalogEntry.version) {
            return cached.data;
        }

        // Fetch from Firestore (1 read)
        try {
            const templateDoc = doc(this.firestore, 'rpa-templates', id);
            const snap = await getDoc(templateDoc);
            if (snap.exists()) {
                const data = snap.data() as RpaTemplate;
                // Cache in memory + localStorage
                this.detailCache.set(id, { version: data.version, data });
                this.saveDetailCacheToStorage();
                return data;
            }
        } catch (err) {
            console.error(`[RpaTemplateService] Failed to fetch detail for ${id}:`, err);
            // Return from cache even if version mismatch (better than nothing)
            if (cached) return cached.data;
        }

        return null;
    }

    /** Filter catalog entries by platform, query, and sort */
    filterCatalog(platform: string, query: string, sort: string): CatalogEntry[] {
        let list = [...this._catalog()];

        if (platform !== 'All') {
            list = list.filter(t => t.platform === platform);
        }

        if (query) {
            const q = query.toLowerCase();
            list = list.filter(t =>
                t.title.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                t.tags.some(tag => tag.includes(q))
            );
        }

        switch (sort) {
            case 'popular':
                list.sort((a, b) => b.usageCount - a.usageCount);
                break;
            case 'name':
                list.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'recent':
                list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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

    /** Get platform color (dark-mode aware) */
    getPlatformColor(platform: string): string {
        const isDark = document.documentElement.classList.contains('dark');
        if (isDark && PLATFORM_COLORS_DARK[platform]) {
            return PLATFORM_COLORS_DARK[platform];
        }
        return PLATFORM_COLORS[platform] || PLATFORM_COLORS['Other'];
    }

    /** Format usage count for display */
    formatCount(count: number): string {
        if (count >= 1000) {
            return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        }
        return count.toString();
    }

    // --- Private: localStorage persistence ---

    private loadSavedIds(): void {
        try {
            const raw = localStorage.getItem(SAVED_IDS_KEY);
            if (raw) this._savedTemplateIds.set(new Set(JSON.parse(raw)));
        } catch { /* ignore */ }
    }

    private persistSavedIds(): void {
        localStorage.setItem(SAVED_IDS_KEY, JSON.stringify([...this._savedTemplateIds()]));
    }

    private loadCatalogFromStorage(): CatalogEntry[] {
        try {
            const raw = localStorage.getItem(CATALOG_CACHE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    private saveCatalogToStorage(entries: CatalogEntry[]): void {
        try {
            localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(entries));
        } catch { /* quota exceeded */ }
    }

    private loadDetailCacheFromStorage(): void {
        try {
            const raw = localStorage.getItem(DETAIL_CACHE_KEY);
            if (raw) {
                const map: Record<string, CachedDetail> = JSON.parse(raw);
                this.detailCache = new Map(Object.entries(map));
            }
        } catch { /* ignore */ }
    }

    private saveDetailCacheToStorage(): void {
        try {
            // LRU eviction: keep only last 50 entries
            if (this.detailCache.size > 50) {
                const keys = [...this.detailCache.keys()];
                for (let i = 0; i < keys.length - 50; i++) {
                    this.detailCache.delete(keys[i]);
                }
            }
            const obj: Record<string, CachedDetail> = {};
            this.detailCache.forEach((v, k) => obj[k] = v);
            localStorage.setItem(DETAIL_CACHE_KEY, JSON.stringify(obj));
        } catch { /* quota exceeded */ }
    }

    /** Fallback: load from bundled asset if Firestore unavailable */
    private async fallbackToLocalAsset(): Promise<void> {
        try {
            const response = await fetch('assets/rpa-templates/templates.json');
            if (!response.ok) return;
            const templates: RpaTemplate[] = await response.json();
            // Convert to catalog entries
            const entries: CatalogEntry[] = templates.map(t => ({
                id: t.id,
                title: t.metadata.title,
                description: t.metadata.description,
                platform: t.metadata.platform,
                platformIcon: t.metadata.platformIcon,
                author: t.metadata.author,
                tags: t.metadata.tags,
                isPremium: t.metadata.isPremium,
                usageCount: t.stats.usageCount,
                version: t.version,
                updatedAt: t.metadata.updatedAt,
            }));
            this._catalog.set(entries);
            this._loaded.set(true);
            // Also populate detail cache
            for (const t of templates) {
                this.detailCache.set(t.id, { version: t.version, data: t });
            }
            this.saveDetailCacheToStorage();
        } catch {
            console.error('[RpaTemplateService] Local asset fallback also failed');
        }
    }
}
