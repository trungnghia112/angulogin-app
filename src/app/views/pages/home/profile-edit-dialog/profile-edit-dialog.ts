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
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { Profile, BrowserType, ProxyRotationConfig } from '../../../../models/profile.model';
import { Folder } from '../../../../models/folder.model';
import { MessageService } from 'primeng/api';

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
    // Feature 2.5: Folder Management
    folderId: string | null;
    // Feature 3.4: Launch with Extensions
    disableExtensions: boolean;
    // Feature 4.2: Proxy Rotation
    proxyRotation: ProxyRotationConfig | null;
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
    ],
})
export class ProfileEditDialog {
    private readonly messageService = inject(MessageService);

    // Inputs
    readonly visible = input<boolean>(false);
    readonly profile = input<Profile | null>(null);
    readonly allProfiles = input<Profile[]>([]);
    readonly availableBrowsers = input<string[]>([]);
    // Feature 2.5: Folders input
    readonly folders = input<Folder[]>([]);
    // Feature 4.2: Proxy groups input
    readonly proxyGroups = input<string[]>([]);

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
    // Feature 4.2: Proxy Rotation
    protected readonly editProxyRotationEnabled = signal(false);
    protected readonly editProxyRotationMode = signal<'per_launch' | 'hourly' | 'daily'>('per_launch');
    protected readonly editProxyRotationGroupId = signal<string | null>(null);

    // Options for proxy rotation mode - use file-level constant
    protected readonly proxyRotationModeOptions = PROXY_ROTATION_MODE_OPTIONS;

    // Computed: custom folders only (excluding system folders)
    protected readonly customFolderOptions = computed(() => {
        return this.folders().filter(f => !['all', 'favorites', 'hidden'].includes(f.id));
    });

    // Load profile data when dialog opens
    loadProfile(profile: Profile): void {
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
        // Feature 4.2
        const rotation = profile.metadata?.proxyRotation;
        this.editProxyRotationEnabled.set(rotation?.enabled || false);
        this.editProxyRotationMode.set(rotation?.mode || 'per_launch');
        this.editProxyRotationGroupId.set(rotation?.proxyGroupId || null);
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

        this.save.emit({
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
            proxy: this.editProxy(),
            folderId: this.editFolderId(),
            disableExtensions: this.editDisableExtensions(),
            proxyRotation,
        });
    }

    protected onCancel(): void {
        this.visibleChange.emit(false);
    }
}
