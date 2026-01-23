import { isDevMode } from '@angular/core';

/**
 * Debug logger that only logs in development mode.
 * Use this instead of console.log to avoid logging in production.
 */
export function debugLog(context: string, ...args: unknown[]): void {
    if (isDevMode()) {
        console.log(`[${context}]`, ...args);
    }
}
