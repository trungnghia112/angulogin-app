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
import { ProfileToolbar, SortByType, ViewModeType } from './profile-toolbar/profile-toolbar';
import { ProfileEditDialog, ProfileEditData } from './profile-edit-dialog/profile-edit-dialog';
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
import { Select } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { MenuModule } from 'primeng/menu';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { ProfileService } from '../../../services/profile.service';
import { SettingsService } from '../../../core/services/settings.service';
import { ActivityLogService } from '../../../services/activity-log.service';
import { FolderService } from '../../../services/folder.service';
import { ProxyService } from '../../../services/proxy.service';
import { BrowserType, Profile } from '../../../models/profile.model';
import { validateProfileName } from '../../../core/utils/validation.util';



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
        ProfileToolbar,
        ProfileEditDialog,
        Select,
    ],
})
export class Home implements OnInit, OnDestroy {
    private readonly router = inject(Router);
    private readonly profileService = inject(ProfileService);
    private readonly settingsService = inject(SettingsService);
    private readonly activityLogService = inject(ActivityLogService);
    protected readonly folderService = inject(FolderService);
    protected readonly proxyService = inject(ProxyService);
    private readonly messageService = inject(MessageService);
    private readonly confirmationService = inject(ConfirmationService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly searchSubject = new Subject<string>();
    private statusInterval: ReturnType<typeof setInterval> | null = null;
    // PERF FIX: Cache tooltips to avoid string creation on every render
    private readonly tooltipCache = new Map<string, string>();

    // Expose Math for template
    protected Math = Math;

    // Sidebar Data (Moved from Pages)
    // Feature 2.2: Smart Folders - now centralized in FolderService
    protected readonly folders = this.folderService.folders;

    // Feature 2.5: Custom folders from FolderService for edit dialog
    protected readonly allFolders = this.folderService.folders;
    // Feature 4.2: Proxy group options for edit dialog - use service's computed signal
    protected readonly proxyGroups = this.proxyService.proxyGroups;
    protected readonly selectedFolderId = signal<string | null>('all');
    /** Controls mobile sidebar drawer visibility */
    protected readonly sidebarOpen = signal(false);

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
    protected readonly rowsPerPage = signal(10);
    protected readonly first = signal(0);
    protected readonly viewMode = signal<'table' | 'grid'>('table');

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
    protected readonly compactMode = signal<boolean>(
        typeof localStorage !== 'undefined' && localStorage.getItem('home-compact-mode') === 'true'
    );

    // PERF FIX: Single-pass filtering + sorting instead of multiple .filter() chains
    protected readonly filteredProfiles = computed(() => {
        const profiles = this.profiles();
        const search = this.searchText().toLowerCase().trim();
        const group = this.filterGroup();
        const showHiddenValue = this.showHidden();
        const favoritesOnly = this.filterFavoritesOnly();
        const selectedFolder = this.selectedFolderId();

        // Feature 2.2: Smart Folder filtering constants
        const ONE_GB = 1024 * 1024 * 1024;
        const THIRTY_DAYS_AGO = Date.now() - 30 * 24 * 60 * 60 * 1000;

        // Single-pass filtering - O(n)
        const result: Profile[] = [];

        for (const p of profiles) {
            // Smart Folder & Custom Folder filter
            if (selectedFolder === 'favorites') {
                if (!p.metadata?.isFavorite) continue;
            } else if (selectedFolder === 'large') {
                if ((p.size || 0) <= ONE_GB) continue;
            } else if (selectedFolder === 'unused') {
                const lastOpened = p.metadata?.lastOpened ? new Date(p.metadata.lastOpened).getTime() : 0;
                if (!(lastOpened > 0 && lastOpened < THIRTY_DAYS_AGO)) continue;
            } else if (selectedFolder === 'hidden') {
                if (!p.metadata?.isHidden) continue;
            } else if (selectedFolder && selectedFolder !== 'all') {
                // Custom folder
                if (p.metadata?.folderId !== selectedFolder) continue;
            }

            // Hidden filter (unless showHidden or viewing hidden folder)
            // If viewing specific folder, we usually show items even if hidden, or stick to showHidden toggle?
            // "Hidden" folder obviously shows hidden.
            // "All" keeps logic: hide hidden unless showHidden is true.
            // Custom folders: probably show only if not hidden? Or show if in folder?
            // Let's stick to consistent logic: isHidden hides it everywhere unless showHidden is true OR we are IN the 'hidden' folder.
            if (selectedFolder !== 'hidden' && !this.showHidden() && p.metadata?.isHidden) {
                continue;
            }

            // Favorites only filter (superimposed on other filters)
            if (favoritesOnly && selectedFolder !== 'favorites' && !p.metadata?.isFavorite) continue;

            // Search filter
            if (search) {
                const matchesName = p.name.toLowerCase().includes(search);
                const matchesNotes = p.metadata?.notes?.toLowerCase().includes(search);
                const matchesGroup = p.metadata?.group?.toLowerCase().includes(search);
                if (!matchesName && !matchesNotes && !matchesGroup) continue;
            }

            // Group filter
            if (group && p.metadata?.group !== group) continue;

            // Passed all filters
            result.push(p);
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

    // Paginated profiles for table display
    protected readonly paginatedProfiles = computed(() => {
        const all = this.filteredProfiles();
        const start = this.first();
        const end = start + this.rowsPerPage();
        return all.slice(start, end);
    });

    // Dialog states
    protected readonly showCreateDialog = signal(false);
    protected readonly showRenameDialog = signal(false);
    protected readonly showEditDialog = signal(false);
    protected readonly newProfileName = signal('');
    protected readonly renameProfileName = signal('');
    protected readonly selectedProfile = signal<Profile | null>(null);

    // Duplicate dialog
    protected readonly showDuplicateDialog = signal(false);
    protected readonly duplicateProfileName = signal('');

    // Backup/Restore loading states
    protected readonly backupInProgress = signal(false);
    protected readonly restoreInProgress = signal(false);

    // Phase 3: Activity Log dialog
    protected readonly showActivityLog = signal(false);
    protected readonly activityLog = this.activityLogService;

    // Available tags from all profiles
    protected readonly availableTags = computed(() => {
        const all = this.profiles().flatMap((p) => p.metadata?.tags || []);
        return [...new Set(all)];
    });

    ngOnInit(): void {
        // Non-blocking: load available browsers in background
        this.profileService.listAvailableBrowsers().then(browsers => {
            this.availableBrowsers.set(browsers);
        });
    }

    constructor() {
        // Auto-scan whenever the profiles path changes
        // PERF FIX: Only scan if profiles not already loaded (prevents 87 I/O calls on tab switch)
        effect(() => {
            const path = this.profilesPath();
            if (path) {
                // Skip scan if profiles already loaded for this path
                const existingProfiles = this.profileService.profiles();
                if (existingProfiles.length > 0) {
                    // Profiles already loaded, skip expensive rescan
                    return;
                }
                // First load: ensure directory exists, then scan
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
    // PERF FIX: Use cache to avoid string creation on every render
    getProfileTooltip(profile: Profile): string {
        // Create cache key from profile path and relevant metadata
        const cacheKey = `${profile.path}|${profile.size || 0}|${profile.metadata?.launchCount || 0}|${profile.metadata?.lastOpened || ''}`;

        // Return cached value if exists
        const cached = this.tooltipCache.get(cacheKey);
        if (cached !== undefined) return cached;

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

        const result = lines.length > 0 ? lines.join('\n') : 'Click to edit profile';

        // Cache and return
        this.tooltipCache.set(cacheKey, result);
        return result;
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
            console.time('[PERF] home.scanProfiles TOTAL');
            console.time('[PERF] checkPathExists');
            const exists = await this.profileService.checkPathExists(path);
            console.timeEnd('[PERF] checkPathExists');
            if (!exists) {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Path does not exist',
                });
                console.timeEnd('[PERF] home.scanProfiles TOTAL');
                return;
            }
            console.time('[PERF] profileService.scanProfiles');
            await this.profileService.scanProfiles(path);
            console.timeEnd('[PERF] profileService.scanProfiles');
            this.settingsService.setProfilesPath(path);
            this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: `Found ${this.profiles().length} profiles`,
            });
            console.timeEnd('[PERF] home.scanProfiles TOTAL');
        } catch (e) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: String(e) });
            console.timeEnd('[PERF] home.scanProfiles TOTAL');
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

            // PM-005: Check availability
            const available = this.availableBrowsers();
            if (!available.includes(browser)) {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Browser Not Found',
                    detail: `${this.getBrowserName(browser)} does not appear to be installed. Attempting launch anyway...`,
                });
            }

            const url = profile.metadata?.launchUrl || undefined;
            let proxy = profile.metadata?.proxy || undefined;
            let proxyUsername: string | undefined;
            let proxyPassword: string | undefined;
            const customFlags = profile.metadata?.customFlags || undefined;
            const windowPosition = profile.metadata?.windowPosition || undefined;
            const disableExtensions = profile.metadata?.disableExtensions || false;

            // Look up proxy credentials from saved proxy or metadata
            const proxyId = profile.metadata?.proxyId;
            if (proxyId) {
                const savedProxy = this.proxyService.getById(proxyId);
                if (savedProxy) {
                    proxy = this.proxyService.formatProxyUrl(savedProxy);
                    proxyUsername = savedProxy.username || undefined;
                    proxyPassword = savedProxy.password || undefined;
                }
            } else if (proxy) {
                // Manual proxy: credentials stored in metadata
                proxyUsername = profile.metadata?.proxyUsername || undefined;
                proxyPassword = profile.metadata?.proxyPassword || undefined;
            }

            // Feature 4.2: Proxy Rotation
            const rotation = profile.metadata?.proxyRotation;
            if (rotation?.enabled) {
                const nextResult = this.proxyService.getNextProxy(
                    rotation.proxyGroupId,
                    rotation.currentProxyIndex
                );
                if (nextResult) {
                    proxy = this.proxyService.formatProxyUrl(nextResult.proxy);
                    proxyUsername = nextResult.proxy.username || undefined;
                    proxyPassword = nextResult.proxy.password || undefined;
                    // Update profile with new rotation index via metadata
                    await this.profileService.saveProxyRotationState(
                        profile.path,
                        nextResult.nextIndex
                    );
                    this.messageService.add({
                        severity: 'info',
                        summary: 'Proxy Rotated',
                        detail: `Using proxy: ${nextResult.proxy.name || proxy}`,
                    });
                }
            }


            await this.profileService.launchBrowser(
                profile.path,
                browser,
                url,
                false,
                proxy,
                customFlags,
                windowPosition,
                disableExtensions,
                proxyUsername,
                proxyPassword
            );

            // Phase 3: Log activity
            this.activityLogService.logLaunch(profile.name, profile.path, browser);

            // Usage Statistics: Update launch count and estimate usage
            const currentCount = profile.metadata?.launchCount || 0;
            const currentMinutes = profile.metadata?.totalUsageMinutes || 0;
            const lastSession = profile.metadata?.lastSessionDuration || 0;
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

        // Unified validation
        const validationError = validateProfileName(name);
        if (validationError) {
            this.messageService.add({
                severity: 'error',
                summary: 'Invalid Name',
                detail: validationError,
            });
            return;
        }

        // PM-002: Duplicate Name Validation
        const exists = this.profiles().some(p => p.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            this.messageService.add({
                severity: 'error',
                summary: 'Duplicate Name',
                detail: `Profile "${name}" already exists.`,
            });
            return;
        }

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

        // Unified validation
        const validationError = validateProfileName(newName);
        if (validationError) {
            this.messageService.add({
                severity: 'error',
                summary: 'Invalid Name',
                detail: validationError,
            });
            return;
        }

        // PM-002: Duplicate Name Validation
        const exists = this.profiles().some(p => p.name.toLowerCase() === newName.toLowerCase() && p.path !== profile.path);
        if (exists) {
            this.messageService.add({
                severity: 'error',
                summary: 'Duplicate Name',
                detail: `Profile "${newName}" already exists.`,
            });
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
        this.showEditDialog.set(true);
    }


    async onEditDialogSave(data: ProfileEditData): Promise<void> {
        const profile = this.selectedProfile();
        if (!profile) return;
        try {
            await this.profileService.saveProfileMetadata(
                profile.path,
                {
                    emoji: data.emoji,
                    notes: data.notes,
                    group: data.group,
                    shortcut: data.shortcut,
                    browser: data.browser,
                    tags: data.tags && data.tags.length > 0 ? data.tags : undefined,
                    launchUrl: data.launchUrl ?? undefined,
                    isPinned: data.isPinned || undefined,
                    color: data.color ?? undefined,
                    customFlags: data.customFlags ?? undefined,
                    proxy: data.proxy ?? undefined,
                    proxyId: data.proxyId ?? undefined,
                    proxyUsername: data.proxyUsername ?? undefined,
                    proxyPassword: data.proxyPassword ?? undefined,
                    folderId: data.folderId ?? undefined,
                    disableExtensions: data.disableExtensions || undefined,
                    proxyRotation: data.proxyRotation ?? undefined,
                },
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

    // Folder Management
    protected onFolderSelected(folderId: string | null): void {
        this.selectedFolderId.set(folderId || 'all');
        this.first.set(0); // Reset pagination
    }

    // Create Folder Dialog
    protected readonly showCreateFolderDialog = signal(false);
    protected readonly newFolderName = signal('');

    onAddFolder(): void {
        this.newFolderName.set('');
        this.showCreateFolderDialog.set(true);
    }

    createFolder(): void {
        const name = this.newFolderName().trim();
        if (!name) return;

        try {
            this.folderService.add(name);
            this.showCreateFolderDialog.set(false);
            this.messageService.add({ severity: 'success', summary: 'Folder Created', detail: name });
        } catch (e) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to create folder' });
        }
    }

    // Edit Folder available context menu or settings?
    // For now, let's keep it simple. If we need to edit/delete folders, we might need a settings UI or context menu in sidebar.
    // The design mentioned "Design Folder Management UI (list, create, edit, delete)".
    // Sidebar usually has context menu on right click. 
    // Or we can add a "Folder Settings" dialog that lists all folders to manage them.
    // Let's implement a "Manage Folders" dialog.

    protected readonly showManageFoldersDialog = signal(false);

    onSettings(): void {
        // This was mapped to general settings, but sidebar has 'Settings' button.
        // We can redirect to /settings route or open dialog.
        this.router.navigate(['/settings']);
    }

    // Since sidebar emits 'settingsClicked', let's use it for app settings.
    // We need a way to manage folders. 
    // Maybe the sidebar items can have a 'edit' button/icon or we use the 'Manage Folders' approach.
    // Let's rely on a separate 'Manage' button or just Context Menu.
    // For MVP Folder Management, 'Create' is done. 
    // Let's add 'Edit/Delete' via a management dialog accessible from Sidebar (maybe a 'cog' icon next to custom folders?). 
    // Or simpler: Add 'Manage Folders' button in sidebar? 
    // The Sidebar component has `onSettings`, `onAddFolder`.
    // Let's add `onEditFolder(folder)` support if we modify sidebar.
    // For now, let's stick to: Create is supported. 
    // To support Delete/Edit, I'll add a 'Manage Folders' button in the Create dialog or a separate place.
    // Actually, `home.html` has `app-home-sidebar`.
    // Let's add a context menu or similar.

    // Let's add a simple "Manage Folders" dialog.
    openManageFolders(): void {
        this.showManageFoldersDialog.set(true);
    }

    deleteFolder(id: string): void {
        this.confirmationService.confirm({
            message: 'Are you sure you want to delete this folder?',
            header: 'Delete Folder',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.folderService.remove(id);
                if (this.selectedFolderId() === id) {
                    this.selectedFolderId.set('all');
                }
                this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Folder deleted' });
            }
        });
    }

    // Edit Folder
    protected readonly editingFolderId = signal<string | null>(null);
    protected readonly editFolderName = signal('');

    startEditFolder(folder: { id: string, name: string }): void {
        this.editingFolderId.set(folder.id);
        this.editFolderName.set(folder.name);
    }

    saveEditFolder(): void {
        const id = this.editingFolderId();
        const name = this.editFolderName().trim();
        if (id && name) {
            this.folderService.update(id, { name });
            this.editingFolderId.set(null);
        }
    }

    cancelEditFolder(): void {
        this.editingFolderId.set(null);
    }

    async togglePin(profile: Profile, event: Event): Promise<void> {
        event.stopPropagation();
        const newPinned = !profile.metadata?.isPinned;
        try {
            await this.profileService.saveProfileMetadata(
                profile.path,
                { isPinned: newPinned },
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
                { isHidden: newHidden },
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
            this.activityLogService.logLaunch(profile.name, profile.path, browser);
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

        // Validation (matching create/rename)
        const validationError = validateProfileName(newName);
        if (validationError) {
            this.messageService.add({
                severity: 'error',
                summary: 'Invalid Name',
                detail: validationError,
            });
            return;
        }

        // Duplicate name check
        const nameExists = this.profiles().some(p => p.name.toLowerCase() === newName.toLowerCase());
        if (nameExists) {
            this.messageService.add({
                severity: 'error',
                summary: 'Duplicate Name',
                detail: `Profile "${newName}" already exists.`,
            });
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
        if (this.backupInProgress()) return;

        this.backupInProgress.set(true);
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
        } finally {
            this.backupInProgress.set(false);
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
                    // Size recalculation removed — use Storage Dashboard instead
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

    onRowsPerPageChange(rows: number): void {
        this.rowsPerPage.set(rows);
        this.first.set(0); // Reset to first page when changing rows
    }

    onPagePrev(): void {
        const newFirst = Math.max(0, this.first() - this.rowsPerPage());
        this.first.set(newFirst);
    }

    onPageNext(): void {
        const maxFirst = this.filteredProfiles().length - this.rowsPerPage();
        const newFirst = Math.min(maxFirst, this.first() + this.rowsPerPage());
        this.first.set(Math.max(0, newFirst));
    }

    // ==== Bulk Actions ====

    async bulkLaunch(): Promise<void> {
        const profiles = this.selectedProfiles();
        if (profiles.length === 0) return;

        let launched = 0;
        for (const profile of profiles) {
            const browser = profile.metadata?.browser || 'chrome';
            const url = profile.metadata?.launchUrl || undefined;
            try {
                await this.profileService.launchBrowser(profile.path, browser, url);
                launched++;
                // Throttle: 500ms delay between launches to prevent system overload
                if (launched < profiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
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
            detail: `${launched}/${profiles.length} profiles launched`,
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

    // ==== Feature 4.1: Bulk Export ====
    async bulkExport(): Promise<void> {
        const profiles = this.selectedProfiles();
        if (profiles.length === 0) {
            this.messageService.add({
                severity: 'warn',
                summary: 'No Selection',
                detail: 'Please select profiles to export',
            });
            return;
        }

        try {
            const profilePaths = profiles.map(p => p.path);
            const result = await this.profileService.bulkExportProfiles(profilePaths);

            if (result.successful.length > 0) {
                const totalMB = (result.totalSize / (1024 * 1024)).toFixed(1);
                this.messageService.add({
                    severity: 'success',
                    summary: 'Export Complete',
                    detail: `Exported ${result.successful.length} profiles (${totalMB} MB)`,
                });
            }

            if (result.failed.length > 0) {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Some Exports Failed',
                    detail: result.failed.join(', '),
                });
            }

            this.clearSelection();
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            // Don't show error if user cancelled
            if (msg !== 'Export cancelled') {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Export Failed',
                    detail: msg,
                });
            }
        }
    }

    // ==== Feature 5.2: Restore from Backup ====
    async restoreFromBackup(): Promise<void> {
        if (this.restoreInProgress()) return;

        try {
            // Dynamic import for dialog
            const { open } = await import('@tauri-apps/plugin-dialog');

            const filePath = await open({
                title: 'Select Backup ZIP File',
                multiple: false,
                filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
            });

            if (!filePath) return; // User cancelled

            // Confirm before restore
            this.confirmationService.confirm({
                key: 'confirmDialog',
                message: 'Restore profile from this backup? If a profile with the same name exists, it will be renamed.',
                header: 'Restore Profile',
                icon: 'pi pi-upload',
                accept: async () => {
                    this.restoreInProgress.set(true);
                    try {
                        const result = await this.profileService.restoreFromBackup(
                            filePath as string,
                            this.profilesPath(),
                            'rename'
                        );

                        let detail = `Restored "${result.profileName}"`;
                        if (result.wasRenamed) {
                            detail += ' (renamed to avoid conflict)';
                        }

                        this.messageService.add({
                            severity: 'success',
                            summary: 'Restore Complete',
                            detail,
                        });

                        // Log activity
                        this.activityLogService.log(
                            'create',
                            result.profileName,
                            result.restoredPath,
                            undefined,
                            'Restored from backup'
                        );
                    } catch (e) {
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Restore Failed',
                            detail: e instanceof Error ? e.message : String(e),
                        });
                    } finally {
                        this.restoreInProgress.set(false);
                    }
                },
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: msg,
            });
        }
    }

    // ==== Feature 5.6: Export Profiles Settings ====
    exportProfiles(): void {
        const profiles = this.profiles();
        if (profiles.length === 0) {
            this.messageService.add({
                severity: 'warn',
                summary: 'No Profiles',
                detail: 'No profiles available to export',
            });
            return;
        }

        // Build export data
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            profilesPath: this.profilesPath(),
            profiles: profiles.map(p => ({
                name: p.name,
                path: p.path,
                metadata: p.metadata || {},
            })),
        };

        // Create JSON and download
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `profiles-export-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);

        this.messageService.add({
            severity: 'success',
            summary: 'Exported',
            detail: `Exported settings for ${profiles.length} profiles`,
        });
    }

    // ==== Feature 5.6: Import Profiles Settings ====
    importProfiles(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (event: Event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                // Validate structure
                if (!data.profiles || !Array.isArray(data.profiles)) {
                    throw new Error('Invalid export file format');
                }

                // Confirm import
                this.confirmationService.confirm({
                    key: 'confirmDialog',
                    message: `Import settings for ${data.profiles.length} profiles? This will update metadata for matching profiles.`,
                    header: 'Import Profile Settings',
                    icon: 'pi pi-upload',
                    accept: async () => {
                        let updated = 0;
                        let skipped = 0;

                        for (const importedProfile of data.profiles) {
                            // Find matching profile by path or name
                            const existingProfile = this.profiles().find(
                                p => p.path === importedProfile.path || p.name === importedProfile.name
                            );

                            if (existingProfile && importedProfile.metadata) {
                                try {
                                    const meta = importedProfile.metadata;
                                    await this.profileService.saveProfileMetadata(
                                        existingProfile.path,
                                        {
                                            emoji: meta.emoji || null,
                                            notes: meta.notes || null,
                                            group: meta.group || null,
                                            shortcut: meta.shortcut || null,
                                            browser: meta.browser || null,
                                            tags: meta.tags || undefined,
                                            launchUrl: meta.launchUrl || undefined,
                                            isPinned: meta.isPinned || undefined,
                                            color: meta.color || undefined,
                                            isHidden: meta.isHidden || undefined,
                                            isFavorite: meta.isFavorite || undefined,
                                            customFlags: meta.customFlags || undefined,
                                        },
                                    );
                                    updated++;
                                } catch {
                                    skipped++;
                                }
                            } else {
                                skipped++;
                            }
                        }

                        this.messageService.add({
                            severity: 'success',
                            summary: 'Import Complete',
                            detail: `Updated ${updated} profiles${skipped > 0 ? `, skipped ${skipped}` : ''}`,
                        });
                    },
                });
            } catch (e) {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Import Failed',
                    detail: e instanceof Error ? e.message : 'Invalid file format',
                });
            }
        };
        input.click();
    }

}
