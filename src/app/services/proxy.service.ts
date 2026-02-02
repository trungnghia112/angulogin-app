import { Injectable, signal, computed } from '@angular/core';
import { ProfileProxy } from '../models/folder.model';
import { MOCK_PROXIES } from '../mocks/profile.mock';

const STORAGE_KEY = 'chrome-profile-manager-proxies';

@Injectable({
    providedIn: 'root',
})
export class ProxyService {
    // === State ===
    private _proxies = signal<ProfileProxy[]>([]);
    readonly proxies = this._proxies.asReadonly();

    // === Computed ===
    readonly proxyCount = computed(() => this._proxies().length);
    readonly proxyGroups = computed(() => {
        const groups = new Set<string>();
        this._proxies().forEach(p => {
            if (p.group) groups.add(p.group);
        });
        return Array.from(groups).sort();
    });

    constructor() {
        this.loadFromStorage();
    }

    // === CRUD Operations ===

    add(proxy: Omit<ProfileProxy, 'id'>): ProfileProxy {
        const newProxy: ProfileProxy = {
            ...proxy,
            id: this.generateId(),
        };
        this._proxies.update(list => [...list, newProxy]);
        this.saveToStorage();
        return newProxy;
    }

    update(id: string, changes: Partial<ProfileProxy>): void {
        this._proxies.update(list =>
            list.map(p => (p.id === id ? { ...p, ...changes } : p))
        );
        this.saveToStorage();
    }

    remove(id: string): void {
        this._proxies.update(list => list.filter(p => p.id !== id));
        this.saveToStorage();
    }

    getById(id: string): ProfileProxy | undefined {
        return this._proxies().find(p => p.id === id);
    }

    getByGroup(group: string): ProfileProxy[] {
        return this._proxies().filter(p => p.group === group);
    }

    // === Import/Export ===

    exportProxies(): void {
        const proxies = this._proxies();
        if (proxies.length === 0) {
            return;
        }

        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            proxies: proxies.map(p => ({
                name: p.name,
                host: p.host,
                port: p.port,
                type: p.type,
                username: p.username || null,
                password: p.password || null,
                group: p.group || null,
            })),
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `proxies-export-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    importFromJson(jsonContent: string): { imported: number; errors: string[] } {
        const errors: string[] = [];
        let imported = 0;

        try {
            const data = JSON.parse(jsonContent);

            if (!data.proxies || !Array.isArray(data.proxies)) {
                throw new Error('Invalid format: missing proxies array');
            }

            for (const proxy of data.proxies) {
                if (!proxy.host || !proxy.port) {
                    errors.push(`Skipped invalid proxy: missing host or port`);
                    continue;
                }

                this.add({
                    name: proxy.name || `${proxy.host}:${proxy.port}`,
                    host: proxy.host,
                    port: Number(proxy.port),
                    type: proxy.type === 'socks5' ? 'socks5' : 'http',
                    username: proxy.username || null,
                    password: proxy.password || null,
                    group: proxy.group || null,
                });
                imported++;
            }
        } catch (e) {
            errors.push(e instanceof Error ? e.message : 'Parse error');
        }

        return { imported, errors };
    }

    importFromText(text: string, format: 'ip:port' | 'ip:port:user:pass'): { imported: number; errors: string[] } {
        const errors: string[] = [];
        let imported = 0;

        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        for (const line of lines) {
            const parts = line.split(':');

            if (parts.length < 2) {
                errors.push(`Invalid line: ${line}`);
                continue;
            }

            const [host, portStr, username, password] = parts;
            const port = parseInt(portStr, 10);

            if (isNaN(port)) {
                errors.push(`Invalid port in: ${line}`);
                continue;
            }

            this.add({
                name: `${host}:${port}`,
                host,
                port,
                type: 'http',
                username: format === 'ip:port:user:pass' ? (username || null) : null,
                password: format === 'ip:port:user:pass' ? (password || null) : null,
                group: null,
            });
            imported++;
        }

        return { imported, errors };
    }

    // === Storage ===

    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    this._proxies.set(parsed);
                    return;
                }
            }
        } catch {
            console.warn('Failed to load proxies from storage');
        }

        // Default to mock data in development
        this._proxies.set([...MOCK_PROXIES]);
    }

    private saveToStorage(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._proxies()));
        } catch {
            console.warn('Failed to save proxies to storage');
        }
    }

    // === Helpers ===

    private generateId(): string {
        return `proxy-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    formatProxyUrl(proxy: ProfileProxy): string {
        const auth = proxy.username ? `${proxy.username}:${proxy.password || ''}@` : '';
        return `${proxy.type}://${auth}${proxy.host}:${proxy.port}`;
    }

    clearAll(): void {
        this._proxies.set([]);
        this.saveToStorage();
    }
}
