import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';

// Services
import {
    SettingsService,
    PRIMARY_COLORS,
    SURFACE_PALETTES,
    UI_SCALES,
    GeneralSettings
} from '../../../core/services/settings.service';
import { ProfileService } from '../../../services/profile.service';
import { ProxyService } from '../../../services/proxy.service';
import { ProfileProxy } from '../../../models/folder.model';

interface SettingsCategory {
    id: string;
    label: string;
    icon: string;
}

@Component({
    selector: 'app-settings',
    templateUrl: './settings.html',
    styleUrl: './settings.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex min-h-0 overflow-hidden' },
    imports: [
        FormsModule,
        ButtonModule,
        SelectButtonModule,
        InputTextModule,
        InputTextModule,
        TooltipModule,
        InputGroupModule,
        InputGroupAddonModule,
        ToggleSwitchModule,
        DialogModule,
        TextareaModule,
    ],
})
export class Settings {
    protected readonly settingsService = inject(SettingsService);
    protected readonly profileService = inject(ProfileService);
    protected readonly proxyService = inject(ProxyService);
    private readonly messageService = inject(MessageService);
    private readonly confirmationService = inject(ConfirmationService);

    // Settings categories for sidebar navigation
    protected readonly categories: SettingsCategory[] = [
        { id: 'general', label: 'General', icon: 'pi pi-cog' },
        { id: 'appearance', label: 'Appearance', icon: 'pi pi-palette' },
        { id: 'browser', label: 'Browser Paths', icon: 'pi pi-folder' },
        { id: 'proxy', label: 'Proxy', icon: 'pi pi-globe' },
        { id: 'data', label: 'Data', icon: 'pi pi-database' },
    ];

    // Proxy Health Check state
    protected readonly checkingProxyId = signal<string | null>(null);
    protected readonly checkingAll = signal(false);

    // Active category
    protected readonly activeCategory = signal<string>('appearance');

    // Theme options
    protected readonly primaryColors = PRIMARY_COLORS;
    protected readonly surfacePalettes = SURFACE_PALETTES;
    protected readonly uiScales = UI_SCALES;

    // General Options
    protected readonly browserOptions = [
        { label: 'Chrome', value: 'chrome', icon: 'pi pi-google' },
        { label: 'Brave', value: 'brave', icon: 'pi pi-shield' },
        { label: 'Edge', value: 'edge', icon: 'pi pi-microsoft' },
        { label: 'Arc', value: 'arc', icon: 'pi pi-globe' }
    ];

    protected readonly launchOptions = [
        { label: 'Keep Open', value: 'keep-open', icon: 'pi pi-window-maximize' },
        { label: 'Minimize', value: 'minimize', icon: 'pi pi-window-minimize' },
        { label: 'Close', value: 'close', icon: 'pi pi-times' }
    ];

    // Restore Dialog state
    protected readonly showRestoreDialog = signal(false);
    protected readonly selectedBackupPath = signal('');
    protected readonly conflictAction = signal<'overwrite' | 'rename' | 'skip'>('rename');
    protected readonly restoring = signal(false);

    protected readonly conflictOptions = [
        { label: 'Rename', value: 'rename' },
        { label: 'Overwrite', value: 'overwrite' },
        { label: 'Skip', value: 'skip' }
    ];

    // Auto Backup state (Feature 5.4)
    protected readonly backingUp = signal(false);
    protected readonly backupIntervalOptions = [
        { label: 'Daily', value: 1 },
        { label: 'Weekly', value: 7 },
        { label: 'Every 2 Weeks', value: 14 },
        { label: 'Monthly', value: 30 }
    ];

    // Import Proxy Dialog state
    protected readonly showImportProxyDialog = signal(false);
    protected readonly importProxyText = signal('');
    protected readonly importProxyFormat = signal<'ip:port' | 'ip:port:user:pass'>('ip:port:user:pass');
    protected readonly importingProxy = signal(false);

    protected readonly proxyFormatOptions = [
        { label: 'ip:port', value: 'ip:port' },
        { label: 'ip:port:user:pass', value: 'ip:port:user:pass' }
    ];

    // Add Single Proxy Dialog state
    protected readonly showAddProxyDialog = signal(false);
    protected readonly newProxyHost = signal('');
    protected readonly newProxyPort = signal<number | null>(null);
    protected readonly newProxyType = signal<'http' | 'socks4' | 'socks5'>('http');
    protected readonly newProxyUsername = signal('');
    protected readonly newProxyPassword = signal('');
    protected readonly newProxyGroup = signal('');

    protected readonly proxyTypeOptions = [
        { label: 'HTTP', value: 'http' },
        { label: 'SOCKS4', value: 'socks4' },
        { label: 'SOCKS5', value: 'socks5' },
    ];

    // Navigate to category
    selectCategory(id: string): void {
        this.activeCategory.set(id);
    }

    // Check if running in Tauri
    private isTauriEnvironment(): boolean {
        return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    }

    // Theme methods
    setPrimaryColor(colorName: string): void {
        this.settingsService.setPrimaryColor(colorName);
    }

    setSurface(surfaceName: string): void {
        this.settingsService.setSurface(surfaceName);
    }

    setScale(scale: number): void {
        this.settingsService.setScale(scale);
    }

    toggleDarkMode(): void {
        this.settingsService.toggleDarkMode();
    }

    // General Settings Methods
    updateGeneral<K extends keyof GeneralSettings>(key: K, event: { checked?: boolean; value?: GeneralSettings[K] } | boolean | string | number): void {
        // Handle different event types (p-inputSwitch emits event.checked or direct value for SelectButton)
        let value: GeneralSettings[K];
        if (event && typeof event === 'object' && 'checked' in event) {
            value = event.checked as GeneralSettings[K]; // InputSwitch
        } else if (event && typeof event === 'object' && 'value' in event) {
            value = event.value as GeneralSettings[K]; // SelectButton (sometimes)
        } else {
            value = event as GeneralSettings[K]; // Direct value binding
        }

        this.settingsService.setGeneralSetting(key, value);
    }

    async browseProfilesPath(): Promise<void> {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: 'Select Chrome User Data Directory',
            });

            if (selected && typeof selected === 'string') {
                this.settingsService.setProfilesPath(selected);
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            this.messageService.add({
                severity: 'error',
                summary: 'Folder Selection Failed',
                detail: errorMsg
            });
        }
    }

    async resetProfilesPath(): Promise<void> {
        const defaultPath = await this.settingsService.detectDefaultPath();
        if (defaultPath) {
            this.settingsService.setProfilesPath(defaultPath);
            this.messageService.add({
                severity: 'success',
                summary: 'Path Reset',
                detail: 'Default Chrome path has been set.',
            });
        } else {
            this.messageService.add({
                severity: 'warn',
                summary: 'Desktop Mode Required',
                detail: 'This feature only works in the desktop app.',
            });
        }
    }

    // === Data Management Methods ===

    async exportConfig(): Promise<void> {
        try {
            const filePath = await save({
                title: 'Export Configuration',
                defaultPath: `chrome-profile-manager-backup-${new Date().toISOString().slice(0, 10)}.json`,
                filters: [{ name: 'JSON', extensions: ['json'] }]
            });

            if (filePath) {
                const data = this.settingsService.exportData();
                await writeTextFile(filePath, data);
                this.messageService.add({
                    severity: 'success',
                    summary: 'Export Successful',
                    detail: 'Configuration has been exported.',
                });
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            this.messageService.add({
                severity: 'error',
                summary: 'Export Failed',
                detail: 'Could not save the configuration file: ' + errorMsg,
            });
        }
    }

    async importConfig(): Promise<void> {
        try {
            const filePath = await open({
                title: 'Import Configuration',
                multiple: false,
                filters: [{ name: 'JSON', extensions: ['json'] }]
            });

            if (filePath && typeof filePath === 'string') {
                const content = await readTextFile(filePath);
                const result = this.settingsService.importData(content);

                if (result.success) {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Import Successful',
                        detail: result.message,
                    });
                } else {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Import Failed',
                        detail: result.message,
                    });
                }
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            this.messageService.add({
                severity: 'error',
                summary: 'Import Failed',
                detail: 'Could not read the configuration file: ' + errorMsg,
            });
        }
    }

    clearData(): void {
        this.confirmationService.confirm({
            key: 'confirmDialog',
            header: 'Clear All Data',
            message: 'This will reset all settings to default and clear all stored data. This action cannot be undone. Are you sure?',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger',
            accept: () => {
                this.settingsService.clearAllData();
                this.messageService.add({
                    severity: 'success',
                    summary: 'Data Cleared',
                    detail: 'All settings have been reset to defaults.',
                });
            }
        });
    }

    // === Restore from Backup Methods ===

    openRestoreDialog(): void {
        this.showRestoreDialog.set(true);
        this.selectedBackupPath.set('');
        this.conflictAction.set('rename');
    }

    async selectBackupFile(): Promise<void> {
        try {
            const filePath = await open({
                title: 'Select Backup File',
                multiple: false,
                filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
            });

            if (filePath && typeof filePath === 'string') {
                this.selectedBackupPath.set(filePath);
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            this.messageService.add({
                severity: 'error',
                summary: 'Selection Failed',
                detail: errorMsg,
            });
        }
    }

    async restoreBackup(): Promise<void> {
        const backupPath = this.selectedBackupPath();
        if (!backupPath) {
            this.messageService.add({
                severity: 'warn',
                summary: 'No File Selected',
                detail: 'Please select a backup file first.',
            });
            return;
        }

        const profilesPath = this.settingsService.browser().profilesPath;
        if (!profilesPath) {
            this.messageService.add({
                severity: 'error',
                summary: 'No Profiles Path',
                detail: 'Please set a profiles path first in Browser Paths settings.',
            });
            return;
        }

        this.restoring.set(true);

        try {
            const result = await this.profileService.restoreFromBackup(
                backupPath,
                profilesPath,
                this.conflictAction()
            );

            this.showRestoreDialog.set(false);
            this.messageService.add({
                severity: 'success',
                summary: 'Restore Successful',
                detail: result.wasRenamed
                    ? `Profile restored as "${result.profileName}" (renamed to avoid conflict)`
                    : `Profile "${result.profileName}" has been restored.`,
            });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            this.messageService.add({
                severity: 'error',
                summary: 'Restore Failed',
                detail: errorMsg,
            });
        } finally {
            this.restoring.set(false);
        }
    }

    // === Proxy Health Check Methods ===

    async checkProxyHealth(proxy: ProfileProxy): Promise<void> {
        this.checkingProxyId.set(proxy.id);
        try {
            const result = await this.proxyService.checkHealth(proxy);
            this.messageService.add({
                severity: result.isAlive ? 'success' : 'warn',
                summary: result.isAlive ? 'Proxy Online' : 'Proxy Offline',
                detail: result.isAlive
                    ? `${proxy.host}:${proxy.port} is reachable (${result.latencyMs}ms)`
                    : `${proxy.host}:${proxy.port} - ${result.error || 'Connection failed'}`,
            });
        } finally {
            this.checkingProxyId.set(null);
        }
    }

    async checkAllProxiesHealth(): Promise<void> {
        this.checkingAll.set(true);
        try {
            const result = await this.proxyService.checkAllHealth();
            this.messageService.add({
                severity: result.dead === 0 ? 'success' : 'warn',
                summary: 'Health Check Complete',
                detail: `${result.alive} online, ${result.dead} offline out of ${result.checked} proxies`,
            });
        } finally {
            this.checkingAll.set(false);
        }
    }

    getHealthStatusIcon(proxy: ProfileProxy): string {
        if (proxy.isAlive === null || proxy.isAlive === undefined) return 'pi pi-circle text-gray-400';
        return proxy.isAlive ? 'pi pi-circle-fill text-green-500' : 'pi pi-circle-fill text-red-500';
    }

    getHealthStatusText(proxy: ProfileProxy): string {
        if (proxy.isAlive === null || proxy.isAlive === undefined) return 'Not checked';
        if (proxy.isAlive) return `Online (${proxy.latencyMs ?? 0}ms)`;
        return 'Offline';
    }

    // === Import Proxy Methods ===

    openImportProxyDialog(): void {
        this.showImportProxyDialog.set(true);
        this.importProxyText.set('');
        this.importProxyFormat.set('ip:port:user:pass');
    }

    async importProxies(): Promise<void> {
        const text = this.importProxyText();
        if (!text.trim()) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Empty Input',
                detail: 'Please paste proxy list first.',
            });
            return;
        }

        this.importingProxy.set(true);
        try {
            const result = this.proxyService.importFromText(text, this.importProxyFormat());
            this.showImportProxyDialog.set(false);

            if (result.imported > 0) {
                this.messageService.add({
                    severity: result.errors.length > 0 ? 'warn' : 'success',
                    summary: 'Import Complete',
                    detail: `${result.imported} proxies imported` +
                        (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''),
                });
            } else {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Import Failed',
                    detail: result.errors.length > 0 ? result.errors[0] : 'No valid proxies found.',
                });
            }
        } finally {
            this.importingProxy.set(false);
        }
    }

    // === Add Single Proxy Methods ===

    openAddProxyDialog(): void {
        this.showAddProxyDialog.set(true);
        this.newProxyHost.set('');
        this.newProxyPort.set(null);
        this.newProxyType.set('http');
        this.newProxyUsername.set('');
        this.newProxyPassword.set('');
        this.newProxyGroup.set('');
    }

    addSingleProxy(): void {
        const host = this.newProxyHost().trim();
        const port = this.newProxyPort();

        if (!host || !port) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Missing Fields',
                detail: 'Host and Port are required.',
            });
            return;
        }

        this.proxyService.add({
            name: `${host}:${port}`,
            host,
            port,
            type: this.newProxyType(),
            username: this.newProxyUsername() || null,
            password: this.newProxyPassword() || null,
            group: this.newProxyGroup() || null,
        });

        this.showAddProxyDialog.set(false);
        this.messageService.add({
            severity: 'success',
            summary: 'Proxy Added',
            detail: `${host}:${port} has been added.`,
        });
    }

    // === Auto Backup Methods (Feature 5.4) ===

    updateAutoBackup(key: 'enabled' | 'intervalDays', event: { checked?: boolean; value?: number }): void {
        if (key === 'enabled' && event.checked !== undefined) {
            this.settingsService.setAutoBackupSetting('enabled', event.checked);
        } else if (key === 'intervalDays' && event.value !== undefined) {
            this.settingsService.setAutoBackupSetting('intervalDays', event.value);
        }
    }

    async browseBackupFolder(): Promise<void> {
        if (!this.isTauriEnvironment()) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Not Available',
                detail: 'Folder selection is only available in desktop app'
            });
            return;
        }

        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
            directory: true,
            multiple: false,
            title: 'Select Backup Folder'
        });

        if (selected && typeof selected === 'string') {
            this.settingsService.setAutoBackupSetting('destinationFolder', selected);
        }
    }

    formatBackupDate(dateStr: string | null): string {
        if (!dateStr) return 'Never';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async runManualBackup(): Promise<void> {
        const backupSettings = this.settingsService.autoBackup();
        if (!backupSettings.destinationFolder) {
            this.messageService.add({
                severity: 'error',
                summary: 'No Destination',
                detail: 'Please select a backup destination folder first'
            });
            return;
        }

        const profilesPath = this.settingsService.browser().profilesPath;
        if (!profilesPath) {
            this.messageService.add({
                severity: 'error',
                summary: 'No Profiles Path',
                detail: 'Please configure the profiles path in Browser settings first'
            });
            return;
        }

        this.backingUp.set(true);
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const result = await invoke<{ backed_up: string[]; failed: string[]; total_size: number }>(
                'auto_backup_all_profiles',
                {
                    sourceDir: profilesPath,
                    destinationDir: backupSettings.destinationFolder
                }
            );

            // Update last backup date
            this.settingsService.setAutoBackupSetting('lastBackupDate', new Date().toISOString());

            const sizeKB = Math.round(result.total_size / 1024);
            this.messageService.add({
                severity: result.failed.length === 0 ? 'success' : 'warn',
                summary: 'Backup Complete',
                detail: `Backed up ${result.backed_up.length} profiles (${sizeKB}KB)` +
                    (result.failed.length > 0 ? `, ${result.failed.length} failed` : '')
            });
        } catch (error) {
            this.messageService.add({
                severity: 'error',
                summary: 'Backup Failed',
                detail: error instanceof Error ? error.message : String(error)
            });
        } finally {
            this.backingUp.set(false);
        }
    }
}

