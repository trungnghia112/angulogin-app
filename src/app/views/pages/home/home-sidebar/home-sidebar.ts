import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Folder } from '../../../../models/folder.model';
import { isTauriAvailable } from '../../../../core/utils/platform.util';
import { debugLog } from '../../../../core/utils/logger.util';

@Component({
    selector: 'app-home-sidebar',
    templateUrl: './home-sidebar.html',
    styleUrl: './home-sidebar.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, InputTextModule, ButtonModule, DialogModule],
})
export class HomeSidebar {
    // Inputs
    readonly folders = input<Folder[]>([]);
    readonly selectedFolderId = input<string | null>(null);

    // Outputs
    readonly folderSelected = output<string | null>();
    readonly addFolderClicked = output<void>();
    readonly settingsClicked = output<void>();
    readonly folderSettingsClicked = output<void>();
    readonly profilesDirectoryChanged = output<string>();

    // Dialog state
    readonly showProfilesDirectoryDialog = signal(false);
    readonly profilesDirectoryPath = signal('');

    protected selectFolder(folderId: string | null): void {
        this.folderSelected.emit(folderId);
    }

    protected onAddFolder(): void {
        this.addFolderClicked.emit();
    }

    protected onSettings(): void {
        this.settingsClicked.emit();
    }

    protected onFolderSettings(): void {
        this.folderSettingsClicked.emit();
    }

    protected openProfilesDirectoryDialog(): void {
        this.showProfilesDirectoryDialog.set(true);
    }

    protected async browseFolder(): Promise<void> {
        // Only works in Tauri environment
        if (!isTauriAvailable()) {
            debugLog('HomeSidebar', 'browseFolder - Tauri not available');
            return;
        }

        try {
            // Dynamic import to avoid errors in web mode
            const { open } = await import('@tauri-apps/plugin-dialog');

            const selected = await open({
                directory: true,
                multiple: false,
                title: 'Select Chrome Profiles Directory',
            });

            if (selected && typeof selected === 'string') {
                this.profilesDirectoryPath.set(selected);
            }
        } catch (error) {
            console.error('Failed to open folder dialog:', error);
        }
    }

    protected saveProfilesDirectory(): void {
        const path = this.profilesDirectoryPath();
        if (path.trim()) {
            this.profilesDirectoryChanged.emit(path);
            this.showProfilesDirectoryDialog.set(false);
        }
    }

    protected getFolderIcon(folder: Folder): string {
        if (folder.icon) return folder.icon;
        return 'pi-folder';
    }

    protected getFolderColor(folder: Folder): string {
        return folder.color || '#71717a';
    }
}
