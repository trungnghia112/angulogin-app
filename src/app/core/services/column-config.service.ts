import { Injectable, signal, computed } from '@angular/core';
import {
    ColumnConfig,
    ColumnId,
    DEFAULT_COLUMNS,
    STORAGE_KEY_COLUMNS,
} from '../../models/column-config.model';

@Injectable({ providedIn: 'root' })
export class ColumnConfigService {
    private readonly columnsSignal = signal<ColumnConfig[]>(this.loadColumns());

    /** All columns in their current order */
    readonly columns = this.columnsSignal.asReadonly();

    /** Only visible columns */
    readonly visibleColumns = computed(() =>
        this.columnsSignal().filter((c) => c.visible)
    );

    /** Total visible column count (for colspan in empty message) */
    readonly visibleColumnCount = computed(() => this.visibleColumns().length);

    /** Toggleable columns (not fixed) */
    readonly toggleableColumns = computed(() =>
        this.columnsSignal().filter((c) => !c.fixed)
    );

    toggleColumn(id: ColumnId): void {
        const cols = this.columnsSignal();
        const col = cols.find((c) => c.id === id);
        if (!col || col.fixed) return;

        const updated = cols.map((c) =>
            c.id === id ? { ...c, visible: !c.visible } : c
        );
        this.columnsSignal.set(updated);
        this.saveColumns(updated);
    }

    setColumnVisible(id: ColumnId, visible: boolean): void {
        const cols = this.columnsSignal();
        const col = cols.find((c) => c.id === id);
        if (!col || col.fixed) return;

        const updated = cols.map((c) =>
            c.id === id ? { ...c, visible } : c
        );
        this.columnsSignal.set(updated);
        this.saveColumns(updated);
    }

    moveColumn(fromIndex: number, toIndex: number): void {
        const cols = [...this.columnsSignal()];
        const [moved] = cols.splice(fromIndex, 1);
        cols.splice(toIndex, 0, moved);
        this.columnsSignal.set(cols);
        this.saveColumns(cols);
    }

    isVisible(id: ColumnId): boolean {
        const col = this.columnsSignal().find((c) => c.id === id);
        return col?.visible ?? false;
    }

    resetToDefaults(): void {
        const defaults = DEFAULT_COLUMNS.map((c) => ({ ...c }));
        this.columnsSignal.set(defaults);
        this.saveColumns(defaults);
    }

    private loadColumns(): ColumnConfig[] {
        if (typeof localStorage === 'undefined') {
            return DEFAULT_COLUMNS.map((c) => ({ ...c }));
        }

        try {
            const saved = localStorage.getItem(STORAGE_KEY_COLUMNS);
            if (!saved) return DEFAULT_COLUMNS.map((c) => ({ ...c }));

            const parsed: { id: ColumnId; visible: boolean }[] =
                JSON.parse(saved);
            if (!Array.isArray(parsed)) {
                return DEFAULT_COLUMNS.map((c) => ({ ...c }));
            }

            // Merge saved preferences with defaults (handles new columns added in updates)
            const savedMap = new Map(parsed.map((p) => [p.id, p.visible]));
            const merged: ColumnConfig[] = [];

            // First, add columns in saved order
            for (const p of parsed) {
                const def = DEFAULT_COLUMNS.find((d) => d.id === p.id);
                if (def) {
                    merged.push({
                        ...def,
                        visible: def.fixed ? true : p.visible,
                    });
                }
            }

            // Then add any new columns not in saved config
            for (const def of DEFAULT_COLUMNS) {
                if (!savedMap.has(def.id)) {
                    merged.push({ ...def });
                }
            }

            return merged;
        } catch {
            return DEFAULT_COLUMNS.map((c) => ({ ...c }));
        }
    }

    private saveColumns(columns: ColumnConfig[]): void {
        if (typeof localStorage === 'undefined') return;
        // Only save id + visible + order — other props come from defaults
        const toSave = columns.map((c) => ({ id: c.id, visible: c.visible }));
        localStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(toSave));
    }
}
