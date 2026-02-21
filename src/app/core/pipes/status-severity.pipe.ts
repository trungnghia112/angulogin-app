import { Pipe, PipeTransform } from '@angular/core';

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

/**
 * Maps a status string to a PrimeNG Tag severity.
 *
 * Usage: [severity]="task.status | statusSeverity"
 *
 * Default mapping:
 *   running  → info
 *   completed/success → success
 *   failed/error      → danger
 *   paused/warning    → warn
 *   cancelled/pending → secondary
 */
@Pipe({ name: 'statusSeverity' })
export class StatusSeverityPipe implements PipeTransform {
    private static readonly MAP: Record<string, TagSeverity> = {
        running: 'info',
        active: 'info',
        completed: 'success',
        success: 'success',
        failed: 'danger',
        error: 'danger',
        paused: 'warn',
        warning: 'warn',
        cancelled: 'secondary',
        pending: 'secondary',
    };

    transform(status: string | null | undefined): TagSeverity {
        if (!status) return 'secondary';
        return StatusSeverityPipe.MAP[status.toLowerCase()] ?? 'secondary';
    }
}
