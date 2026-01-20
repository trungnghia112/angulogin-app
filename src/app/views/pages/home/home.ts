import { ChangeDetectionStrategy, Component, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ProfileService } from '../../../services/profile.service';
import { SettingsService } from '../../../services/settings.service';
import { Profile } from '../../../models/profile.model';

const EMOJI_OPTIONS = ['💼', '🏠', '🛠️', '🎮', '📱', '💻', '🔒', '🌐', '📧', '🛒'];

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
export class Home implements OnDestroy {
    private readonly profileService = inject(ProfileService);
    private readonly settingsService = inject(SettingsService);
    private readonly messageService = inject(MessageService);
    private readonly confirmationService = inject(ConfirmationService);
    private statusInterval: ReturnType<typeof setInterval> | null = null;

    protected readonly profilesPath = signal(this.settingsService.getProfilesPath() || '');
    protected readonly profiles = this.profileService.profiles;
    protected readonly loading = this.profileService.loading;
    protected readonly emojiOptions = EMOJI_OPTIONS;

    // Dialog states
    protected readonly showCreateDialog = signal(false);
    protected readonly showRenameDialog = signal(false);
    protected readonly showEditDialog = signal(false);
    protected readonly newProfileName = signal('');
    protected readonly renameProfileName = signal('');
    protected readonly selectedProfile = signal<Profile | null>(null);
    protected readonly editEmoji = signal<string | null>(null);
    protected readonly editNotes = signal<string | null>(null);

    constructor() {
        const savedPath = this.settingsService.getProfilesPath();
        if (savedPath) {
            this.profilesPath.set(savedPath);
            this.scanProfiles();
        }
        // Refresh status every 10 seconds
        this.statusInterval = setInterval(() => {
            if (this.profiles().length > 0) {
                this.profileService.refreshProfileStatus();
            }
        }, 10000);
    }

    ngOnDestroy(): void {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }
    }

    getProfileDisplay(profile: Profile): string {
        return profile.metadata?.emoji || profile.name.charAt(0).toUpperCase();
    }

    getAvatarGradient(index: number): string {
        const gradients = [
            'linear-gradient(135deg, #6366F1, #8B5CF6)',
            'linear-gradient(135deg, #22D3EE, #06B6D4)',
            'linear-gradient(135deg, #F59E0B, #EF4444)',
            'linear-gradient(135deg, #22C55E, #10B981)',
            'linear-gradient(135deg, #EC4899, #8B5CF6)',
            'linear-gradient(135deg, #3B82F6, #1D4ED8)',
        ];
        return gradients[index % gradients.length];
    }

    async scanProfiles(): Promise<void> {
        const path = this.profilesPath();
        if (!path) {
            this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please enter a profiles path' });
            return;
        }

        try {
            const exists = await this.profileService.checkPathExists(path);
            if (!exists) {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Path does not exist' });
                return;
            }
            await this.profileService.scanProfiles(path);
            this.settingsService.setProfilesPath(path);
            this.messageService.add({ severity: 'success', summary: 'Success', detail: `Found ${this.profiles().length} profiles` });
        } catch (e) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: String(e) });
        }
    }

    async launchProfile(profile: Profile, event: Event): Promise<void> {
        event.stopPropagation();
        try {
            await this.profileService.launchChrome(profile.path);
            this.messageService.add({ severity: 'info', summary: 'Launched', detail: `Chrome opened: ${profile.name}` });
            // Refresh status after launch
            setTimeout(() => this.profileService.refreshProfileStatus(), 2000);
        } catch (e) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: String(e) });
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
        if (!name) return;
        try {
            await this.profileService.createProfile(this.profilesPath(), name);
            this.showCreateDialog.set(false);
            this.messageService.add({ severity: 'success', summary: 'Created', detail: `Profile "${name}" created` });
        } catch (e) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: String(e) });
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
        if (!profile || !newName || newName === profile.name) {
            this.showRenameDialog.set(false);
            return;
        }
        try {
            await this.profileService.renameProfile(profile.path, newName, this.profilesPath());
            this.showRenameDialog.set(false);
            this.messageService.add({ severity: 'success', summary: 'Renamed', detail: `Renamed to "${newName}"` });
        } catch (e) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: String(e) });
        }
    }

    // Edit Profile (Emoji + Notes)
    openEditDialog(profile: Profile, event: Event): void {
        event.stopPropagation();
        this.selectedProfile.set(profile);
        this.editEmoji.set(profile.metadata?.emoji || null);
        this.editNotes.set(profile.metadata?.notes || null);
        this.showEditDialog.set(true);
    }

    selectEmoji(emoji: string): void {
        this.editEmoji.set(this.editEmoji() === emoji ? null : emoji);
    }

    async saveProfileEdit(): Promise<void> {
        const profile = this.selectedProfile();
        if (!profile) return;
        try {
            await this.profileService.saveProfileMetadata(profile.path, this.editEmoji(), this.editNotes());
            this.showEditDialog.set(false);
            this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Profile updated' });
        } catch (e) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: String(e) });
        }
    }

    // Delete Profile
    deleteProfile(profile: Profile, event: Event): void {
        event.stopPropagation();
        this.confirmationService.confirm({
            key: 'confirmDialog',
            message: `Delete "${profile.name}"? This cannot be undone.`,
            header: 'Delete Profile',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger',
            accept: async () => {
                try {
                    await this.profileService.deleteProfile(profile.path, this.profilesPath());
                    this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `${profile.name} deleted` });
                } catch (e) {
                    this.messageService.add({ severity: 'error', summary: 'Error', detail: String(e) });
                }
            },
        });
    }
}
