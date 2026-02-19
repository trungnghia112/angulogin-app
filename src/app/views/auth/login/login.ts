import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-login',
    templateUrl: './login.html',
    styleUrl: './login.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'block min-h-screen' },
    imports: [FormsModule, RouterLink, InputTextModule, PasswordModule, ButtonModule],
})
export class Login {
    private readonly authService = inject(AuthService);
    private readonly messageService = inject(MessageService);

    protected readonly loading = this.authService.loading;
    protected readonly email = signal('');
    protected readonly password = signal('');

    async onLogin(): Promise<void> {
        try {
            await this.authService.login(this.email(), this.password());
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Login failed';
            this.messageService.add({ severity: 'error', summary: 'Login Error', detail: msg });
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
