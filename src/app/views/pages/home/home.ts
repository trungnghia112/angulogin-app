import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { ProfileService } from '../../../services/profile.service';
import { SettingsService } from '../../../services/settings.service';
import { Profile } from '../../../models/profile.model';

const AVATAR_GRADIENTS = [
    'linear-gradient(135deg, #6366F1, #8B5CF6)',
    'linear-gradient(135deg, #22D3EE, #06B6D4)',
    'linear-gradient(135deg, #F59E0B, #EF4444)',
    'linear-gradient(135deg, #22C55E, #10B981)',
    'linear-gradient(135deg, #EC4899, #8B5CF6)',
    'linear-gradient(135deg, #3B82F6, #1D4ED8)',
];

@Component({
    selector: 'app-home',
    templateUrl: './home.html',
    styleUrl: './home.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        ButtonModule,
        InputTextModule,
        ProgressSpinnerModule,
    ],
})
export class Home {
    private readonly profileService = inject(ProfileService);
    private readonly settingsService = inject(SettingsService);
    private readonly messageService = inject(MessageService);

    protected readonly profilesPath = signal(this.settingsService.getProfilesPath() || '');
    protected readonly profiles = this.profileService.profiles;
    protected readonly loading = this.profileService.loading;

    constructor() {
        const savedPath = this.settingsService.getProfilesPath();
        if (savedPath) {
            this.profilesPath.set(savedPath);
            this.scanProfiles();
        }
    }

    getAvatarGradient(index: number): string {
        return AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
    }

    async scanProfiles(): Promise<void> {
        const path = this.profilesPath();
        if (!path) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Warning',
                detail: 'Please enter a profiles path',
            });
            return;
        }

        try {
            const exists = await this.profileService.checkPathExists(path);
            if (!exists) {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Path does not exist. Is your external drive connected?',
                });
                return;
            }

            await this.profileService.scanProfiles(path);
            this.settingsService.setProfilesPath(path);

            const count = this.profiles().length;
            this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: `Found ${count} profile${count === 1 ? '' : 's'}`,
            });
        } catch (e) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: String(e),
            });
        }
    }

    async launchProfile(profile: Profile): Promise<void> {
        try {
            await this.profileService.launchChrome(profile.path);
            this.messageService.add({
                severity: 'info',
                summary: 'Launched',
                detail: `Chrome opened with profile: ${profile.name}`,
            });
        } catch (e) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: String(e),
            });
        }
    }

    onPathChange(value: string): void {
        this.profilesPath.set(value);
    }
}
