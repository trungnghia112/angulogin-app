import { Injectable, signal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isTauriAvailable } from '../core/utils/platform.util';

export interface BrowserVersionInfo {
    browser: string;
    version: string;
    installed: boolean;
    install_path: string;
    executable_path: string | null;
}

@Injectable({ providedIn: 'root' })
export class BrowserManagerService {
    readonly isInstalled = signal<boolean>(false);
    readonly downloadProgress = signal<number>(0);
    readonly downloadStatus = signal<string>('');
    readonly isDownloading = signal<boolean>(false);
    readonly versionInfo = signal<BrowserVersionInfo | null>(null);

    constructor() {
        this.checkInstalled();
        this.setupEventListeners();
    }

    private async setupEventListeners(): Promise<void> {
        if (!isTauriAvailable()) return;

        await listen<{ percent: number; downloaded: number; total: number }>(
            'uc-download-progress',
            (event) => {
                this.downloadProgress.set(event.payload.percent);
            },
        );

        await listen<{ status: string; message: string }>(
            'uc-download-status',
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
            const info = await invoke<BrowserVersionInfo>('check_antidetect_browser');
            this.isInstalled.set(info.installed);
            this.versionInfo.set(info);
            return info.installed;
        } catch {
            return false;
        }
    }

    async download(): Promise<void> {
        if (!isTauriAvailable()) return;
        try {
            this.isDownloading.set(true);
            this.downloadProgress.set(0);
            this.downloadStatus.set('Starting download...');
            await invoke<string>('download_antidetect_browser');
            this.isInstalled.set(true);
        } catch (e) {
            this.downloadStatus.set(`Download failed: ${e}`);
            throw e;
        } finally {
            this.isDownloading.set(false);
        }
    }

    async getAntidetectFlags(
        webglRenderer?: string,
        webglVendor?: string,
    ): Promise<string[]> {
        if (!isTauriAvailable()) return [];
        return invoke<string[]>('get_antidetect_flags', {
            webglRenderer: webglRenderer || null,
            webglVendor: webglVendor || null,
        });
    }
}
