import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService, MessageService } from 'primeng/api';
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
        DialogModule,
    ],
})
export class Home {
    private readonly profileService = inject(ProfileService);
    private readonly settingsService = inject(SettingsService);
    private readonly messageService = inject(MessageService);
    private readonly confirmationService = inject(ConfirmationService);

    protected readonly profilesPath = signal(this.settingsService.getProfilesPath() || '');
    protected readonly profiles = this.profileService.profiles;
    protected readonly loading = this.profileService.loading;

    // Dialog states
    protected readonly showCreateDialog = signal(false);
    protected readonly showRenameDialog = signal(false);
    protected readonly newProfileName = signal('');
    protected readonly renameProfileName = signal('');
    protected readonly selectedProfile = signal<Profile | null>(null);

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

    async launchProfile(profile: Profile, event: Event): Promise<void> {
        event.stopPropagation();
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

    // Create Profile
    openCreateDialog(): void {
        this.newProfileName.set('');
        this.showCreateDialog.set(true);
    }

    async createProfile(): Promise<void> {
        const name = this.newProfileName().trim();
        if (!name) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Warning',
                detail: 'Please enter a profile name',
            });
            return;
        }

        try {
            await this.profileService.createProfile(this.profilesPath(), name);
            this.showCreateDialog.set(false);
            this.messageService.add({
                severity: 'success',
                summary: 'Created',
                detail: `Profile "${name}" created successfully`,
            });
        } catch (e) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: String(e),
            });
        }
    }

    // Rename Profile
    openRenameDialog(profile: Profile, event: Event): void {
        event.stopPropagation();
        this.selectedProfile.set(profile);
        this.renameProfileName.set(profile.name);
        this.showRenameDialog.set(true);
    }

    async renameProfile(): Promise<void> {
        const profile = this.selectedProfile();
        const newName = this.renameProfileName().trim();

        if (!profile || !newName) {
            return;
        }

        if (newName === profile.name) {
            this.showRenameDialog.set(false);
            return;
        }

        try {
            await this.profileService.renameProfile(profile.path, newName, this.profilesPath());
            this.showRenameDialog.set(false);
            this.messageService.add({
                severity: 'success',
                summary: 'Renamed',
                detail: `Profile renamed to "${newName}"`,
            });
        } catch (e) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: String(e),
            });
        }
    }

    // Delete Profile
    deleteProfile(profile: Profile, event: Event): void {
        event.stopPropagation();
        this.confirmationService.confirm({
            key: 'confirmDialog',
            message: `Are you sure you want to delete "${profile.name}"? This cannot be undone.`,
            header: 'Delete Profile',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger',
            accept: async () => {
                try {
                    await this.profileService.deleteProfile(profile.path, this.profilesPath());
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Deleted',
                        detail: `Profile "${profile.name}" deleted`,
                    });
                } catch (e) {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: String(e),
                    });
                }
            },
        });
    }
}
