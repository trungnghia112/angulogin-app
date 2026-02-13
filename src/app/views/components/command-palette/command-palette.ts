import {
    Component,
    ChangeDetectionStrategy,
    signal,
    computed,
    inject,
    ElementRef,
    viewChild,
    effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ProfileService } from '../../../services/profile.service';
import { Profile } from '../../../models/profile.model';

@Component({
    selector: 'app-command-palette',
    templateUrl: './command-palette.html',
    styleUrl: './command-palette.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, DialogModule, InputTextModule],
})
export class CommandPalette {
    private readonly profileService = inject(ProfileService);
    private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

    // State
    readonly visible = signal(false);
    readonly query = signal('');
    readonly selectedIndex = signal(0);

    // Computed
    readonly profiles = this.profileService.profiles;

    readonly filteredProfiles = computed(() => {
        const q = this.query().toLowerCase().trim();
        const all = this.profiles();

        if (!q) return all.slice(0, 8);

        return all
            .filter((p) => {
                const name = p.name.toLowerCase();
                const group = p.metadata?.group?.toLowerCase() || '';
                const tags = p.metadata?.tags?.join(' ').toLowerCase() || '';
                return name.includes(q) || group.includes(q) || tags.includes(q);
            })
            .slice(0, 8);
    });

    constructor() {
        // Reset selection when query changes
        effect(() => {
            this.query();
            this.selectedIndex.set(0);
        });

        // Focus input when dialog opens
        effect(() => {
            if (this.visible()) {
                setTimeout(() => {
                    this.searchInput()?.nativeElement?.focus();
                }, 100);
            } else {
                this.query.set('');
                this.selectedIndex.set(0);
            }
        });
    }

    open(): void {
        this.visible.set(true);
    }

    close(): void {
        this.visible.set(false);
    }

    toggle(): void {
        this.visible.update((v) => !v);
    }

    onKeydown(event: KeyboardEvent): void {
        const results = this.filteredProfiles();
        const current = this.selectedIndex();

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.selectedIndex.set(Math.min(current + 1, results.length - 1));
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.selectedIndex.set(Math.max(current - 1, 0));
                break;
            case 'Enter':
                event.preventDefault();
                if (results[current]) {
                    this.launchProfile(results[current]);
                }
                break;
            case 'Escape':
                event.preventDefault();
                this.close();
                break;
        }
    }

    selectProfile(index: number): void {
        const results = this.filteredProfiles();
        if (results[index]) {
            this.launchProfile(results[index]);
        }
    }

    private async launchProfile(profile: Profile): Promise<void> {
        this.close();
        const browser = profile.metadata?.browser || 'chrome';
        const url = profile.metadata?.launchUrl || undefined;
        await this.profileService.launchBrowser({ profilePath: profile.path, browser, url });
    }

    getProfileDisplay(profile: Profile): string {
        return profile.metadata?.emoji || profile.name.charAt(0).toUpperCase();
    }
}
