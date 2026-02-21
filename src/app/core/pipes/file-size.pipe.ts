import { Pipe, PipeTransform } from '@angular/core';

/**
 * Transforms a byte count into a human-readable file size string.
 *
 * Usage: {{ 1073741824 | fileSize }}    → "1.0 GB"
 *        {{ 524288000 | fileSize }}     → "500 MB"
 *        {{ 0 | fileSize }}             → "0 MB"
 */
@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
    transform(bytes: number | null | undefined): string {
        if (!bytes) return '0 MB';
        const gb = bytes / (1024 * 1024 * 1024);
        if (gb >= 1) return `${gb.toFixed(1)} GB`;
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(0)} MB`;
    }
}
