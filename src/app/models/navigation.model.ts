export interface NavFeature {
    id: string;
    name: string;
    icon: string;
    route: string;
    hasSidebar: boolean;
    sidebarType?: 'folders' | 'extensions' | 'settings' | 'automation' | null;
    badge?: number;
    hidden?: boolean;
}

export const NAV_FEATURES: NavFeature[] = [
    {
        id: 'browsers',
        name: 'Browsers',
        icon: 'pi-globe',
        route: '/browsers',
        hasSidebar: true,
        sidebarType: 'folders',
    },
    {
        id: 'automation',
        name: 'Automation',
        icon: 'pi-bolt',
        route: '/automation',
        hasSidebar: true,
        sidebarType: 'automation',
    },
    {
        id: 'teams',
        name: 'Teams',
        icon: 'pi-users',
        route: '/teams',
        hasSidebar: false,
        hidden: true,
    },
    {
        id: 'extensions',
        name: 'Extensions',
        icon: 'pi-th-large',
        route: '/extensions',
        hasSidebar: true,
        sidebarType: 'extensions',
    },
    {
        id: 'fingerprint-checker',
        name: 'Fingerprint Checker',
        icon: 'pi-shield',
        route: '/fingerprint-checker',
        hasSidebar: false,
    },
    {
        id: 'settings',
        name: 'Settings',
        icon: 'pi-cog',
        route: '/settings',
        hasSidebar: true,
        sidebarType: 'settings',
        hidden: true
    }
];
