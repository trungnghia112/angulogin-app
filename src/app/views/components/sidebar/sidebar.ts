import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Folder } from '../../../models/folder.model';

@Component({
    selector: 'app-sidebar',
    templateUrl: './sidebar.html',
    styleUrl: './sidebar.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, InputTextModule, ButtonModule, DialogModule],
})
export class Sidebar {
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
