import { Injectable, signal, computed, inject } from '@angular/core';
import { Folder } from '../models/folder.model';
import { ProfileService } from './profile.service';

const STORAGE_KEY = 'cpm_folders';

// System folders that cannot be deleted
const SYSTEM_FOLDERS: Folder[] = [
    { id: 'all', name: 'All Profiles', icon: 'pi-th-large', color: null },
    { id: 'favorites', name: 'Favorites', icon: 'pi-star', color: '#eab308' },
    { id: 'hidden', name: 'Hidden', icon: 'pi-eye-slash', color: '#71717a' },
];

@Injectable({ providedIn: 'root' })
export class FolderService {
    private readonly profileService = inject(ProfileService);

    private readonly _customFolders = signal<Folder[]>([]);

    readonly customFolders = this._customFolders.asReadonly();

    readonly folders = computed<Folder[]>(() => {
        const profiles = this.profileService.profiles();
        const custom = this._customFolders();

        // Count profiles per folder
        const countMap = new Map<string, number>();
        for (const p of profiles) {
            const fid = p.metadata?.folderId;
            if (fid) {
                countMap.set(fid, (countMap.get(fid) || 0) + 1);
            }
        }

        // Compute system folder counts
        const allCount = profiles.filter(p => !p.metadata?.isHidden).length;
        const favCount = profiles.filter(p => p.metadata?.isFavorite).length;
        const hiddenCount = profiles.filter(p => p.metadata?.isHidden).length;

        const systemWithCounts: Folder[] = [
            { ...SYSTEM_FOLDERS[0], profileCount: allCount },
            { ...SYSTEM_FOLDERS[1], profileCount: favCount },
            { ...SYSTEM_FOLDERS[2], profileCount: hiddenCount },
        ];

        const customWithCounts = custom.map(f => ({
            ...f,
            profileCount: countMap.get(f.id) || 0,
        }));

        return [...systemWithCounts, ...customWithCounts];
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

    add(name: string, icon: string | null = 'pi-folder', color: string | null = null): Folder {
        const folder: Folder = {
            id: this.generateId(),
            name,
            icon,
            color,
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
        if (SYSTEM_FOLDERS.some(sf => sf.id === id)) return;
        this._customFolders.update(list => list.filter(f => f.id !== id));
        this.saveToStorage();
    }

    getById(id: string): Folder | undefined {
        return this.folders().find(f => f.id === id);
    }

    isSystemFolder(id: string): boolean {
        return SYSTEM_FOLDERS.some(sf => sf.id === id);
    }
}
