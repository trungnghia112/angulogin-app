import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { BrowserManagerService } from '../../../../services/browser-manager.service';

@Component({
    selector: 'app-download-browser-dialog',
    templateUrl: './download-browser-dialog.html',
    styleUrl: './download-browser-dialog.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DialogModule, ButtonModule, ProgressBarModule],
})
export class DownloadBrowserDialog {
    private readonly browserManager = inject(BrowserManagerService);

    readonly visible = true;
    readonly isDownloading = this.browserManager.isDownloading;
    readonly downloadProgress = this.browserManager.downloadProgress;
    readonly downloadStatus = this.browserManager.downloadStatus;

    readonly onDownloadComplete = output<void>();
    readonly onSkip = output<void>();

    async startDownload(): Promise<void> {
        try {
            await this.browserManager.download();
            this.onDownloadComplete.emit();
        } catch {
            // Error handled by service signal
        }
    }

    skip(): void {
        this.onSkip.emit();
    }
}
