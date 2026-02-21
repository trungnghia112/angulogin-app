import { Pipe, PipeTransform } from '@angular/core';

/**
 * Transforms a number of minutes into a human-readable duration string.
 *
 * Usage: {{ 150 | duration }}          → "2h 30m"
 *        {{ 5 | duration }}            → "5m"
 *        {{ 0 | duration }}            → "0m"
 *        {{ 1500 | duration }}         → "1d 1h"
 *        {{ 150 | duration:'long' }}   → "2 hours 30 minutes"
 */
@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
    transform(minutes: number | null | undefined, format: 'short' | 'long' = 'short'): string {
        if (!minutes) return '0m';

        if (format === 'long') {
            return this.formatLong(minutes);
        }

        if (minutes < 60) return `${Math.round(minutes)}m`;
        const hours = Math.floor(minutes / 60);

        if (hours < 24) {
            const mins = Math.round(minutes % 60);
            return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        }

        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }

    private formatLong(minutes: number): string {
        if (minutes < 60) {
            return `${Math.round(minutes)} minute${minutes !== 1 ? 's' : ''}`;
        }
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        const hourStr = `${hours} hour${hours !== 1 ? 's' : ''}`;
        if (mins === 0) return hourStr;
        return `${hourStr} ${mins} minute${mins !== 1 ? 's' : ''}`;
    }
}
