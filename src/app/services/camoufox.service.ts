import { Injectable, signal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isTauriAvailable } from '../core/utils/platform.util';

export interface CamoufoxVersionInfo {
    version: string;
    installed: boolean;
    install_path: string;
    executable_path: string | null;
}

export interface Fingerprint {
    screen: {
        width: number;
        height: number;
        avail_width: number;
        avail_height: number;
        color_depth: number;
        pixel_ratio: number;
    };
    navigator: {
        user_agent: string;
        platform: string;
        language: string;
        languages: string[];
        hardware_concurrency: number;
        device_memory: number;
        max_touch_points: number;
        do_not_track: string | null;
    };
    video_card: {
        vendor: string;
        renderer: string;
    };
    fonts: string[];
    battery: {
        charging: boolean;
        level: number;
        charging_time: number | null;
        discharging_time: number | null;
    } | null;
    timezone: string;
    locale: string;
    os: string;
}

export interface CamoufoxLaunchResult {
    id: string;
    processId: number | null;
    profilePath: string | null;
    url: string | null;
}

@Injectable({ providedIn: 'root' })
export class CamoufoxService {
    readonly isInstalled = signal<boolean>(false);
    readonly downloadProgress = signal<number>(0);
    readonly downloadStatus = signal<string>('');
    readonly isDownloading = signal<boolean>(false);
    readonly versionInfo = signal<CamoufoxVersionInfo | null>(null);

    constructor() {
        this.checkInstalled();
        this.setupEventListeners();
    }

    private async setupEventListeners(): Promise<void> {
        if (!isTauriAvailable()) return;

        await listen<{ percent: number; downloaded: number; total: number }>(
            'camoufox-download-progress',
            (event) => {
                this.downloadProgress.set(event.payload.percent);
            },
        );

        await listen<{ status: string; message: string }>(
            'camoufox-download-status',
            (event) => {
                this.downloadStatus.set(event.payload.message);
                if (event.payload.status === 'complete') {
                    this.isDownloading.set(false);
                    this.isInstalled.set(true);
                }
            },
        );
    }

    async checkInstalled(): Promise<boolean> {
        if (!isTauriAvailable()) return false;
        try {
            const installed = await invoke<boolean>('check_camoufox_installed');
            this.isInstalled.set(installed);
            return installed;
        } catch {
            return false;
        }
    }

    async getVersionInfo(): Promise<CamoufoxVersionInfo | null> {
        if (!isTauriAvailable()) return null;
        try {
            const info = await invoke<CamoufoxVersionInfo>('get_camoufox_version');
            this.versionInfo.set(info);
            return info;
        } catch {
            return null;
        }
    }

    async download(): Promise<void> {
        if (!isTauriAvailable()) return;
        try {
            this.isDownloading.set(true);
            this.downloadProgress.set(0);
            this.downloadStatus.set('Starting download...');
            await invoke<string>('download_camoufox');
            this.isInstalled.set(true);
        } catch (e) {
            this.downloadStatus.set(`Download failed: ${e}`);
            throw e;
        } finally {
            this.isDownloading.set(false);
        }
    }

    async generateFingerprint(os?: string): Promise<string> {
        if (!isTauriAvailable()) return '{}';
        return invoke<string>('generate_fingerprint', { os: os || null });
    }

    async generateFingerprintPreview(os?: string): Promise<Fingerprint> {
        if (!isTauriAvailable()) {
            throw new Error('Tauri not available');
        }
        return invoke<Fingerprint>('generate_fingerprint_preview', { os: os || null });
    }

    async launch(
        profilePath: string,
        config: object,
        url?: string,
    ): Promise<CamoufoxLaunchResult> {
        if (!isTauriAvailable()) {
            throw new Error('Tauri not available');
        }
        return invoke<CamoufoxLaunchResult>('launch_camoufox', {
            profilePath,
            config: JSON.stringify(config),
            url: url || null,
        });
    }

    async stop(id: string): Promise<boolean> {
        if (!isTauriAvailable()) return false;
        return invoke<boolean>('stop_camoufox', { id });
    }
}
