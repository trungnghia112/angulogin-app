import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-forgot-password',
    templateUrl: './forgot-password.html',
    styleUrl: './forgot-password.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex items-center justify-center min-h-screen bg-surface-50 dark:bg-surface-950' },
    imports: [FormsModule, RouterLink, InputTextModule, ButtonModule],
})
export class ForgotPassword {
    private readonly authService = inject(AuthService);
    private readonly messageService = inject(MessageService);

    protected readonly loading = this.authService.loading;
    protected readonly email = signal('');
    protected readonly sent = signal(false);

    async onSubmit(): Promise<void> {
        try {
            await this.authService.forgotPassword(this.email());
            this.sent.set(true);
            this.messageService.add({ severity: 'success', summary: 'Email Sent', detail: 'Check your inbox for the reset link' });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to send reset email';
            this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
        }
    }
}
