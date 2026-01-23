import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
    OnDestroy,
    computed,
    OnInit,
    effect,
    DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
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
    host: {
        '(window:keydown)': 'handleKeyboard($event)',
    },
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
    private readonly destroyRef = inject(DestroyRef);
    private readonly searchSubject = new Subject<string>();
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
    protected readonly profilesPath = computed(() => this.settingsService.settings().profilesPath || '');
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

    // Search & Filter
    protected readonly searchText = signal('');
    protected readonly filterGroup = signal<string | null>(null);
    protected readonly showFiltersDropdown = signal(false);

    // Sorting
    protected readonly sortBy = signal<'name' | 'size' | 'lastOpened'>('name');
    protected readonly sortOrder = signal<'asc' | 'desc'>('asc');
    protected readonly showSortDropdown = signal(false);
    protected readonly sortOptions = [
        { label: 'Name', value: 'name' as const },
        { label: 'Size', value: 'size' as const },
        { label: 'Last Used', value: 'lastOpened' as const },
    ];
    protected readonly currentSortLabel = computed(() => {
        const option = this.sortOptions.find(o => o.value === this.sortBy());
        return option?.label || 'Sort';
    });

    protected readonly filteredProfiles = computed(() => {
        let result = this.profiles();
        const search = this.searchText().toLowerCase().trim();
        const group = this.filterGroup();

        // Apply search filter
        if (search) {
            result = result.filter(
                (p) =>
                    p.name.toLowerCase().includes(search) ||
                    p.metadata?.notes?.toLowerCase().includes(search) ||
                    p.metadata?.group?.toLowerCase().includes(search)
            );
        }

        // Apply group filter
        if (group) {
            result = result.filter((p) => p.metadata?.group === group);
        }

        // Sort: pinned profiles first, then by selected criteria
        const sortByValue = this.sortBy();
        const sortOrderValue = this.sortOrder();
        const multiplier = sortOrderValue === 'asc' ? 1 : -1;

        return result.sort((a, b) => {
            const aPinned = a.metadata?.isPinned ? 1 : 0;
            const bPinned = b.metadata?.isPinned ? 1 : 0;
            if (bPinned !== aPinned) return bPinned - aPinned;

            switch (sortByValue) {
                case 'size':
                    return ((a.size || 0) - (b.size || 0)) * multiplier;
                case 'lastOpened':
                    const aDate = a.metadata?.lastOpened ? new Date(a.metadata.lastOpened).getTime() : 0;
                    const bDate = b.metadata?.lastOpened ? new Date(b.metadata.lastOpened).getTime() : 0;
                    return (bDate - aDate) * multiplier; // Most recent first by default
                case 'name':
                default:
                    return a.name.localeCompare(b.name) * multiplier;
            }
        });
    });

    protected readonly uniqueGroups = computed(() => {
        const groups = this.profiles()
            .map((p) => p.metadata?.group)
            .filter((g): g is string => !!g);
        return [...new Set(groups)];
    });

    protected readonly hasActiveFilters = computed(
        () => this.searchText().trim() !== '' || this.filterGroup() !== null
    );

    protected readonly activeFilterCount = computed(() => {
        let count = 0;
        if (this.searchText().trim() !== '') count++;
        if (this.filterGroup() !== null) count++;
        return count;
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
    // New edit signals for Tags, Launch URL, Pinning
    protected readonly editTags = signal<string[]>([]);
    protected readonly editLaunchUrl = signal<string | null>(null);
    protected readonly editIsPinned = signal<boolean>(false);

    // Duplicate dialog
    protected readonly showDuplicateDialog = signal(false);
    protected readonly duplicateProfileName = signal('');

    // Available tags from all profiles
    protected readonly availableTags = computed(() => {
        const all = this.profiles().flatMap((p) => p.metadata?.tags || []);
        return [...new Set(all)];
    });

    async ngOnInit(): Promise<void> {
        const browsers = await this.profileService.listAvailableBrowsers();
        this.availableBrowsers.set(browsers);
    }

    constructor() {
        // Auto-scan whenever the profiles path changes
        effect(() => {
            const path = this.profilesPath();
            if (path) {
                this.scanProfiles();
            }
        });

        // Start status refresh interval (30s instead of 10s for better performance)
        this.startStatusInterval();

        // Pause refresh when tab is not visible
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // Debounced search
        this.searchSubject
            .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
            .subscribe((value) => {
                this.searchText.set(value);
            });
    }

    private handleVisibilityChange = (): void => {
        if (document.hidden) {
            this.stopStatusInterval();
        } else {
            this.startStatusInterval();
            // Refresh immediately when tab becomes visible
            if (this.profiles().length > 0) {
                this.profileService.refreshProfileStatus();
            }
        }
    };

    private startStatusInterval(): void {
        if (this.statusInterval) return;
        this.statusInterval = setInterval(() => {
            if (this.profiles().length > 0 && !document.hidden) {
                this.profileService.refreshProfileStatus();
            }
        }, 30000); // 30 seconds instead of 10
    }

    private stopStatusInterval(): void {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
        }
    }

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
        this.stopStatusInterval();
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
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
            const url = profile.metadata?.launchUrl || undefined;
            await this.profileService.launchBrowser(profile.path, browser, url);
            this.messageService.add({
                severity: 'info',
                summary: 'Launched',
                detail: `${this.getBrowserName(browser)}: ${profile.name}${url ? ' → ' + url : ''}`,
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
        this.settingsService.setProfilesPath(value);
    }

    setFilterGroup(group: string | null): void {
        this.filterGroup.set(this.filterGroup() === group ? null : group);
    }

    onSearchInput(value: string): void {
        this.searchSubject.next(value);
    }

    toggleFiltersDropdown(): void {
        this.showFiltersDropdown.update((v) => !v);
    }

    closeFiltersDropdown(): void {
        this.showFiltersDropdown.set(false);
    }

    clearFilters(): void {
        this.searchText.set('');
        this.filterGroup.set(null);
        this.showFiltersDropdown.set(false);
    }

    setSortBy(value: 'name' | 'size' | 'lastOpened'): void {
        if (this.sortBy() === value) {
            // Toggle order if same field
            this.sortOrder.set(this.sortOrder() === 'asc' ? 'desc' : 'asc');
        } else {
            this.sortBy.set(value);
            this.sortOrder.set('asc');
        }
        this.showSortDropdown.set(false);
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
        // New fields
        this.editTags.set(profile.metadata?.tags || []);
        this.editLaunchUrl.set(profile.metadata?.launchUrl || null);
        this.editIsPinned.set(profile.metadata?.isPinned || false);
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

    addTag(event: Event): void {
        const input = event.target as HTMLInputElement;
        const tag = input.value.trim();
        if (tag && !this.editTags().includes(tag)) {
            this.editTags.update((tags) => [...tags, tag]);
            input.value = '';
        }
        event.preventDefault();
    }

    removeTag(index: number): void {
        this.editTags.update((tags) => tags.filter((_, i) => i !== index));
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
                this.editBrowser(),
                this.editTags().length > 0 ? this.editTags() : null,
                this.editLaunchUrl(),
                this.editIsPinned() || null
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

    async togglePin(profile: Profile, event: Event): Promise<void> {
        event.stopPropagation();
        const newPinned = !profile.metadata?.isPinned;
        try {
            await this.profileService.saveProfileMetadata(
                profile.path,
                profile.metadata?.emoji || null,
                profile.metadata?.notes || null,
                profile.metadata?.group || null,
                profile.metadata?.shortcut || null,
                profile.metadata?.browser || null,
                profile.metadata?.tags || null,
                profile.metadata?.launchUrl || null,
                newPinned
            );
            this.messageService.add({
                severity: 'success',
                summary: newPinned ? 'Pinned' : 'Unpinned',
                detail: `${profile.name} ${newPinned ? 'pinned to top' : 'unpinned'}`,
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

    // Duplicate Profile
    openDuplicateDialog(profile: Profile, event: Event): void {
        event.stopPropagation();
        this.selectedProfile.set(profile);
        this.duplicateProfileName.set(`${profile.name} (Copy)`);
        this.showDuplicateDialog.set(true);
    }

    async duplicateProfile(): Promise<void> {
        const profile = this.selectedProfile();
        const newName = this.duplicateProfileName().trim();
        if (!profile || !newName) {
            this.showDuplicateDialog.set(false);
            return;
        }
        try {
            await this.profileService.duplicateProfile(profile.path, newName, this.profilesPath());
            this.showDuplicateDialog.set(false);
            this.messageService.add({
                severity: 'success',
                summary: 'Duplicated',
                detail: `Created "${newName}" from "${profile.name}"`,
            });
        } catch (e) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: String(e) });
        }
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

    // ==== Bulk Actions ====

    async bulkLaunch(): Promise<void> {
        const profiles = this.selectedProfiles();
        if (profiles.length === 0) return;

        for (const profile of profiles) {
            const browser = profile.metadata?.browser || 'chrome';
            const url = profile.metadata?.launchUrl || undefined;
            try {
                await this.profileService.launchBrowser(profile.path, browser, url);
            } catch (e) {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: `Failed to launch ${profile.name}`,
                });
            }
        }

        this.messageService.add({
            severity: 'success',
            summary: 'Launched',
            detail: `${profiles.length} profiles launched`,
        });
    }

    bulkDelete(): void {
        const profiles = this.selectedProfiles();
        if (profiles.length === 0) return;

        this.confirmationService.confirm({
            key: 'confirmDialog',
            message: `Are you sure you want to delete ${profiles.length} profiles?`,
            header: 'Delete Multiple Profiles',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger',
            accept: async () => {
                let deleted = 0;
                for (const profile of profiles) {
                    try {
                        await this.profileService.deleteProfile(profile.path, this.profilesPath());
                        deleted++;
                    } catch (e) {
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: `Failed to delete ${profile.name}`,
                        });
                    }
                }
                this.selectedProfiles.set([]);
                this.messageService.add({
                    severity: 'success',
                    summary: 'Deleted',
                    detail: `${deleted} profiles deleted`,
                });
            },
        });
    }

    clearSelection(): void {
        this.selectedProfiles.set([]);
    }
}
