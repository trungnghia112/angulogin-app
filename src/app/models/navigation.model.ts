export interface NavFeature {
    id: string;
    name: string;
    icon: string;
    route: string;
    hasSidebar: boolean;
    sidebarType?: 'folders' | 'extensions' | null;
    badge?: number; // Optional notification badge
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
        hasSidebar: false,
    },
    {
        id: 'teams',
        name: 'Teams',
        icon: 'pi-users',
        route: '/teams',
        hasSidebar: false,
    },
    {
        id: 'extensions',
        name: 'Extensions',
        icon: 'pi-th-large',
        route: '/extensions',
        hasSidebar: true,
        sidebarType: 'extensions',
    },
];
