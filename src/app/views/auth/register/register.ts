import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-register',
    templateUrl: './register.html',
    styleUrl: './register.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex items-center justify-center min-h-screen bg-surface-50 dark:bg-surface-950' },
    imports: [FormsModule, RouterLink, InputTextModule, PasswordModule, ButtonModule, DividerModule, CheckboxModule],
})
export class Register {
    private readonly authService = inject(AuthService);
    private readonly messageService = inject(MessageService);

    protected readonly loading = this.authService.loading;
    protected readonly displayName = signal('');
    protected readonly email = signal('');
    protected readonly password = signal('');
    protected readonly confirmPassword = signal('');
    protected readonly acceptTerms = signal(false);

    async onRegister(): Promise<void> {
        if (this.password() !== this.confirmPassword()) {
            this.messageService.add({ severity: 'warn', summary: 'Password Mismatch', detail: 'Passwords do not match' });
            return;
        }
        if (!this.acceptTerms()) {
            this.messageService.add({ severity: 'warn', summary: 'Terms Required', detail: 'Please accept the terms of service' });
            return;
        }
        try {
            await this.authService.register(this.email(), this.password(), this.displayName());
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Registration failed';
            this.messageService.add({ severity: 'error', summary: 'Register Error', detail: msg });
        }
    }

    async onGoogleLogin(): Promise<void> {
        try {
            await this.authService.loginWithGoogle();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Google login failed';
            this.messageService.add({ severity: 'error', summary: 'Login Error', detail: msg });
        }
    }
}
