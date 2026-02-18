import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { BrowserType, Profile, ProxyRotationConfig } from '../../../../models/profile.model';
import { Folder, ProfileProxy } from '../../../../models/folder.model';
import { MessageService } from 'primeng/api';
import { UpperCasePipe } from '@angular/common';
import { ProxyService } from '../../../../services/proxy.service';
import { CamoufoxService, Fingerprint } from '../../../../services/camoufox.service';

// Options
const EMOJI_OPTIONS = ['🌐', '💼', '🎮', '📧', '🛒', '📚', '🎬', '🔒', '🧪', '👤'];
const GROUP_OPTIONS = ['Work', 'Personal', 'Development', 'Shopping', 'Social', 'Finance'];
const SHORTCUT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const COLOR_OPTIONS = [
    { name: 'red', hex: '#ef4444', label: 'Red' },
    { name: 'orange', hex: '#f97316', label: 'Orange' },
    { name: 'yellow', hex: '#eab308', label: 'Yellow' },
    { name: 'green', hex: '#22c55e', label: 'Green' },
    { name: 'blue', hex: '#3b82f6', label: 'Blue' },
    { name: 'purple', hex: '#a855f7', label: 'Purple' },
    { name: 'pink', hex: '#ec4899', label: 'Pink' },
];
const BROWSER_INFO: Record<string, { name: string; icon: string; color: string }> = {
    chrome: { name: 'Chrome', icon: 'pi-chrome', color: '#4285F4' },
    brave: { name: 'Brave', icon: 'pi-shield', color: '#FB542B' },
    edge: { name: 'Edge', icon: 'pi-microsoft', color: '#0078D7' },
    chromium: { name: 'Chromium', icon: 'pi-circle', color: '#4587F3' },
    arc: { name: 'Arc', icon: 'pi-compass', color: '#FF6B6B' },
    vivaldi: { name: 'Vivaldi', icon: 'pi-palette', color: '#EF3939' },
    opera: { name: 'Opera', icon: 'pi-globe', color: '#FF1B2D' },
};
const PROXY_ROTATION_MODE_OPTIONS = [
    { label: 'Per Launch', value: 'per_launch' },
    { label: 'Hourly', value: 'hourly' },
    { label: 'Daily', value: 'daily' },
];

export interface ProfileEditData {
    profileName: string;
    emoji: string | null;
    notes: string | null;
    group: string | null;
    shortcut: number | null;
    browser: BrowserType | null;
    tags: string[];
    launchUrl: string | null;
    isPinned: boolean;
    color: string | null;
    customFlags: string | null;
    proxy: string | null;
    proxyId: string | null;
    proxyUsername: string | null;
    proxyPassword: string | null;
    // Feature 2.5: Folder Management
    folderId: string | null;
    // Feature 3.4: Launch with Extensions
    disableExtensions: boolean;
    // Feature 4.2: Proxy Rotation
    proxyRotation: ProxyRotationConfig | null;
    // Antidetect: Privacy hardened mode
    antidetectEnabled: boolean;
    // Camoufox Integration
    browserEngine: 'chrome' | 'camoufox';
    fingerprintOs: string | null;
}

@Component({
    selector: 'app-profile-edit-dialog',
    templateUrl: './profile-edit-dialog.html',
    styleUrl: './profile-edit-dialog.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        DialogModule,
        ButtonModule,
        InputTextModule,
        TextareaModule,
        SelectModule,
        ToggleSwitchModule,
        TooltipModule,
        UpperCasePipe,
    ],
})
export class ProfileEditDialog {
    private readonly messageService = inject(MessageService);
    private readonly proxyService = inject(ProxyService);
    protected readonly camoufoxService = inject(CamoufoxService);

    // Inputs
    readonly visible = input<boolean>(false);
    readonly profile = input<Profile | null>(null);
    readonly allProfiles = input<Profile[]>([]);
    readonly availableBrowsers = input<string[]>([]);
    // Feature 2.5: Folders input
    readonly folders = input<Folder[]>([]);
    // Feature 4.2: Proxy groups input
    readonly proxyGroups = input<string[]>([]);
    // New: saved proxies list from ProxyService
    readonly savedProxies = input<ProfileProxy[]>([]);

    // Outputs
    readonly visibleChange = output<boolean>();
    readonly save = output<ProfileEditData>();

    // Options
    protected readonly emojiOptions = EMOJI_OPTIONS;
    protected readonly groupOptions = GROUP_OPTIONS;
    protected readonly shortcutOptions = SHORTCUT_OPTIONS;
    protected readonly colorOptions = COLOR_OPTIONS;
    protected readonly browserInfo = BROWSER_INFO;

    // Edit state
    protected readonly editName = signal('');
    protected readonly editEmoji = signal<string | null>(null);
    protected readonly editNotes = signal<string | null>(null);
    protected readonly editGroup = signal<string | null>(null);
    protected readonly editShortcut = signal<number | null>(null);
    protected readonly editBrowser = signal<BrowserType | null>(null);
    protected readonly editTags = signal<string[]>([]);
    protected readonly editLaunchUrl = signal<string | null>(null);
    protected readonly editIsPinned = signal(false);
    protected readonly editColor = signal<string | null>(null);
    protected readonly editCustomFlags = signal<string | null>(null);
    protected readonly editProxy = signal<string | null>(null);
    // Feature 2.5: Folder Management
    protected readonly editFolderId = signal<string | null>(null);
    // Feature 3.4: Disable Extensions
    protected readonly editDisableExtensions = signal(false);
    // Antidetect: Privacy Mode
    protected readonly editAntidetectEnabled = signal(false);
    // Camoufox Integration
    protected readonly editBrowserEngine = signal<'chrome' | 'camoufox'>('chrome');
    protected readonly editFingerprintOs = signal<string | null>(null);
    protected readonly fingerprintPreview = signal<Fingerprint | null>(null);
    protected readonly isLoadingPreview = signal(false);
    protected readonly engineOptions: { label: string; value: 'chrome' | 'camoufox'; icon: string }[] = [
        { label: 'Chrome', value: 'chrome', icon: 'pi pi-chrome' },
        { label: 'Firefox', value: 'camoufox', icon: 'pi pi-shield' },
    ];
    // Feature 4.2: Proxy Rotation
    protected readonly editProxyRotationEnabled = signal(false);
    protected readonly editProxyRotationMode = signal<'per_launch' | 'hourly' | 'daily'>('per_launch');
    protected readonly editProxyRotationGroupId = signal<string | null>(null);

    // Options for proxy rotation mode - use file-level constant
    protected readonly proxyRotationModeOptions = PROXY_ROTATION_MODE_OPTIONS;

    // Proxy mode: 'none' | 'saved' | 'manual'
    protected readonly proxyMode = signal<'none' | 'saved' | 'manual'>('none');
    protected readonly selectedProxyId = signal<string | null>(null);
    protected readonly manualProxyHost = signal('');
    protected readonly manualProxyPort = signal<number | null>(null);
    protected readonly manualProxyType = signal<'http' | 'socks4' | 'socks5'>('http');
    protected readonly manualProxyUsername = signal('');
    protected readonly manualProxyPassword = signal('');
    // Inline health check
    protected readonly checkingProxy = signal(false);
    protected readonly proxyCheckResult = signal<{ isAlive: boolean; latencyMs: number } | null>(null);

    protected readonly proxyModeOptions = [
        { label: 'None', value: 'none', icon: 'pi pi-ban' },
        { label: 'Saved Proxy', value: 'saved', icon: 'pi pi-list' },
        { label: 'Manual', value: 'manual', icon: 'pi pi-pencil' },
    ];
    protected readonly proxyTypeOptions = [
        { label: 'HTTP', value: 'http' },
        { label: 'SOCKS4', value: 'socks4' },
        { label: 'SOCKS5', value: 'socks5' },
    ];

    // Computed: custom folders only (excluding system folders)
    protected readonly customFolderOptions = computed(() => {
        return this.folders().filter(f => !['all', 'favorites', 'hidden'].includes(f.id));
    });

    // Load profile data when dialog opens
    loadProfile(profile: Profile): void {
        this.editName.set(profile.name);
        this.editEmoji.set(profile.metadata?.emoji || null);
        this.editNotes.set(profile.metadata?.notes || null);
        this.editGroup.set(profile.metadata?.group || null);
        this.editShortcut.set(profile.metadata?.shortcut || null);
        this.editBrowser.set(profile.metadata?.browser || null);
        this.editTags.set(profile.metadata?.tags || []);
        this.editLaunchUrl.set(profile.metadata?.launchUrl || null);
        this.editIsPinned.set(profile.metadata?.isPinned || false);
        this.editColor.set(profile.metadata?.color || null);
        this.editCustomFlags.set(profile.metadata?.customFlags || null);
        this.editProxy.set(profile.metadata?.proxy || null);
        // Feature 2.5
        this.editFolderId.set(profile.metadata?.folderId || null);
        // Feature 3.4
        this.editDisableExtensions.set(profile.metadata?.disableExtensions || false);
        // Antidetect
        this.editAntidetectEnabled.set(profile.metadata?.antidetectEnabled || false);
        // Camoufox
        this.editBrowserEngine.set(profile.metadata?.browserEngine || 'chrome');
        this.editFingerprintOs.set(profile.metadata?.fingerprintOs || null);
        this.fingerprintPreview.set(null);
        if ((profile.metadata?.browserEngine || 'chrome') === 'camoufox' && this.camoufoxService.isInstalled()) {
            this.loadFingerprintPreview(profile.metadata?.fingerprintOs || null);
        }
        // Feature 4.2
        const rotation = profile.metadata?.proxyRotation;
        this.editProxyRotationEnabled.set(rotation?.enabled || false);
        this.editProxyRotationMode.set(rotation?.mode || 'per_launch');
        this.editProxyRotationGroupId.set(rotation?.proxyGroupId || null);

        // Proxy: determine mode from stored data
        this.proxyCheckResult.set(null);
        const proxyId = profile.metadata?.proxyId;
        const proxyStr = profile.metadata?.proxy;
        if (proxyId && this.proxyService.getById(proxyId)) {
            this.proxyMode.set('saved');
            this.selectedProxyId.set(proxyId);
            this.manualProxyHost.set('');
            this.manualProxyPort.set(null);
        } else if (proxyStr) {
            // Parse manual proxy URL
            this.proxyMode.set('manual');
            this.selectedProxyId.set(null);
            this.parseProxyUrl(proxyStr);
            this.manualProxyUsername.set(profile.metadata?.proxyUsername || '');
            this.manualProxyPassword.set(profile.metadata?.proxyPassword || '');
        } else {
            this.proxyMode.set('none');
            this.selectedProxyId.set(null);
            this.manualProxyHost.set('');
            this.manualProxyPort.set(null);
            this.manualProxyType.set('http');
            this.manualProxyUsername.set('');
            this.manualProxyPassword.set('');
        }
    }

    protected async loadFingerprintPreview(os: string | null): Promise<void> {
        this.isLoadingPreview.set(true);
        try {
            const preview = await this.camoufoxService.generateFingerprintPreview(os || undefined);
            this.fingerprintPreview.set(preview);
        } catch {
            this.fingerprintPreview.set(null);
        } finally {
            this.isLoadingPreview.set(false);
        }
    }

    protected async randomizeFingerprint(): Promise<void> {
        await this.loadFingerprintPreview(this.editFingerprintOs());
    }

    protected selectEmoji(emoji: string): void {
        this.editEmoji.set(this.editEmoji() === emoji ? null : emoji);
    }

    protected selectGroup(group: string): void {
        this.editGroup.set(this.editGroup() === group ? null : group);
    }

    protected selectShortcut(num: number): void {
        const profile = this.profile();
        const existing = this.allProfiles().find(
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

    protected selectBrowser(browser: BrowserType): void {
        this.editBrowser.set(this.editBrowser() === browser ? null : browser);
    }

    protected selectColor(color: string | null): void {
        this.editColor.set(this.editColor() === color ? null : color);
    }

    protected addTag(event: Event): void {
        const input = event.target as HTMLInputElement;
        const tag = input.value.trim();
        if (tag && !this.editTags().includes(tag)) {
            this.editTags.update((tags) => [...tags, tag]);
            input.value = '';
        }
        event.preventDefault();
    }

    protected removeTag(index: number): void {
        this.editTags.update((tags) => tags.filter((_, i) => i !== index));
    }

    protected onVisibleChange(visible: boolean): void {
        this.visibleChange.emit(visible);
    }

    protected onSave(): void {
        // Build proxy rotation config
        const proxyRotation: ProxyRotationConfig | null = this.editProxyRotationEnabled()
            ? {
                enabled: true,
                mode: this.editProxyRotationMode(),
                proxyGroupId: this.editProxyRotationGroupId(),
            }
            : null;

        // Build proxy string from mode
        let proxyValue: string | null = null;
        let proxyIdValue: string | null = null;
        if (this.proxyMode() === 'saved') {
            const saved = this.selectedProxyId();
            if (saved) {
                const p = this.proxyService.getById(saved);
                if (p) {
                    proxyValue = this.proxyService.formatProxyUrl(p);
                    proxyIdValue = saved;
                }
            }
        } else if (this.proxyMode() === 'manual') {
            const host = this.manualProxyHost().trim();
            const port = this.manualProxyPort();
            if (host && port) {
                proxyValue = `${this.manualProxyType()}://${host}:${port}`;
            }
        }

        this.save.emit({
            profileName: this.editName().trim(),
            emoji: this.editEmoji(),
            notes: this.editNotes(),
            group: this.editGroup(),
            shortcut: this.editShortcut(),
            browser: this.editBrowser(),
            tags: this.editTags(),
            launchUrl: this.editLaunchUrl(),
            isPinned: this.editIsPinned(),
            color: this.editColor(),
            customFlags: this.editCustomFlags(),
            proxy: proxyValue,
            proxyId: proxyIdValue,
            proxyUsername: this.proxyMode() === 'manual' ? (this.manualProxyUsername() || null) : null,
            proxyPassword: this.proxyMode() === 'manual' ? (this.manualProxyPassword() || null) : null,
            folderId: this.editFolderId(),
            disableExtensions: this.editDisableExtensions(),
            proxyRotation,
            antidetectEnabled: this.editAntidetectEnabled(),
            browserEngine: this.editBrowserEngine(),
            fingerprintOs: this.editFingerprintOs(),
        });
    }

    protected onCancel(): void {
        this.visibleChange.emit(false);
    }

    // === Proxy helpers ===

    private parseProxyUrl(url: string): void {
        try {
            // Format: scheme://host:port
            const match = url.match(/^(https?|socks[45]):\/\/([^:]+):(\d+)$/);
            if (match) {
                const scheme = match[1].startsWith('http') ? 'http' : match[1] as 'socks4' | 'socks5';
                this.manualProxyType.set(scheme);
                this.manualProxyHost.set(match[2]);
                this.manualProxyPort.set(parseInt(match[3], 10));
            } else {
                // Fallback: just set as host
                this.manualProxyHost.set(url);
                this.manualProxyPort.set(null);
            }
        } catch {
            this.manualProxyHost.set(url);
        }
        this.manualProxyUsername.set('');
        this.manualProxyPassword.set('');
    }

    protected onProxyModeChange(mode: 'none' | 'saved' | 'manual'): void {
        this.proxyMode.set(mode);
        this.proxyCheckResult.set(null);
        if (mode === 'none') {
            this.selectedProxyId.set(null);
            this.manualProxyHost.set('');
            this.manualProxyPort.set(null);
        }
    }

    protected async checkProxyInline(): Promise<void> {
        let host = '';
        let port = 0;

        if (this.proxyMode() === 'saved') {
            const id = this.selectedProxyId();
            if (!id) return;
            const p = this.proxyService.getById(id);
            if (!p) return;
            host = p.host;
            port = p.port;
        } else if (this.proxyMode() === 'manual') {
            host = this.manualProxyHost().trim();
            port = this.manualProxyPort() || 0;
        }

        if (!host || !port) {
            this.messageService.add({ severity: 'warn', summary: 'Missing', detail: 'Host and port required.' });
            return;
        }

        this.checkingProxy.set(true);
        this.proxyCheckResult.set(null);
        try {
            const result = await this.proxyService.checkHealth({ id: '', name: '', host, port, type: 'http' });
            this.proxyCheckResult.set({ isAlive: result.isAlive, latencyMs: result.latencyMs ?? 0 });
        } finally {
            this.checkingProxy.set(false);
        }
    }

    protected getSelectedProxyLabel(): string {
        const id = this.selectedProxyId();
        if (!id) return 'Select a proxy...';
        const p = this.proxyService.getById(id);
        return p ? `${p.host}:${p.port}` : 'Unknown';
    }
}
