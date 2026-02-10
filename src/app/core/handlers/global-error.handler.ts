import { ErrorHandler, Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

/**
 * Global error handler that catches unhandled errors and shows
 * a user-friendly toast notification instead of crashing silently.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
    private readonly messageService = inject(MessageService);

    handleError(error: unknown): void {
        // Log to console for debugging (uses structured output)
        console.error('[GlobalErrorHandler]', error);

        // Extract user-friendly message
        const message = this.extractMessage(error);

        // Show toast notification
        this.messageService.add({
            severity: 'error',
            summary: 'Unexpected Error',
            detail: message,
            life: 8000,
        });
    }

    private extractMessage(error: unknown): string {
        if (error instanceof Error) {
            // Filter out noisy chunk loading errors (lazy load failures)
            if (error.message.includes('Loading chunk')) {
                return 'A page failed to load. Please refresh the app.';
            }
            return error.message;
        }

        if (typeof error === 'string') {
            return error;
        }

        return 'An unexpected error occurred. Please try again.';
    }
}
