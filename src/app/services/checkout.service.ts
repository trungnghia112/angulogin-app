import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { AuthService } from './auth.service';
import { PlanTier } from '../core/models/user.model';
import { environment } from '../../environments/environment';

declare global {
    interface Window {
        createLemonSqueezy?: () => void;
        LemonSqueezy?: {
            Url: { Open: (url: string) => void };
            Setup: (config: { eventHandler: (event: { event: string }) => void }) => void;
        };
    }
}

@Injectable({ providedIn: 'root' })
export class CheckoutService {
    private readonly authService = inject(AuthService);
    private readonly messageService = inject(MessageService);
    private initialized = false;

    /** Initialize LemonSqueezy overlay (call once) */
    init(): void {
        if (this.initialized) return;
        if (window.createLemonSqueezy) {
            window.createLemonSqueezy();
        }
        if (window.LemonSqueezy) {
            window.LemonSqueezy.Setup({
                eventHandler: (event) => this.handleEvent(event),
            });
        }
        this.initialized = true;
    }

    /** Open LemonSqueezy checkout overlay for a plan tier */
    openCheckout(planTier: 'starter' | 'pro' | 'team'): void {
        this.init();

        const urls = environment.lemonSqueezy;
        const baseUrl = urls?.[planTier];
        if (!baseUrl) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Not Available',
                detail: 'Checkout is not configured yet. Please try again later.',
            });
            return;
        }

        const uid = this.authService.profile()?.uid;
        if (!uid) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'You must be logged in to upgrade.',
            });
            return;
        }

        // Append firebase_uid as custom checkout data
        const separator = baseUrl.includes('?') ? '&' : '?';
        const checkoutUrl = `${baseUrl}${separator}checkout[custom][firebase_uid]=${uid}`;

        if (window.LemonSqueezy?.Url) {
            window.LemonSqueezy.Url.Open(checkoutUrl);
        } else {
            // Fallback: open in new tab
            window.open(checkoutUrl, '_blank');
        }
    }

    /** Get the customer portal URL for managing subscriptions */
    getPortalUrl(): string {
        return 'https://angulogin.lemonsqueezy.com/billing';
    }

    /** Check if a plan is higher than the current plan */
    isUpgrade(target: PlanTier): boolean {
        const order: PlanTier[] = ['trial', 'starter', 'pro', 'team'];
        const current = this.authService.currentPlan();
        return order.indexOf(target) > order.indexOf(current);
    }

    private handleEvent(event: { event: string }): void {
        if (event.event === 'Checkout.Success') {
            this.messageService.add({
                severity: 'success',
                summary: 'Payment Successful!',
                detail: 'Your plan will be activated shortly.',
                life: 5000,
            });
        }
    }
}
