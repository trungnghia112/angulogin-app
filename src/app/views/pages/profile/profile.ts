import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../services/auth.service';
import { PlanService } from '../../../services/plan.service';
import { PLAN_CONFIG, TRIAL_DURATION_DAYS } from '../../../core/models/user.model';

@Component({
    selector: 'app-profile',
    templateUrl: './profile.html',
    styleUrl: './profile.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [FormsModule, ButtonModule, InputTextModule, PasswordModule, CardModule, TagModule, DividerModule],
})
export class Profile {
    protected readonly authService = inject(AuthService);
    protected readonly planService = inject(PlanService);
    private readonly messageService = inject(MessageService);

    // Edit state
    protected editingName = signal(false);
    protected editName = signal('');
    protected savingName = signal(false);

    // Change password state
    protected currentPassword = signal('');
    protected newPassword = signal('');
    protected confirmPassword = signal('');
    protected savingPassword = signal(false);

    // Computed
    protected readonly profile = this.authService.profile;
    protected readonly isPasswordUser = this.authService.isPasswordUser;
    protected readonly planConfig = computed(() => PLAN_CONFIG[this.planService.currentPlan()]);

    protected readonly trialDaysLeft = computed(() => {
        const p = this.profile();
        if (!p || p.plan !== 'trial') return null;
        const created = p.createdAt.toDate();
        const now = new Date();
        const elapsed = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        const left = Math.max(0, Math.ceil(TRIAL_DURATION_DAYS - elapsed));
        return left;
    });

    protected readonly planFeatures = computed(() => {
        const cfg = this.planConfig();
        return cfg.features.map(f => f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    });

    protected readonly memberSince = computed(() => {
        const p = this.profile();
        if (!p) return '';
        return p.createdAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    });

    protected readonly passwordsMatch = computed(() => {
        const np = this.newPassword();
        const cp = this.confirmPassword();
        return np.length > 0 && np === cp;
    });

    // --- Actions ---

    startEditName(): void {
        this.editName.set(this.authService.displayName());
        this.editingName.set(true);
    }

    cancelEditName(): void {
        this.editingName.set(false);
    }

    async saveDisplayName(): Promise<void> {
        const name = this.editName().trim();
        if (!name) return;
        this.savingName.set(true);
        try {
            await this.authService.updateDisplayName(name);
            this.editingName.set(false);
            this.messageService.add({ severity: 'success', summary: 'Updated', detail: 'Display name updated successfully' });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to update name';
            this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
        } finally {
            this.savingName.set(false);
        }
    }

    async onChangePassword(): Promise<void> {
        if (!this.passwordsMatch()) return;
        if (this.newPassword().length < 6) {
            this.messageService.add({ severity: 'warn', summary: 'Weak Password', detail: 'Password must be at least 6 characters' });
            return;
        }
        this.savingPassword.set(true);
        try {
            await this.authService.changePassword(this.currentPassword(), this.newPassword());
            this.currentPassword.set('');
            this.newPassword.set('');
            this.confirmPassword.set('');
            this.messageService.add({ severity: 'success', summary: 'Updated', detail: 'Password changed successfully' });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to change password';
            this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
        } finally {
            this.savingPassword.set(false);
        }
    }
}
