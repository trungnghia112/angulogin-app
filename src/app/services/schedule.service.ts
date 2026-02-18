import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { debugLog } from '../core/utils/logger.util';

export interface ScheduleEntry {
    id: string;
    profilePath: string;
    profileName: string;
    /** Cron-like: 'once' for one-time, 'daily', 'weekdays', 'custom' */
    recurrence: 'once' | 'daily' | 'weekdays' | 'custom';
    /** Time in HH:mm format */
    time: string;
    /** For 'once': ISO date string. For 'custom': array of day indices (0=Sun..6=Sat) */
    date?: string;
    customDays?: number[];
    enabled: boolean;
    lastTriggered?: string | null;
}

const STORAGE_KEY = 'cpm_schedules';
const CHECK_INTERVAL_MS = 30_000; // Check every 30 seconds

@Injectable({ providedIn: 'root' })
export class ScheduleService implements OnDestroy {
    private readonly _entries = signal<ScheduleEntry[]>([]);
    private checkTimer: ReturnType<typeof setInterval> | null = null;
    private onTriggerCallback: ((entry: ScheduleEntry) => void) | null = null;

    readonly entries = this._entries.asReadonly();

    readonly activeCount = computed(() =>
        this._entries().filter(e => e.enabled).length,
    );

    constructor() {
        this.loadFromStorage();
        this.startChecker();

        // Pause when tab is hidden (performance rule)
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.handleVisibility);
        }
    }

    ngOnDestroy(): void {
        this.stopChecker();
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.handleVisibility);
        }
    }

    /** Register callback for when a schedule triggers */
    onTrigger(callback: (entry: ScheduleEntry) => void): void {
        this.onTriggerCallback = callback;
    }

    add(entry: Omit<ScheduleEntry, 'id' | 'lastTriggered'>): ScheduleEntry {
        const newEntry: ScheduleEntry = {
            ...entry,
            id: `sch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            lastTriggered: null,
        };
        this._entries.update(list => [...list, newEntry]);
        this.saveToStorage();
        return newEntry;
    }

    update(id: string, updates: Partial<Omit<ScheduleEntry, 'id'>>): void {
        this._entries.update(list =>
            list.map(e => (e.id === id ? { ...e, ...updates } : e)),
        );
        this.saveToStorage();
    }

    remove(id: string): void {
        this._entries.update(list => list.filter(e => e.id !== id));
        this.saveToStorage();
    }

    toggle(id: string): void {
        this._entries.update(list =>
            list.map(e => (e.id === id ? { ...e, enabled: !e.enabled } : e)),
        );
        this.saveToStorage();
    }

    getByProfile(profilePath: string): ScheduleEntry[] {
        return this._entries().filter(e => e.profilePath === profilePath);
    }

    // === Private ===

    private readonly handleVisibility = (): void => {
        if (document.hidden) {
            this.stopChecker();
        } else {
            this.startChecker();
        }
    };

    private startChecker(): void {
        if (this.checkTimer) return;
        this.checkTimer = setInterval(() => this.checkSchedules(), CHECK_INTERVAL_MS);
    }

    private stopChecker(): void {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
    }

    private checkSchedules(): void {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const currentDay = now.getDay();
        const todayStr = now.toISOString().split('T')[0];

        for (const entry of this._entries()) {
            if (!entry.enabled) continue;
            if (entry.time !== currentTime) continue;

            // Check if already triggered this minute
            if (entry.lastTriggered) {
                const lastDate = new Date(entry.lastTriggered);
                if (
                    lastDate.getFullYear() === now.getFullYear() &&
                    lastDate.getMonth() === now.getMonth() &&
                    lastDate.getDate() === now.getDate() &&
                    lastDate.getHours() === now.getHours() &&
                    lastDate.getMinutes() === now.getMinutes()
                ) {
                    continue; // Already triggered this minute
                }
            }

            let shouldTrigger = false;

            switch (entry.recurrence) {
                case 'once':
                    shouldTrigger = entry.date === todayStr;
                    break;
                case 'daily':
                    shouldTrigger = true;
                    break;
                case 'weekdays':
                    shouldTrigger = currentDay >= 1 && currentDay <= 5;
                    break;
                case 'custom':
                    shouldTrigger = (entry.customDays || []).includes(currentDay);
                    break;
            }

            if (shouldTrigger) {
                debugLog('schedule', `Triggering schedule: ${entry.profileName} at ${entry.time}`);
                this.update(entry.id, { lastTriggered: now.toISOString() });

                // Disable one-time schedules after trigger
                if (entry.recurrence === 'once') {
                    this.update(entry.id, { enabled: false });
                }

                // Fire callback
                if (this.onTriggerCallback) {
                    this.onTriggerCallback(entry);
                }
            }
        }
    }

    private loadFromStorage(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                this._entries.set(JSON.parse(raw));
            }
        } catch {
            this._entries.set([]);
        }
    }

    private saveToStorage(): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._entries()));
    }
}
