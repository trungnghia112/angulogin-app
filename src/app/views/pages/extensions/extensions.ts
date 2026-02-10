import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { CheckboxModule } from 'primeng/checkbox';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MessageService } from 'primeng/api';
import { ProfileService } from '../../../services/profile.service';
import { Profile } from '../../../models/profile.model';

@Component({
    selector: 'app-extensions',
    templateUrl: './extensions.html',
    styleUrl: './extensions.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [
        FormsModule,
        ButtonModule,
        InputTextModule,
        TableModule,
        CheckboxModule,
        IconFieldModule,
        InputIconModule
    ],
})
export class Extensions {
    private readonly profileService = inject(ProfileService);
    private readonly messageService = inject(MessageService);

    protected readonly profiles = this.profileService.profiles;
    protected readonly selectedProfiles = signal<Profile[]>([]);
    protected readonly installUrl = signal('');
    protected readonly isLaunching = signal(false);

    // Filter profiles
    protected readonly searchText = signal('');
    protected readonly filteredProfiles = computed(() => {
        const search = this.searchText().toLowerCase().trim();
        const all = this.profiles();
        if (!search) return all;
        return all.filter(p => p.name.toLowerCase().includes(search));
    });

    async onInstall(): Promise<void> {
        const url = this.installUrl().trim();
        const targets = this.selectedProfiles();

        if (!url) {
            this.messageService.add({ severity: 'warn', summary: 'Missing URL', detail: 'Please enter a Chrome Web Store URL' });
            return;
        }

        if (targets.length === 0) {
            this.messageService.add({ severity: 'warn', summary: 'No Selection', detail: 'Please select at least one profile' });
            return;
        }

        this.isLaunching.set(true);
        let successCount = 0;

        try {
            // Process sequentially to avoid system freeze
            for (const profile of targets) {
                try {
                    const browser = profile.metadata?.browser || 'chrome';
                    // Launch with the extension URL
                    await this.profileService.launchBrowser(profile.path, browser, url);
                    successCount++;

                    // Small delay between launches (300ms)
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (e) {
                    console.error(`Failed to launch ${profile.name}:`, e);
                }
            }

            this.messageService.add({
                severity: 'success',
                summary: 'Launched',
                detail: `Opened URL in ${successCount} profiles`
            });
        } finally {
            this.isLaunching.set(false);
            // Optional: clear selection or URL? keeping them might be better for "retry"
        }
    }

    toggleSelectAll(): void {
        const all = this.filteredProfiles();
        if (this.selectedProfiles().length === all.length) {
            this.selectedProfiles.set([]);
        } else {
            this.selectedProfiles.set([...all]);
        }
    }
}
