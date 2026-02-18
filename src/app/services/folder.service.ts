import { Injectable, signal, computed, inject } from '@angular/core';
import { Folder } from '../models/folder.model';
import { ProfileService } from './profile.service';

const STORAGE_KEY = 'cpm_folders';

// System folders are now defined dynamically in the computed property

@Injectable({ providedIn: 'root' })
export class FolderService {
    private readonly profileService = inject(ProfileService);

    private readonly _customFolders = signal<Folder[]>([]);

    readonly customFolders = this._customFolders.asReadonly();

    readonly folders = computed<Folder[]>(() => {
        const profiles = this.profileService.profiles();
        const custom = this._customFolders();
        const ONE_GB = 1024 * 1024 * 1024;
        const THIRTY_DAYS_AGO = Date.now() - 30 * 24 * 60 * 60 * 1000;

        // Single-pass counting - O(n) instead of O(4n)
        const countMap = new Map<string, number>();
        let allCount = 0;
        let favCount = 0;
        let hiddenCount = 0;
        let largeCount = 0;
        let unusedCount = 0;

        for (const p of profiles) {
            // Count by folderId
            const fid = p.metadata?.folderId;
            if (fid) {
                countMap.set(fid, (countMap.get(fid) || 0) + 1);
            }
            // Count system folders
            // 'All' count: usually excludes hidden, depending on requirements. 
            // Previous Home logic: profiles.length (includes hidden? SmartFolder 'all' in Home used profiles.length)
            // Let's stick to Home logic: All includes everything? 
            // Actually Home 'smartFolders' used profiles.length.
            // But let's verify if we want 'All' to show hidden.
            // Home logic: "All Profiles" count = profiles.length.
            allCount++;

            if (p.metadata?.isFavorite) favCount++;
            if (p.metadata?.isHidden) hiddenCount++;

            if ((p.size || 0) > ONE_GB) largeCount++;

            const lastOpened = p.metadata?.lastOpened ? new Date(p.metadata.lastOpened).getTime() : 0;
            if (lastOpened > 0 && lastOpened < THIRTY_DAYS_AGO) unusedCount++;
        }

        // System folders definition
        const systemFolders: Folder[] = [
            { id: 'all', name: 'All Profiles', icon: 'pi-th-large', color: '#3b82f6', profileCount: allCount },
            { id: 'favorites', name: 'Favorites', icon: 'pi-heart', color: '#ef4444', profileCount: favCount },
            { id: 'large', name: 'Large (>1GB)', icon: 'pi-database', color: '#f97316', profileCount: largeCount },
            { id: 'unused', name: 'Unused (30+ days)', icon: 'pi-clock', color: '#eab308', profileCount: unusedCount },
            { id: 'hidden', name: 'Hidden', icon: 'pi-eye-slash', color: '#6b7280', profileCount: hiddenCount },
        ];

        const customWithCounts = custom.map(f => ({
            ...f,
            profileCount: countMap.get(f.id) || 0,
        }));

        return [...systemFolders, ...customWithCounts];
    });

    /** Flat list with depth for tree rendering */
    readonly folderTree = computed<(Folder & { depth: number })[]>(() => {
        const all = this.folders();
        const system = all.filter(f => this.isSystemFolder(f.id));
        const custom = all.filter(f => !this.isSystemFolder(f.id));

        // Build children map
        const childrenMap = new Map<string | null, Folder[]>();
        for (const f of custom) {
            const pid = f.parentId ?? null;
            const list = childrenMap.get(pid) || [];
            list.push(f);
            childrenMap.set(pid, list);
        }

        // DFS flatten
        const result: (Folder & { depth: number })[] = [];
        // System folders always at depth 0
        for (const f of system) {
            result.push({ ...f, depth: 0 });
        }
        // Custom folders in tree order
        const visit = (parentId: string | null, depth: number) => {
            const children = childrenMap.get(parentId) || [];
            for (const child of children) {
                result.push({ ...child, depth });
                visit(child.id, depth + 1);
            }
        };
        visit(null, 0);
        return result;
    });

    constructor() {
        this.loadFromStorage();
    }

    private loadFromStorage(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Folder[];
                this._customFolders.set(parsed);
            }
        } catch {
            this._customFolders.set([]);
        }
    }

    private saveToStorage(): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._customFolders()));
    }

    private generateId(): string {
        return `folder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    add(name: string, icon: string | null = 'pi-folder', color: string | null = null, parentId: string | null = null): Folder {
        const folder: Folder = {
            id: this.generateId(),
            name,
            icon,
            color,
            parentId,
        };
        this._customFolders.update(list => [...list, folder]);
        this.saveToStorage();
        return folder;
    }

    update(id: string, updates: Partial<Omit<Folder, 'id'>>): void {
        this._customFolders.update(list =>
            list.map(f => (f.id === id ? { ...f, ...updates } : f))
        );
        this.saveToStorage();
    }

    remove(id: string): void {
        // Do not allow removing system folders
        const systemIds = ['all', 'favorites', 'large', 'unused', 'hidden'];
        if (systemIds.includes(id)) return;
        this._customFolders.update(list => list.filter(f => f.id !== id));
        this.saveToStorage();
    }

    getById(id: string): Folder | undefined {
        return this.folders().find(f => f.id === id);
    }

    isSystemFolder(id: string): boolean {
        const systemIds = ['all', 'favorites', 'large', 'unused', 'hidden'];
        return systemIds.includes(id);
    }
}
