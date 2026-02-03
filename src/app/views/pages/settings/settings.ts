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
        DialogModule
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

    // Navigate to category
    selectCategory(id: string): void {
        this.activeCategory.set(id);
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
    updateGeneral<K extends keyof GeneralSettings>(key: K, event: any): void {
        // Handle different event types (p-inputSwitch emits event.checked or direct value for SelectButton)
        let value: any;
        if (event && typeof event === 'object' && 'checked' in event) {
            value = event.checked; // InputSwitch
        } else if (event && typeof event === 'object' && 'value' in event) {
            value = event.value; // SelectButton (sometimes)
        } else {
            value = event; // Direct value binding
        }

        // Ensure strictly typed value
        this.settingsService.setGeneralSetting(key, value as GeneralSettings[K]);
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
            console.error('Failed to open folder picker:', err);
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
            console.error('Export failed:', err);
            this.messageService.add({
                severity: 'error',
                summary: 'Export Failed',
                detail: 'Could not save the configuration file.',
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
            console.error('Import failed:', err);
            this.messageService.add({
                severity: 'error',
                summary: 'Import Failed',
                detail: 'Could not read the configuration file.',
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
            console.error('Failed to select backup file:', err);
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
}

