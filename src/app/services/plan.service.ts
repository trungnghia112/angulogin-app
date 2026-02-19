import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';
import { Feature, PLAN_CONFIG, TRIAL_DURATION_DAYS } from '../core/models/user.model';

@Injectable({ providedIn: 'root' })
export class PlanService {
    private readonly authService = inject(AuthService);

    readonly currentPlan = this.authService.currentPlan;
    readonly planLabel = computed(() => PLAN_CONFIG[this.currentPlan()].label);
    readonly profileLimit = computed(() => PLAN_CONFIG[this.currentPlan()].profileLimit);
    readonly planPrice = computed(() => PLAN_CONFIG[this.currentPlan()].price);

    /** Check if current plan includes a feature */
    canAccess(feature: Feature): boolean {
        const plan = this.currentPlan();
        return PLAN_CONFIG[plan].features.includes(feature);
    }

    /** Check if trial has expired (> 7 days since account creation) */
    isTrialExpired(): boolean {
        const profile = this.authService.profile();
        if (!profile || profile.plan !== 'trial') return false;
        const created = profile.createdAt.toDate();
        const now = new Date();
        const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays > TRIAL_DURATION_DAYS;
    }

    /** Check if user has reached profile limit */
    isAtProfileLimit(currentCount: number): boolean {
        return currentCount >= this.profileLimit();
    }
}
