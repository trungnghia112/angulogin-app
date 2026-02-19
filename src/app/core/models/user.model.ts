import { Timestamp } from '@angular/fire/firestore';

/** User profile stored in Firestore at users/{uid} */
export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
    plan: PlanTier;
    planExpiry: Timestamp | null;
    profileLimit: number;
    createdAt: Timestamp;
    lastLoginAt: Timestamp;
}

export type PlanTier = 'trial' | 'starter' | 'pro' | 'team';

/** Feature keys used for gating */
export type Feature =
    | 'proxy_rotation'
    | 'cloud_sync'
    | 'rpa_run'
    | 'automation_api'
    | 'usage_analytics'
    | 'health_check'
    | 'cookie_tools'
    | 'teams';

/** Plan feature matrix */
export const PLAN_CONFIG: Record<PlanTier, { label: string; profileLimit: number; features: Feature[]; price: number }> = {
    trial: {
        label: 'Free Trial',
        profileLimit: 3,
        features: [],
        price: 0,
    },
    starter: {
        label: 'Starter',
        profileLimit: 10,
        features: ['cookie_tools'],
        price: 9,
    },
    pro: {
        label: 'Pro',
        profileLimit: 100,
        features: ['proxy_rotation', 'cloud_sync', 'rpa_run', 'usage_analytics', 'health_check', 'cookie_tools'],
        price: 19,
    },
    team: {
        label: 'Team',
        profileLimit: 300,
        features: ['proxy_rotation', 'cloud_sync', 'rpa_run', 'automation_api', 'usage_analytics', 'health_check', 'cookie_tools', 'teams'],
        price: 39,
    },
};

/** Trial duration in days */
export const TRIAL_DURATION_DAYS = 7;
