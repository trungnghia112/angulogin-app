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
import { Router } from '@angular/router';
import { HomeSidebar } from './home-sidebar/home-sidebar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ButtonGroupModule } from 'primeng/buttongroup';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { TooltipModule } from 'primeng/tooltip';
import { MenuModule } from 'primeng/menu';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { ProfileService } from '../../../services/profile.service';
import { SettingsService } from '../../../core/services/settings.service';
import { ActivityLogService } from '../../../services/activity-log.service';
import { BrowserType, Profile } from '../../../models/profile.model';

const EMOJI_OPTIONS = ['💼', '🏠', '🛠️', '🎮', '📱', '💻', '🔒', '🌐', '📧', '🛒'];
const GROUP_OPTIONS = ['Work', 'Personal', 'Development', 'Social', 'Shopping', 'Other'];

// Phase 1: Color options for profile color coding
const COLOR_OPTIONS = [
    { name: 'red', hex: '#ef4444', label: 'Red' },
    { name: 'orange', hex: '#f97316', label: 'Orange' },
    { name: 'yellow', hex: '#eab308', label: 'Yellow' },
    { name: 'green', hex: '#22c55e', label: 'Green' },
    { name: 'blue', hex: '#3b82f6', label: 'Blue' },
    { name: 'purple', hex: '#a855f7', label: 'Purple' },
    { name: 'pink', hex: '#ec4899', label: 'Pink' },
    { name: 'gray', hex: '#6b7280', label: 'Gray' },
];

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
        class: 'flex-1 flex min-h-0 overflow-hidden',
        '(window:keydown)': 'handleKeyboard($event)',
    },
    imports: [
        FormsModule,
        TitleCasePipe,
        ButtonModule,
        InputTextModule,

        IconFieldModule,
        InputIconModule,
        ButtonGroupModule,
        ProgressSpinnerModule,
        DialogModule,
        TableModule,
        PaginatorModule,
        TooltipModule,
        MenuModule,
        HomeSidebar,
        DragDropModule,
    ],
})
export class Home implements OnInit, OnDestroy {
    private readonly router = inject(Router);
    private readonly profileService = inject(ProfileService);
    private readonly settingsService = inject(SettingsService);
    private readonly activityLogService = inject(ActivityLogService);
    private readonly messageService = inject(MessageService);
    private readonly confirmationService = inject(ConfirmationService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly searchSubject = new Subject<string>();
    private statusInterval: ReturnType<typeof setInterval> | null = null;

    // Sidebar Data (Moved from Pages)
    protected readonly folders = signal<import('../../../models/folder.model').Folder[]>([
        { id: '1', name: 'Amazon', icon: 'pi-amazon', color: '#FF9900', profileCount: 5 },
        { id: '2', name: 'Crypto', icon: 'pi-wallet', color: '#71717a', profileCount: 3 },
        { id: '3', name: 'New Folder', icon: 'pi-folder', color: '#71717a', profileCount: 0 },
        { id: '4', name: 'Facebook', icon: 'pi-facebook', color: '#1877F2', profileCount: 2 },
    ]);
    protected readonly selectedFolderId = signal<string | null>('1');

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
    protected readonly profilesPath = computed(() => this.settingsService.browser().profilesPath || '');
    protected readonly profiles = this.profileService.profiles;
    protected readonly loading = this.profileService.loading;
    protected readonly selectedProfiles = signal<Profile[]>([]);

    // Table config
    protected readonly rowsPerPage = signal(5);
    protected readonly first = signal(0);
    protected readonly viewMode = signal<'table' | 'grid'>('table');

    // Options
    protected readonly emojiOptions = EMOJI_OPTIONS;
    protected readonly groupOptions = GROUP_OPTIONS;
    protected readonly shortcutOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    protected readonly browserInfo = BROWSER_INFO;
    protected readonly availableBrowsers = signal<string[]>(['chrome']);

    // Search & Filter
    protected readonly searchText = signal('');
    protected readonly filterGroup = signal<string | null>(null);
    // Phase 2: Show hidden profiles toggle
    protected readonly showHidden = signal(false);
    // Feature 2.4: Favorites filter
    protected readonly filterFavoritesOnly = signal(false);

    // Sorting
    protected readonly sortBy = signal<'name' | 'size' | 'lastOpened' | 'custom'>('name');
    protected readonly sortOrder = signal<'asc' | 'desc'>('asc');
    // Feature 6.7: Compact Mode - display more profiles in less space
    protected readonly compactMode = signal<boolean>(
        typeof localStorage !== 'undefined' && localStorage.getItem('home-compact-mode') === 'true'
    );
    protected readonly sortMenuItems = computed<MenuItem[]>(() => [
        {
            label: 'Sort By',
            items: [
                {
                    label: 'Name',
                    icon: this.sortBy() === 'name' ? (this.sortOrder() === 'asc' ? 'pi pi-arrow-up' : 'pi pi-arrow-down') : undefined,
                    command: () => this.setSortBy('name'),
                },
                {
                    label: 'Size',
                    icon: this.sortBy() === 'size' ? (this.sortOrder() === 'asc' ? 'pi pi-arrow-up' : 'pi pi-arrow-down') : undefined,
                    command: () => this.setSortBy('size'),
                },
                {
                    label: 'Last Used',
                    icon: this.sortBy() === 'lastOpened' ? (this.sortOrder() === 'asc' ? 'pi pi-arrow-up' : 'pi pi-arrow-down') : undefined,
                    command: () => this.setSortBy('lastOpened'),
                },
                {
                    label: 'Custom (Drag & Drop)',
                    icon: this.sortBy() === 'custom' ? 'pi pi-check' : undefined,
                    command: () => this.setSortBy('custom'),
                },
            ],
        },
    ]);
    protected readonly currentSortLabel = computed(() => {
        const labels: Record<string, string> = { name: 'Name', size: 'Size', lastOpened: 'Last Used', custom: 'Custom' };
        return labels[this.sortBy()] || 'Sort';
    });

    protected readonly filteredProfiles = computed(() => {
        let result = this.profiles();
        const search = this.searchText().toLowerCase().trim();
        const group = this.filterGroup();
        const showHiddenValue = this.showHidden();
        const favoritesOnly = this.filterFavoritesOnly();

        // Phase 2: Filter out hidden profiles unless showHidden is true
        if (!showHiddenValue) {
            result = result.filter((p) => !p.metadata?.isHidden);
        }

        // Feature 2.4: Filter favorites only
        if (favoritesOnly) {
            result = result.filter((p) => p.metadata?.isFavorite);
        }

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
                case 'custom':
                    // Sort by custom sortOrder, fallback to 0
                    const aOrder = a.metadata?.sortOrder ?? 999999;
                    const bOrder = b.metadata?.sortOrder ?? 999999;
                    return aOrder - bOrder;
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

    protected readonly filterMenuItems = computed<MenuItem[]>(() => {
        const groups = this.uniqueGroups();
        const currentFilter = this.filterGroup();

        const groupItems: MenuItem[] = groups.length > 0
            ? groups.map((group) => ({
                label: group,
                icon: currentFilter === group ? 'pi pi-check' : undefined,
                command: () => this.setFilterGroup(group),
            }))
            : [{ label: 'No groups available', disabled: true }];

        return [
            {
                label: 'Filter by Group',
                items: [
                    ...groupItems,
                    { separator: true },
                    {
                        label: 'Clear All',
                        icon: 'pi pi-times',
                        disabled: !this.hasActiveFilters(),
                        command: () => this.clearFilters(),
                    },
                ],
            },
        ];
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
    // Feature 2.4: Favorites count for UI
    protected readonly favoriteCount = computed(() =>
        this.profiles().filter(p => p.metadata?.isFavorite).length
    );

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
    // Phase 1: Color coding
    protected readonly editColor = signal<string | null>(null);
    protected readonly colorOptions = COLOR_OPTIONS;
    // Feature 3.6: Custom Chrome Flags
    protected readonly editCustomFlags = signal<string | null>(null);

    // Duplicate dialog
    protected readonly showDuplicateDialog = signal(false);
    protected readonly duplicateProfileName = signal('');

    // Phase 3: Activity Log dialog
    protected readonly showActivityLog = signal(false);
    protected readonly activityLog = this.activityLogService;

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
                // Ensure directory exists, then scan
                this.profileService.ensureProfilesDirectory(path).then(() => {
                    this.scanProfiles();
                }).catch(err => {
                    console.error('Failed to ensure profiles directory:', err);
                });
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

    // Phase 4: Profile Preview Tooltip
    getProfileTooltip(profile: Profile): string {
        const lines: string[] = [];

        // Name is already displayed, add additional info
        if (profile.metadata?.group) {
            lines.push(`Group: ${profile.metadata.group}`);
        }
        if (profile.metadata?.browser) {
            lines.push(`Browser: ${this.getBrowserName(profile.metadata.browser)}`);
        }
        if (profile.metadata?.tags && profile.metadata.tags.length > 0) {
            lines.push(`Tags: ${profile.metadata.tags.join(', ')}`);
        }
        if (profile.size) {
            lines.push(`Size: ${this.formatSize(profile.size)}`);
        }
        // Usage Statistics
        if (profile.metadata?.launchCount) {
            lines.push(`Launches: ${profile.metadata.launchCount}`);
        }
        if (profile.metadata?.totalUsageMinutes) {
            lines.push(`Total usage: ${this.formatMinutes(profile.metadata.totalUsageMinutes)}`);
        }
        if (profile.metadata?.lastOpened) {
            const date = new Date(profile.metadata.lastOpened);
            lines.push(`Last used: ${date.toLocaleDateString()}`);
        }
        if (profile.metadata?.notes) {
            const notes = profile.metadata.notes.length > 50
                ? profile.metadata.notes.substring(0, 47) + '...'
                : profile.metadata.notes;
            lines.push(`Notes: ${notes}`);
        }
        if (profile.metadata?.launchUrl) {
            lines.push(`Launch URL: ${profile.metadata.launchUrl}`);
        }

        return lines.length > 0 ? lines.join('\n') : 'Click to edit profile';
    }

    // Usage Statistics helper
    formatMinutes(minutes: number): string {
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
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

    // Feature 6.7: Toggle compact mode
    toggleCompactMode(): void {
        const newValue = !this.compactMode();
        this.compactMode.set(newValue);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('home-compact-mode', String(newValue));
        }
    }

    async launchProfileDirect(profile: Profile): Promise<void> {
        try {
            const browser = profile.metadata?.browser || 'chrome';
            const url = profile.metadata?.launchUrl || undefined;
            const proxy = profile.metadata?.proxyServer || undefined;
            const customFlags = profile.metadata?.customFlags || undefined; // Feature 3.6
            await this.profileService.launchBrowser(profile.path, browser, url, false, proxy, customFlags);

            // Phase 3: Log activity
            this.activityLogService.logLaunch(profile.name, profile.path, browser);

            // Usage Statistics: Update launch count and estimate usage
            const currentCount = profile.metadata?.launchCount || 0;
            const currentMinutes = profile.metadata?.totalUsageMinutes || 0;
            const lastSession = profile.metadata?.lastSessionDuration || 0;
            // Add estimated session time from last session (default 15 min for first launch)
            const estimatedSessionMinutes = lastSession > 0 ? lastSession : 15;
            this.profileService.updateUsageStats(
                profile.path,
                currentCount + 1,
                currentMinutes + estimatedSessionMinutes,
                estimatedSessionMinutes
            );

            this.messageService.add({
                severity: 'info',
                summary: 'Launched',
                detail: `${this.getBrowserName(browser)}: ${profile.name}${url ? ' → ' + url : ''}${proxy ? ' (Proxy)' : ''}`,
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

    clearFilters(): void {
        this.searchText.set('');
        this.filterGroup.set(null);
    }

    setSortBy(value: 'name' | 'size' | 'lastOpened' | 'custom'): void {
        if (this.sortBy() === value) {
            // Toggle order if same field (except custom)
            if (value !== 'custom') {
                this.sortOrder.set(this.sortOrder() === 'asc' ? 'desc' : 'asc');
            }
        } else {
            this.sortBy.set(value);
            if (value !== 'custom') {
                this.sortOrder.set('asc');
            }
        }
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
            const newPath = await this.profileService.createProfile(this.profilesPath(), name);
            // Phase 3: Log activity
            this.activityLogService.logCreate(name, newPath || `${this.profilesPath()}/${name}`);
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
        this.editTags.set(profile.metadata?.tags || []);
        this.editLaunchUrl.set(profile.metadata?.launchUrl || null);
        this.editIsPinned.set(profile.metadata?.isPinned || false);
        // Phase 1: Load color
        this.editColor.set(profile.metadata?.color || null);
        // Feature 3.6: Load custom flags
        this.editCustomFlags.set(profile.metadata?.customFlags || null);
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

    // Phase 1: Color selection
    selectColor(color: string | null): void {
        this.editColor.set(this.editColor() === color ? null : color);
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
                this.editIsPinned() || null,
                this.editColor(),
                profile.metadata?.isHidden || null, // Preserve hidden state
                profile.metadata?.isFavorite || null, // Preserve favorite state
                this.editCustomFlags(), // Feature 3.6: Pass custom flags
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
                newPinned,
                profile.metadata?.color || null,
                profile.metadata?.isHidden || null,
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

    // Phase 2: Toggle hide profile
    async toggleHide(profile: Profile, event: Event): Promise<void> {
        event.stopPropagation();
        const newHidden = !profile.metadata?.isHidden;
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
                profile.metadata?.isPinned || null,
                profile.metadata?.color || null,
                newHidden,
            );
            this.messageService.add({
                severity: 'success',
                summary: newHidden ? 'Hidden' : 'Visible',
                detail: `${profile.name} ${newHidden ? 'hidden from view' : 'now visible'}`,
            });
        } catch (e) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: String(e) });
        }
    }

    // Feature 2.4: Toggle favorite status
    async toggleFavorite(profile: Profile, event: Event): Promise<void> {
        event.stopPropagation();
        try {
            await this.profileService.toggleFavorite(profile.path);
            const newStatus = !profile.metadata?.isFavorite;
            this.messageService.add({
                severity: 'success',
                summary: newStatus ? 'Added to Favorites' : 'Removed from Favorites',
                detail: profile.name,
            });
        } catch (e) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: String(e) });
        }
    }

    async launchProfileIncognito(profile: Profile, event: Event): Promise<void> {
        event.stopPropagation();
        const browser = profile.metadata?.browser || 'chrome';
        const url = profile.metadata?.launchUrl || undefined;
        try {
            await this.profileService.launchBrowser(profile.path, browser, url, true);
            this.messageService.add({
                severity: 'success',
                summary: 'Launched',
                detail: `${profile.name} started in Incognito`,
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
                    // Phase 3: Log activity
                    this.activityLogService.logDelete(profile.name, profile.path);
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
            const newPath = await this.profileService.duplicateProfile(profile.path, newName, this.profilesPath());
            // Phase 3: Log activity
            this.activityLogService.logDuplicate(profile.name, newPath || `${this.profilesPath()}/${newName}`, newName);
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

    // Backup Profile to ZIP
    async backupProfile(profile: Profile, event: Event): Promise<void> {
        event.stopPropagation();
        try {
            const backupPath = await this.profileService.backupProfile(profile.path);
            const fileName = backupPath.split('/').pop() || 'backup.zip';


            this.messageService.add({
                severity: 'success',
                summary: 'Backup Successful',
                detail: `Saved: ${fileName}`,
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            // Don't show error toast if user just cancelled
            if (msg !== 'Backup cancelled') {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Backup Failed',
                    detail: msg,
                });
            }
        }
    }

    // Feature 4.2: Clear Profile Cookies and Cache
    async clearCookies(profile: Profile, event: Event): Promise<void> {
        event.stopPropagation();
        this.confirmationService.confirm({
            key: 'confirmDialog',
            message: `Clear all cookies, cache, and browsing data for "${profile.name}"? This cannot be undone.`,
            header: 'Clear Browsing Data',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-warning',
            accept: async () => {
                try {
                    const result = await this.profileService.clearProfileCookies(profile.path);
                    const freedMB = (result.freedBytes / (1024 * 1024)).toFixed(1);
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Data Cleared',
                        detail: `Deleted ${result.deletedCount} items, freed ${freedMB} MB`,
                    });
                    // Refresh profile sizes
                    this.profileService.loadProfileSizes();
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

    // ==== Sidebar Actions (Moved from Pages) ====
    protected onFolderSelected(folderId: string | null): void {
        this.selectedFolderId.set(folderId);
    }

    protected onAddFolder(): void {
        console.log('Home: Add folder clicked');
    }

    protected onSettings(): void {
        this.router.navigate(['/settings']);
    }

    // Drag & Drop Reordering
    protected async onProfileDrop(event: CdkDragDrop<Profile[]>): Promise<void> {
        if (event.previousIndex === event.currentIndex) return;
        if (this.sortBy() !== 'custom') return;

        // Get current filtered profiles and reorder
        const profiles = [...this.filteredProfiles()];
        moveItemInArray(profiles, event.previousIndex, event.currentIndex);

        // Update sortOrder for all reordered profiles
        for (let index = 0; index < profiles.length; index++) {
            const profile = profiles[index];
            try {
                await this.profileService.updateSortOrder(profile.path, index);
            } catch (err) {
                console.error('Failed to save sort order:', err);
            }
        }

        this.messageService.add({
            severity: 'success',
            summary: 'Order Updated',
            detail: 'Profile order has been saved.',
            life: 2000,
        });
    }

}
