import { ChangeDetectionStrategy, Component, computed, input, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ButtonGroupModule } from 'primeng/buttongroup';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';

export type SortByType = 'name' | 'size' | 'lastOpened' | 'custom' | 'proxy' | 'launchCount' | 'browser' | 'group';
export type ViewModeType = 'table' | 'grid';

@Component({
    selector: 'app-profile-toolbar',
    templateUrl: './profile-toolbar.html',
    styleUrl: './profile-toolbar.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'block' },
    imports: [
        FormsModule,
        ButtonModule,
        ButtonGroupModule,
        IconFieldModule,
        InputIconModule,
        InputTextModule,
        MenuModule,
        TooltipModule,
    ],
})
export class ProfileToolbar {
    private readonly router = inject(Router);

    // Inputs
    readonly searchText = input('');
    readonly viewMode = input<ViewModeType>('table');
    readonly sortBy = input<SortByType>('name');
    readonly sortOrder = input<'asc' | 'desc'>('asc');
    readonly selectedCount = input(0);
    readonly uniqueGroups = input<string[]>([]);
    readonly filterGroup = input<string | null>(null);
    readonly activeFilterCount = input(0);
    readonly showHidden = input(false);
    readonly filterFavoritesOnly = input(false);
    readonly favoriteCount = input(0);
    readonly compactMode = input(false);
    readonly todayActivityCount = input(0);

    // Outputs
    readonly searchChange = output<string>();
    readonly viewModeChange = output<ViewModeType>();
    readonly sortByChange = output<SortByType>();
    readonly sortOrderChange = output<'asc' | 'desc'>();
    readonly filterGroupChange = output<string | null>();
    readonly showHiddenChange = output<boolean>();
    readonly filterFavoritesOnlyChange = output<boolean>();
    readonly compactModeChange = output<boolean>();
    readonly scan = output<void>();
    readonly create = output<void>();
    readonly bulkCreate = output<void>();
    readonly openSidebar = output<void>();
    readonly showActivityLog = output<void>();
    readonly restoreFromBackup = output<void>();
    readonly clearFilters = output<void>();
    readonly exportProfiles = output<void>();
    readonly importProfiles = output<void>();

    // Local state
    protected readonly localSearch = signal('');

    // Sort menu items
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

    // Filter menu items
    protected readonly filterMenuItems = computed<MenuItem[]>(() => {
        const groups = this.uniqueGroups();
        const currentFilter = this.filterGroup();

        const groupItems: MenuItem[] = groups.length > 0
            ? groups.map((group) => ({
                label: group,
                icon: currentFilter === group ? 'pi pi-check' : undefined,
                command: () => this.filterGroupChange.emit(group),
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
                        disabled: this.activeFilterCount() === 0,
                        command: () => this.clearFilters.emit(),
                    },
                ],
            },
        ];
    });

    // More Actions Menu
    protected readonly moreActionsMenuItems = computed<MenuItem[]>(() => [
        {
            label: 'View Options',
            items: [
                {
                    label: this.compactMode() ? 'Normal View' : 'Compact View',
                    icon: this.compactMode() ? 'pi pi-arrows-alt' : 'pi pi-minus',
                    command: () => this.compactModeChange.emit(!this.compactMode()),
                },
                {
                    label: this.showHidden() ? 'Hide Hidden Profiles' : 'Show Hidden Profiles',
                    icon: this.showHidden() ? 'pi pi-eye-slash' : 'pi pi-eye',
                    command: () => this.showHiddenChange.emit(!this.showHidden()),
                },
                {
                    label: this.filterFavoritesOnly() ? 'Show All Profiles' : `Show Favorites Only (${this.favoriteCount()})`,
                    icon: 'pi pi-heart',
                    command: () => this.filterFavoritesOnlyChange.emit(!this.filterFavoritesOnly()),
                },
            ],
        },
        { separator: true },
        {
            label: 'Actions',
            items: [
                {
                    label: 'Bulk Create',
                    icon: 'pi pi-clone',
                    command: () => this.bulkCreate.emit(),
                },
                {
                    label: 'Restore from Backup',
                    icon: 'pi pi-upload',
                    command: () => this.restoreFromBackup.emit(),
                },
                {
                    label: 'Storage Dashboard',
                    icon: 'pi pi-chart-pie',
                    command: () => this.router.navigate(['/storage']),
                },
                {
                    label: 'Usage Statistics',
                    icon: 'pi pi-chart-bar',
                    command: () => this.router.navigate(['/usage']),
                },
            ],
        },
        { separator: true },
        {
            label: 'Import / Export',
            items: [
                {
                    label: 'Export Profiles',
                    icon: 'pi pi-download',
                    command: () => this.exportProfiles.emit(),
                },
                {
                    label: 'Import Profiles',
                    icon: 'pi pi-upload',
                    command: () => this.importProfiles.emit(),
                },
            ],
        },
    ]);

    protected onSearchInput(value: string): void {
        this.localSearch.set(value);
        this.searchChange.emit(value);
    }

    protected setSortBy(sortBy: SortByType): void {
        if (this.sortBy() === sortBy) {
            // Toggle order if same sort is clicked
            this.sortOrderChange.emit(this.sortOrder() === 'asc' ? 'desc' : 'asc');
        } else {
            this.sortByChange.emit(sortBy);
        }
    }

    protected toggleViewMode(mode: ViewModeType): void {
        this.viewModeChange.emit(mode);
    }
}
