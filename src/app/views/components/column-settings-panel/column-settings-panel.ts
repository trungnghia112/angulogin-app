import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ColumnConfigService } from '../../../core/services/column-config.service';
import { ColumnConfig, ColumnId } from '../../../models/column-config.model';

@Component({
    selector: 'app-column-settings-panel',
    templateUrl: './column-settings-panel.html',
    styleUrl: './column-settings-panel.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DragDropModule, ButtonModule, TooltipModule],
})
export class ColumnSettingsPanel {
    private readonly columnConfig = inject(ColumnConfigService);

    readonly visible = input<boolean>(false);
    readonly visibleChange = output<boolean>();

    readonly columns = this.columnConfig.columns;
    readonly toggleableColumns = this.columnConfig.toggleableColumns;

    close(): void {
        this.visibleChange.emit(false);
    }

    toggleColumn(id: ColumnId): void {
        this.columnConfig.toggleColumn(id);
    }

    isVisible(id: ColumnId): boolean {
        return this.columnConfig.isVisible(id);
    }

    onDrop(event: CdkDragDrop<ColumnConfig[]>): void {
        const toggleable = this.toggleableColumns();
        const allColumns = this.columns();

        // Map toggleable indices to allColumns indices
        const fromAllIndex = allColumns.findIndex(
            (c) => c.id === toggleable[event.previousIndex].id
        );
        const toAllIndex = allColumns.findIndex(
            (c) => c.id === toggleable[event.currentIndex].id
        );

        if (fromAllIndex !== -1 && toAllIndex !== -1) {
            this.columnConfig.moveColumn(fromAllIndex, toAllIndex);
        }
    }

    resetDefaults(): void {
        this.columnConfig.resetToDefaults();
    }

    getColumnIcon(id: ColumnId): string {
        const iconMap: Record<string, string> = {
            pin: 'pi pi-star',
            status: 'pi pi-circle',
            proxy: 'pi pi-globe',
            tags: 'pi pi-tag',
            notes: 'pi pi-pencil',
            lastChanged: 'pi pi-calendar',
            runningTime: 'pi pi-clock',
            size: 'pi pi-database',
            launchCount: 'pi pi-play',
            browser: 'pi pi-desktop',
            group: 'pi pi-folder',
        };
        return iconMap[id] || 'pi pi-list';
    }
}
