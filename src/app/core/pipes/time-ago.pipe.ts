import { Pipe, PipeTransform } from '@angular/core';

/**
 * Transforms a timestamp string into a relative time description.
 *
 * Usage: {{ entry.timestamp | timeAgo }}          → "5m ago", "2h ago", "3d ago"
 *        {{ entry.timestamp | timeAgo:'-' }}      → uses '-' as fallback for null/undefined
 *        Falls back to formatted date for timestamps older than 30 days.
 */
@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
    transform(timestamp: string | null | undefined, fallback = ''): string {
        if (!timestamp) return fallback;

        try {
            const date = new Date(timestamp);
            const now = Date.now();
            const diff = now - date.getTime();

            if (diff < 60_000) return 'Just now';
            if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
            if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
            if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
            if (diff < 2_592_000_000) return `${Math.floor(diff / 604_800_000)}w ago`;

            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch {
            return fallback;
        }
    }
}
