import { Routes } from '@angular/router';
import { Pages } from './views/pages/pages';

export const routes: Routes = [
    {
        path: '',
        component: Pages,
        children: [
            {
                path: '',
                redirectTo: 'browsers',
                pathMatch: 'full',
            },
            {
                path: 'browsers',
                loadComponent: () => import('./views/pages/home/home').then((m) => m.Home),
            },
            {
                path: 'automation',
                loadComponent: () =>
                    import('./views/pages/automation/automation').then((m) => m.Automation),
            },
            {
                path: 'teams',
                loadComponent: () => import('./views/pages/teams/teams').then((m) => m.Teams),
            },
            {
                path: 'extensions',
                loadComponent: () =>
                    import('./views/pages/extensions/extensions').then((m) => m.Extensions),
            },
            {
                path: 'settings',
                loadComponent: () =>
                    import('./views/pages/settings/settings').then((m) => m.Settings),
            },
            {
                path: 'storage',
                loadComponent: () =>
                    import('./views/pages/storage-dashboard/storage-dashboard').then((m) => m.StorageDashboard),
            },
            {
                path: 'usage',
                loadComponent: () =>
                    import('./views/pages/usage-dashboard/usage-dashboard').then((m) => m.UsageDashboard),
            },
            {
                path: '**',
                redirectTo: 'browsers',
            },
        ],
    },
];
