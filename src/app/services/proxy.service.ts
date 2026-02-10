import { Injectable, signal, computed } from '@angular/core';
import { ProfileProxy } from '../models/folder.model';
import { MOCK_PROXIES } from '../mocks/profile.mock';
import { isWebDevMode } from '../core/utils/platform.util';

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

                const hostError = this.validateHost(proxy.host);
                if (hostError) {
                    errors.push(`Skipped ${proxy.host}: ${hostError}`);
                    continue;
                }

                const port = Number(proxy.port);
                if (!this.isValidPort(port)) {
                    errors.push(`Skipped ${proxy.host}: invalid port ${proxy.port}`);
                    continue;
                }

                this.add({
                    name: proxy.name || `${proxy.host}:${port}`,
                    host: proxy.host,
                    port,
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

            const hostError = this.validateHost(host);
            if (hostError) {
                errors.push(`${line}: ${hostError}`);
                continue;
            }

            const port = parseInt(portStr, 10);
            if (!this.isValidPort(port)) {
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

        // Only load mock data in web development mode
        if (isWebDevMode()) {
            this._proxies.set([...MOCK_PROXIES]);
        }
    }

    private saveToStorage(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._proxies()));
        } catch {
            console.warn('Failed to save proxies to storage');
        }
    }

    // === Helpers ===

    private validateHost(host: string): string | null {
        if (!host || !host.trim()) return 'Host is empty';
        if (/\s/.test(host)) return 'Host contains whitespace';
        if (/[<>"|;`$\\]/.test(host)) return 'Host contains invalid characters';
        if (host.length > 253) return 'Host is too long';
        return null;
    }

    private isValidPort(port: number): boolean {
        return Number.isInteger(port) && port >= 1 && port <= 65535;
    }

    private generateId(): string {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return `proxy-${crypto.randomUUID()}`;
        }
        return `proxy-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    formatProxyUrl(proxy: ProfileProxy): string {
        // NOTE: Chrome's --proxy-server flag does NOT support auth in URL.
        // Including user:pass@ would leak credentials into process args (visible via ps).
        // Chrome handles proxy auth via a login prompt or PAC/extensions.
        return `${proxy.type}://${proxy.host}:${proxy.port}`;
    }

    clearAll(): void {
        this._proxies.set([]);
        this.saveToStorage();
    }

    // === Health Check (Feature 4.3) ===

    async checkHealth(proxy: ProfileProxy): Promise<{ isAlive: boolean; latencyMs?: number; error?: string }> {
        try {
            // Check if running in Tauri
            if (typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ === 'undefined') {
                // Mock response for browser dev
                return { isAlive: true, latencyMs: Math.floor(Math.random() * 200) + 50 };
            }

            const { invoke } = await import('@tauri-apps/api/core');
            const result = await invoke<{ is_alive: boolean; latency_ms: number | null; error: string | null }>(
                'check_proxy_health',
                { host: proxy.host, port: proxy.port }
            );

            // Update proxy with health status
            this.update(proxy.id, {
                isAlive: result.is_alive,
                latencyMs: result.latency_ms ?? undefined,
                lastChecked: new Date().toISOString(),
            });

            return {
                isAlive: result.is_alive,
                latencyMs: result.latency_ms ?? undefined,
                error: result.error ?? undefined,
            };
        } catch (e) {
            const error = e instanceof Error ? e.message : 'Unknown error';
            this.update(proxy.id, {
                isAlive: false,
                latencyMs: undefined,
                lastChecked: new Date().toISOString(),
            });
            return { isAlive: false, error };
        }
    }

    async checkAllHealth(): Promise<{ checked: number; alive: number; dead: number }> {
        const proxies = this._proxies();
        let alive = 0;
        let dead = 0;

        for (let i = 0; i < proxies.length; i++) {
            const result = await this.checkHealth(proxies[i]);
            if (result.isAlive) {
                alive++;
            } else {
                dead++;
            }
            // Throttle: 200ms between checks to avoid overwhelming network
            if (i < proxies.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        return { checked: proxies.length, alive, dead };
    }

    // === Proxy Rotation (Feature 4.2) ===

    /**
     * Get proxies available for rotation, optionally filtered by group.
     * Only returns proxies that are alive (if health check was performed).
     */
    getProxiesForRotation(groupId?: string | null): ProfileProxy[] {
        const all = this._proxies();
        let filtered = groupId ? all.filter(p => p.group === groupId) : all;
        // Prefer alive proxies, but fall back to all if none have been checked
        const aliveOnly = filtered.filter(p => p.isAlive === true);
        return aliveOnly.length > 0 ? aliveOnly : filtered;
    }

    /**
     * Get the next proxy in rotation sequence.
     * Returns null if no proxies available.
     */
    getNextProxy(groupId?: string | null, currentIndex?: number): { proxy: ProfileProxy; nextIndex: number } | null {
        const proxies = this.getProxiesForRotation(groupId);
        if (proxies.length === 0) return null;

        const nextIndex = ((currentIndex ?? -1) + 1) % proxies.length;
        return { proxy: proxies[nextIndex], nextIndex };
    }
}
