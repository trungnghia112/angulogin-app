import { Pipe, PipeTransform } from '@angular/core';

/**
 * Transforms a timestamp string into a relative time description.
 *
 * Usage: {{ entry.timestamp | timeAgo }}  → "5m ago", "2h ago", "3d ago"
 *        Falls back to locale date for timestamps older than 7 days.
 */
@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
    transform(timestamp: string | null | undefined): string {
        if (!timestamp) return '';

        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60_000) return 'Just now';
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
        if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
        if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;

        return date.toLocaleDateString();
    }
}
