import { Injectable, signal, computed } from '@angular/core';

export interface ActivityEntry {
    id: string;
    timestamp: string;
    type: 'launch' | 'create' | 'delete' | 'duplicate' | 'edit';
    profileName: string;
    profilePath: string;
    browser?: string;
    details?: string;
}

const STORAGE_KEY = 'activity-log';
const MAX_ENTRIES = 100;

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
    private readonly _entries = signal<ActivityEntry[]>([]);

    readonly entries = this._entries.asReadonly();

    readonly recentEntries = computed(() =>
        this._entries().slice(0, 20)
    );

    readonly todayEntries = computed(() => {
        const today = new Date().toDateString();
        return this._entries().filter(e =>
            new Date(e.timestamp).toDateString() === today
        );
    });

    constructor() {
        this.loadFromStorage();
    }

    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const entries = JSON.parse(stored) as ActivityEntry[];
                // Cap to MAX_ENTRIES on load to prevent unbounded growth
                this._entries.set(
                    Array.isArray(entries) ? entries.slice(0, MAX_ENTRIES) : []
                );
            }
        } catch (e) {
            console.error('Failed to load activity log:', e);
        }
    }

    private saveToStorage(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._entries()));
        } catch (e) {
            console.error('Failed to save activity log:', e);
        }
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    log(type: ActivityEntry['type'], profileName: string, profilePath: string, browser?: string, details?: string): void {
        const entry: ActivityEntry = {
            id: this.generateId(),
            timestamp: new Date().toISOString(),
            type,
            profileName,
            profilePath,
            browser,
            details,
        };

        this._entries.update(entries => {
            const updated = [entry, ...entries];
            // Keep only the latest MAX_ENTRIES
            if (updated.length > MAX_ENTRIES) {
                return updated.slice(0, MAX_ENTRIES);
            }
            return updated;
        });

        this.saveToStorage();
    }

    logLaunch(profileName: string, profilePath: string, browser: string): void {
        this.log('launch', profileName, profilePath, browser);
    }

    logCreate(profileName: string, profilePath: string): void {
        this.log('create', profileName, profilePath);
    }

    logDelete(profileName: string, profilePath: string): void {
        this.log('delete', profileName, profilePath);
    }

    logDuplicate(originalName: string, newPath: string, newName: string): void {
        this.log('duplicate', newName, newPath, undefined, `Duplicated from ${originalName}`);
    }

    clearLog(): void {
        this._entries.set([]);
        localStorage.removeItem(STORAGE_KEY);
    }

    getTypeIcon(type: ActivityEntry['type']): string {
        switch (type) {
            case 'launch': return 'pi-play';
            case 'create': return 'pi-plus';
            case 'delete': return 'pi-trash';
            case 'duplicate': return 'pi-copy';
            case 'edit': return 'pi-pencil';
            default: return 'pi-circle';
        }
    }

    getTypeLabel(type: ActivityEntry['type']): string {
        switch (type) {
            case 'launch': return 'Launched';
            case 'create': return 'Created';
            case 'delete': return 'Deleted';
            case 'duplicate': return 'Duplicated';
            case 'edit': return 'Edited';
            default: return type;
        }
    }

    formatTimestamp(timestamp: string): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        // Less than 1 minute
        if (diff < 60000) return 'Just now';
        // Less than 1 hour
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        // Less than 24 hours
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        // Less than 7 days
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        // Older
        return date.toLocaleDateString();
    }
}
