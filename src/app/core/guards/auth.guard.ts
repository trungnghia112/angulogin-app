import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/** Protects app routes — redirects to /login if not authenticated */
export const authGuard: CanActivateFn = async () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    await authService.waitForAuthReady();

    if (authService.isLoggedIn()) {
        return true;
    }
    return router.createUrlTree(['/login']);
};

/** Protects auth pages — redirects to /browsers if already logged in */
export const guestGuard: CanActivateFn = async () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    await authService.waitForAuthReady();

    if (!authService.isLoggedIn()) {
        return true;
    }
    return router.createUrlTree(['/browsers']);
};
