import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
    OnDestroy,
    HostListener,
    computed,
    OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ProfileService } from '../../../services/profile.service';
import { SettingsService } from '../../../services/settings.service';
import { BrowserType, Profile } from '../../../models/profile.model';

const EMOJI_OPTIONS = ['💼', '🏠', '🛠️', '🎮', '📱', '💻', '🔒', '🌐', '📧', '🛒'];
const GROUP_OPTIONS = ['Work', 'Personal', 'Development', 'Social', 'Shopping', 'Other'];

const BROWSER_INFO: Record<string, { name: string; icon: string }> = {
    chrome: { name: 'Chrome', icon: 'pi-google' },
    brave: { name: 'Brave', icon: 'pi-shield' },
    edge: { name: 'Edge', icon: 'pi-microsoft' },
    arc: { name: 'Arc', icon: 'pi-circle' },
};

type TabKey = 'profiles' | 'proxies' | 'tags' | 'statuses' | 'extras';

interface Tab {
    key: TabKey;
    label: string;
    icon: string;
}

@Component({
    selector: 'app-home',
    templateUrl: './home.html',
    styleUrl: './home.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        TitleCasePipe,
        ButtonModule,
        InputTextModule,
        ProgressSpinnerModule,
        DialogModule,
        TableModule,
        PaginatorModule,
    ],
})
export class Home implements OnInit, OnDestroy {
    private readonly profileService = inject(ProfileService);
    private readonly settingsService = inject(SettingsService);
    private readonly messageService = inject(MessageService);
    private readonly confirmationService = inject(ConfirmationService);
    private statusInterval: ReturnType<typeof setInterval> | null = null;

    // Tabs
    protected readonly tabs: Tab[] = [
        { key: 'profiles', label: 'Profiles', icon: 'pi-th-large' },
        { key: 'proxies', label: 'Proxies', icon: 'pi-cloud' },
        { key: 'tags', label: 'Tags', icon: 'pi-tag' },
        { key: 'statuses', label: 'Statuses', icon: 'pi-circle' },
        { key: 'extras', label: 'Extras', icon: 'pi-cog' },
    ];
    protected readonly activeTab = signal<TabKey>('profiles');

    // Core state
    protected readonly profilesPath = signal(this.settingsService.getProfilesPath() || '');
    protected readonly profiles = this.profileService.profiles;
    protected readonly loading = this.profileService.loading;
    protected readonly selectedProfiles = signal<Profile[]>([]);

    // Table config
    protected readonly rowsPerPage = signal(5);
    protected readonly first = signal(0);

    // Options
    protected readonly emojiOptions = EMOJI_OPTIONS;
    protected readonly groupOptions = GROUP_OPTIONS;
    protected readonly shortcutOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    protected readonly browserInfo = BROWSER_INFO;
    protected readonly availableBrowsers = signal<string[]>(['chrome']);

    // Group filter
    protected readonly filterGroup = signal<string | null>(null);
    protected readonly filteredProfiles = computed(() => {
        const group = this.filterGroup();
        const all = this.profiles();
        if (!group) return all;
        return all.filter((p) => p.metadata?.group === group);
    });

    protected readonly uniqueGroups = computed(() => {
        const groups = this.profiles()
            .map((p) => p.metadata?.group)
            .filter((g): g is string => !!g);
        return [...new Set(groups)];
    });

    protected readonly profilesUsed = computed(() => this.profiles().length);
    protected readonly maxProfiles = signal(50);

    // Dialog states
    protected readonly showCreateDialog = signal(false);
    protected readonly showRenameDialog = signal(false);
    protected readonly showEditDialog = signal(false);
    protected readonly newProfileName = signal('');
    protected readonly renameProfileName = signal('');
    protected readonly selectedProfile = signal<Profile | null>(null);
    protected readonly editEmoji = signal<string | null>(null);
    protected readonly editNotes = signal<string | null>(null);
    protected readonly editGroup = signal<string | null>(null);
    protected readonly editShortcut = signal<number | null>(null);
    protected readonly editBrowser = signal<BrowserType | null>(null);

    async ngOnInit(): Promise<void> {
        const browsers = await this.profileService.listAvailableBrowsers();
        this.availableBrowsers.set(browsers);
    }

    constructor() {
        const savedPath = this.settingsService.getProfilesPath();
        if (savedPath) {
            this.profilesPath.set(savedPath);
            this.scanProfiles();
        }
        this.statusInterval = setInterval(() => {
            if (this.profiles().length > 0) {
                this.profileService.refreshProfileStatus();
            }
        }, 10000);
    }

    @HostListener('window:keydown', ['$event'])
    handleKeyboard(event: KeyboardEvent): void {
        if ((event.metaKey || event.ctrlKey) && event.key >= '1' && event.key <= '9') {
            const shortcutNum = parseInt(event.key, 10);
            const profile = this.profiles().find((p) => p.metadata?.shortcut === shortcutNum);
            if (profile) {
                event.preventDefault();
                this.launchProfileDirect(profile);
            }
        }
    }

    ngOnDestroy(): void {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }
    }

    // Tab methods
    protected setActiveTab(tab: TabKey): void {
        this.activeTab.set(tab);
    }

    // Profile display
    getProfileDisplay(profile: Profile): string {
        return profile.metadata?.emoji || profile.name.charAt(0).toUpperCase();
    }

    getBrowserName(browser: string | null | undefined): string {
        if (!browser) return 'Chrome';
        return BROWSER_INFO[browser]?.name || browser;
    }

    getOsIcon(profile: Profile): string {
        const osIcon = profile.osIcon;
        switch (osIcon) {
            case 'apple':
                return 'pi-apple';
            case 'windows':
                return 'pi-microsoft';
            case 'android':
                return 'pi-android';
            default:
                return 'pi-desktop';
        }
    }

    formatSize(bytes: number | undefined): string {
        if (!bytes) return '';
        const gb = bytes / (1024 * 1024 * 1024);
        if (gb >= 1) return `${gb.toFixed(1)} GB`;
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(0)} MB`;
    }

    // Profile actions
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
                    detail: 'Path does not exist',
                });
                return;
            }
            await this.profileService.scanProfiles(path);
            this.settingsService.setProfilesPath(path);
            this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: `Found ${this.profiles().length} profiles`,
            });
            this.profileService.loadProfileSizes();
        } catch (e) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: String(e) });
        }
    }

    async launchProfileDirect(profile: Profile): Promise<void> {
        try {
            const browser = profile.metadata?.browser || 'chrome';
            await this.profileService.launchBrowser(profile.path, browser);
            this.messageService.add({
                severity: 'info',
                summary: 'Launched',
                detail: `${this.getBrowserName(browser)}: ${profile.name}`,
            });
            setTimeout(() => this.profileService.refreshProfileStatus(), 2000);
        } catch (e) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: String(e) });
        }
    }

    async launchProfile(profile: Profile, event: Event): Promise<void> {
        event.stopPropagation();
        await this.launchProfileDirect(profile);
    }

    onPathChange(value: string): void {
        this.profilesPath.set(value);
    }

    setFilterGroup(group: string | null): void {
        this.filterGroup.set(this.filterGroup() === group ? null : group);
    }

    // Dialog methods
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
            this.messageService.add({
                severity: 'success',
                summary: 'Created',
                detail: `Profile "${name}" created`,
            });
        } catch (e) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: String(e) });
        }
    }

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
            this.messageService.add({
                severity: 'success',
                summary: 'Renamed',
                detail: `Renamed to "${newName}"`,
            });
        } catch (e) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: String(e) });
        }
    }

    openEditDialog(profile: Profile, event: Event): void {
        event.stopPropagation();
        this.selectedProfile.set(profile);
        this.editEmoji.set(profile.metadata?.emoji || null);
        this.editNotes.set(profile.metadata?.notes || null);
        this.editGroup.set(profile.metadata?.group || null);
        this.editShortcut.set(profile.metadata?.shortcut || null);
        this.editBrowser.set(profile.metadata?.browser || null);
        this.showEditDialog.set(true);
    }

    selectEmoji(emoji: string): void {
        this.editEmoji.set(this.editEmoji() === emoji ? null : emoji);
    }

    selectGroup(group: string): void {
        this.editGroup.set(this.editGroup() === group ? null : group);
    }

    selectShortcut(num: number): void {
        const profile = this.selectedProfile();
        const existing = this.profiles().find(
            (p) => p.metadata?.shortcut === num && p.path !== profile?.path
        );
        if (existing) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Warning',
                detail: `Shortcut Cmd+${num} already used by "${existing.name}"`,
            });
            return;
        }
        this.editShortcut.set(this.editShortcut() === num ? null : num);
    }

    selectBrowser(browser: BrowserType): void {
        this.editBrowser.set(this.editBrowser() === browser ? null : browser);
    }

    async saveProfileEdit(): Promise<void> {
        const profile = this.selectedProfile();
        if (!profile) return;
        try {
            await this.profileService.saveProfileMetadata(
                profile.path,
                this.editEmoji(),
                this.editNotes(),
                this.editGroup(),
                this.editShortcut(),
                this.editBrowser()
            );
            this.showEditDialog.set(false);
            this.messageService.add({
                severity: 'success',
                summary: 'Saved',
                detail: 'Profile updated',
            });
        } catch (e) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: String(e) });
        }
    }

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
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Deleted',
                        detail: `${profile.name} deleted`,
                    });
                } catch (e) {
                    this.messageService.add({ severity: 'error', summary: 'Error', detail: String(e) });
                }
            },
        });
    }

    // Selection
    onSelectionChange(selected: Profile[]): void {
        this.selectedProfiles.set(selected);
    }

    // Pagination
    onPageChange(event: { first: number; rows: number }): void {
        this.first.set(event.first);
        this.rowsPerPage.set(event.rows);
    }

    onPaginatorChange(event: PaginatorState): void {
        if (event.first !== undefined) {
            this.first.set(event.first);
        }
        if (event.rows !== undefined) {
            this.rowsPerPage.set(event.rows);
        }
    }
}
