import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { Folder } from '../../../../models/folder.model';

@Component({
    selector: 'app-home-sidebar',
    templateUrl: './home-sidebar.html',
    styleUrl: './home-sidebar.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, InputTextModule, ButtonModule],
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



    protected getFolderIcon(folder: Folder): string {
        if (folder.icon) return folder.icon;
        return 'pi-folder';
    }

    protected getFolderColor(folder: Folder): string {
        return folder.color || '#71717a';
    }
}
