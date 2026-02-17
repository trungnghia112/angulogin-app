// Column configuration for customizable table columns (Feature 11.1)

export interface ColumnConfig {
    id: ColumnId;
    label: string;
    visible: boolean;
    sortable: boolean;
    sortField?: string;
    icon?: string;
    fixed?: boolean; // Cannot be hidden (e.g. checkbox, name, actions)
    width?: string;
}

export type ColumnId =
    | 'checkbox'
    | 'pin'
    | 'name'
    | 'status'
    | 'proxy'
    | 'tags'
    | 'notes'
    | 'lastChanged'
    | 'runningTime'
    | 'size'
    | 'launchCount'
    | 'browser'
    | 'group'
    | 'actions';

export const DEFAULT_COLUMNS: ColumnConfig[] = [
    { id: 'checkbox', label: '', visible: true, sortable: false, fixed: true, width: '3rem' },
    { id: 'pin', label: '', visible: true, sortable: false, fixed: false, width: '3rem', icon: 'pi-star' },
    { id: 'name', label: 'Name', visible: true, sortable: true, sortField: 'name', fixed: true },
    { id: 'status', label: 'Status', visible: true, sortable: false },
    { id: 'proxy', label: 'Proxy', visible: true, sortable: true, sortField: 'metadata.proxy' },
    { id: 'tags', label: 'Tags', visible: true, sortable: false },
    { id: 'notes', label: 'Notes', visible: true, sortable: false },
    { id: 'lastChanged', label: 'Last Changed', visible: true, sortable: true, sortField: 'metadata.lastOpened' },
    { id: 'runningTime', label: 'Running Time', visible: true, sortable: false },
    { id: 'size', label: 'Size', visible: false, sortable: true, sortField: 'size' },
    { id: 'launchCount', label: 'Launches', visible: false, sortable: true, sortField: 'metadata.launchCount' },
    { id: 'browser', label: 'Browser', visible: false, sortable: false },
    { id: 'group', label: 'Group', visible: false, sortable: false },
    { id: 'actions', label: '', visible: true, sortable: false, fixed: true, width: '3rem', icon: 'pi-cog' },
];

export const STORAGE_KEY_COLUMNS = 'cpm-column-config';
