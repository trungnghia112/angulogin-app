import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { CamoufoxService, Fingerprint } from '../../../services/camoufox.service';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';

interface CheckerLink {
    name: string;
    url: string;
    description: string;
    icon: string;
}

const CHECKER_LINKS: CheckerLink[] = [
    {
        name: 'BrowserLeaks',
        url: 'https://browserleaks.com',
        description: 'Comprehensive browser fingerprint test suite',
        icon: 'pi pi-search',
    },
    {
        name: 'CreepJS',
        url: 'https://abrahamjuliot.github.io/creepjs/',
        description: 'Advanced fingerprint detection by Abraham Juliot',
        icon: 'pi pi-eye',
    },
    {
        name: 'PixelScan',
        url: 'https://pixelscan.net',
        description: 'Antidetect browser detection and scoring',
        icon: 'pi pi-verified',
    },
    {
        name: 'AmIUnique',
        url: 'https://amiunique.org',
        description: 'Browser fingerprint uniqueness checker',
        icon: 'pi pi-user',
    },
    {
        name: 'IPHey',
        url: 'https://iphey.com',
        description: 'Proxy and fingerprint consistency checker',
        icon: 'pi pi-shield',
    },
];

@Component({
    selector: 'app-fingerprint-checker',
    templateUrl: './fingerprint-checker.html',
    styleUrl: './fingerprint-checker.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [ButtonModule, TooltipModule],
})
export class FingerprintChecker {
    protected readonly camoufoxService = inject(CamoufoxService);
    private readonly messageService = inject(MessageService);

    protected readonly checkerLinks = CHECKER_LINKS;
    protected readonly fingerprintPreview = signal<Fingerprint | null>(null);
    protected readonly isLoadingPreview = signal(false);
    protected readonly isLaunching = signal(false);

    async generatePreview(): Promise<void> {
        this.isLoadingPreview.set(true);
        try {
            const preview = await this.camoufoxService.generateFingerprintPreview();
            this.fingerprintPreview.set(preview);
        } catch (e) {
            this.fingerprintPreview.set(null);
            this.messageService.add({
                severity: 'error',
                summary: 'Generation Failed',
                detail: e instanceof Error ? e.message : 'Failed to generate fingerprint preview',
            });
        } finally {
            this.isLoadingPreview.set(false);
        }
    }

    protected async launchAndCheck(url: string): Promise<void> {
        if (!this.camoufoxService.isInstalled()) return;
        this.isLaunching.set(true);
        try {
            const dataDir = await appDataDir();
            const tempDir = dataDir + '/fingerprint-checker-profile';
            await this.camoufoxService.launch(tempDir, {
                block_webrtc: true,
                block_webgl: false,
                fingerprint: null,
                os: null,
            }, url);
        } catch (e) {
            this.messageService.add({
                severity: 'error',
                summary: 'Launch Failed',
                detail: e instanceof Error ? e.message : 'Failed to launch Camoufox browser',
            });
        } finally {
            this.isLaunching.set(false);
        }
    }

    protected openExternal(url: string): void {
        window.open(url, '_blank');
    }
}
