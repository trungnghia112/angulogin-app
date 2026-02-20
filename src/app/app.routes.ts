import { Routes } from '@angular/router';
import { Pages } from './views/pages/pages';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
    // Auth routes (full-screen, no app shell)
    {
        path: 'login',
        loadComponent: () => import('./views/auth/login/login').then((m) => m.Login),
        canActivate: [guestGuard],
    },
    {
        path: 'register',
        loadComponent: () => import('./views/auth/register/register').then((m) => m.Register),
        canActivate: [guestGuard],
    },
    {
        path: 'forgot-password',
        loadComponent: () =>
            import('./views/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
        canActivate: [guestGuard],
    },
    {
        path: 'terms',
        loadComponent: () => import('./views/auth/terms/terms').then((m) => m.Terms),
    },
    {
        path: 'privacy',
        loadComponent: () => import('./views/auth/privacy/privacy').then((m) => m.Privacy),
    },
    // App routes (behind auth)
    {
        path: '',
        component: Pages,
        canActivate: [authGuard],
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
                    import('./views/pages/automation/automation-layout/automation-layout').then((m) => m.AutomationLayout),
                children: [
                    { path: '', redirectTo: 'marketplace', pathMatch: 'full' as const },
                    {
                        path: 'marketplace',
                        loadComponent: () =>
                            import('./views/pages/automation/rpa-marketplace/rpa-marketplace').then((m) => m.RpaMarketplace),
                    },
                    {
                        path: 'api-docs',
                        loadComponent: () =>
                            import('./views/pages/automation/automation').then((m) => m.Automation),
                    },
                    {
                        path: 'process',
                        loadComponent: () =>
                            import('./views/pages/automation/rpa-process/rpa-process').then((m) => m.RpaProcess),
                    },
                    {
                        path: 'task',
                        loadComponent: () =>
                            import('./views/pages/automation/rpa-task/rpa-task').then((m) => m.RpaTask),
                    },
                ],
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
                path: 'profile',
                loadComponent: () =>
                    import('./views/pages/profile/profile').then((m) => m.Profile),
            },
            {
                path: 'usage',
                loadComponent: () =>
                    import('./views/pages/usage-dashboard/usage-dashboard').then((m) => m.UsageDashboard),
            },
            {
                path: 'fingerprint-checker',
                loadComponent: () =>
                    import('./views/pages/fingerprint-checker/fingerprint-checker').then(
                        (m) => m.FingerprintChecker,
                    ),
            },
            {
                path: '**',
                redirectTo: 'browsers',
            },
        ],
    },
];

