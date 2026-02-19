import { Injectable, signal, computed } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';

export interface ApiConfig {
    enabled: boolean;
    port: number;
    api_key: string;
    auto_start: boolean;
}

@Injectable({ providedIn: 'root' })
export class ApiSettingsService {
    private _config = signal<ApiConfig>({
        enabled: true,
        port: 50200,
        api_key: '',
        auto_start: true,
    });

    readonly config = this._config.asReadonly();
    readonly isEnabled = computed(() => this._config().enabled);
    readonly port = computed(() => this._config().port);
    readonly apiKey = computed(() => this._config().api_key);
    readonly connectionUrl = computed(() => `http://localhost:${this._config().port}`);

    async loadConfig(): Promise<void> {
        try {
            const config = await invoke<ApiConfig>('get_api_config');
            this._config.set(config);
        } catch (err) {
            console.error('[ApiSettings] Failed to load config:', err);
        }
    }

    async saveConfig(updates: Partial<ApiConfig>): Promise<void> {
        try {
            const current = this._config();
            const updated = { ...current, ...updates };
            await invoke('save_api_config', { config: updated });
            this._config.set(updated);
        } catch (err) {
            console.error('[ApiSettings] Failed to save config:', err);
            throw err;
        }
    }

    async toggleEnabled(): Promise<void> {
        const current = this._config();
        await this.saveConfig({ enabled: !current.enabled });
    }

    async regenerateKey(): Promise<string> {
        try {
            const newKey = await invoke<string>('regenerate_api_key');
            this._config.update(c => ({ ...c, api_key: newKey }));
            return newKey;
        } catch (err) {
            console.error('[ApiSettings] Failed to regenerate key:', err);
            throw err;
        }
    }

    async syncProfilesPath(path: string): Promise<void> {
        try {
            await invoke('set_api_profiles_path', { path });
        } catch (err) {
            console.error('[ApiSettings] Failed to sync profiles path:', err);
        }
    }
}
