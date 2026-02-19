import { Injectable, signal, computed, inject } from '@angular/core';
import {
    Firestore, collection, doc,
    onSnapshot, getDoc,
} from '@angular/fire/firestore';
import {
    RpaTemplate, RpaTemplateStep, RpaTemplateVariable,
    PLATFORM_COLORS, RPA_PLATFORMS,
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

    constructor() {
        this.loadSavedIds();
        this.loadDetailCacheFromStorage();
    }

    /**
     * Subscribe to catalog index — realtime updates from Firestore.
     * Only 1 read on connect + 1 read per catalog change (rare).
     */
    subscribeCatalog(): void {
        if (this._loaded() || this._loading()) return;
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
