/**
 * RPA Template Schema v2.0
 * Standard format for all RPA automation templates.
 * Templates are stored as JSON and loaded dynamically.
 * v2.0: Added status, changelog, extended step fields.
 */

export interface RpaTemplateVariable {
    name: string;
    type: 'string' | 'number' | 'boolean';
    required: boolean;
    default?: string | number | boolean;
    description: string;
}

export interface RpaTemplateStep {
    order: number;
    action: string;
    description: string;
    selector?: string;
    url?: string;
    value?: string;
    waitMs?: number;
    /** Fallback selectors if primary fails */
    fallbackSelectors?: string[];
    /** JavaScript expression to evaluate in page context */
    jsExpression?: string;
    /** CSS selector to wait for before executing */
    waitForSelector?: string;
    /** Max wait time in ms */
    timeout?: number;
    /** Human-like delay range [min, max] in ms */
    humanDelay?: [number, number];
    /** Number of iterations for scroll/loop */
    iterations?: number;
}

export interface RpaTemplateMetadata {
    title: string;
    description: string;
    longDescription?: string;
    platform: string;
    platformIcon: string;
    author: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    isPremium: boolean;
}

export interface RpaTemplateStats {
    usageCount: number;
    rating?: number;
}

export interface RpaTemplateRequirements {
    note: string;
    extensions?: string[];
}

/** Template publication status */
export type TemplateStatus = 'published' | 'draft' | 'deprecated';

/** Changelog entry for template version history */
export interface TemplateChangelogEntry {
    version: string;
    date: string;
    changes: string;
}

export interface RpaTemplate {
    id: string;
    version: string;
    metadata: RpaTemplateMetadata;
    stats: RpaTemplateStats;
    requirements: RpaTemplateRequirements;
    overview: string;
    steps: RpaTemplateStep[];
    variables: RpaTemplateVariable[];
    /** Publication status — only 'published' shown in marketplace */
    status?: TemplateStatus;
    /** Version history */
    changelog?: TemplateChangelogEntry[];
}

/** Platform color map for UI rendering (light mode) */
export const PLATFORM_COLORS: Record<string, string> = {
    Facebook: '#1877F2',
    TikTok: '#000000',
    'Twitter/X': '#1DA1F2',
    Instagram: '#E1306C',
    LinkedIn: '#0A66C2',
    Amazon: '#FF9900',
    Shopee: '#EE4D2D',
    Reddit: '#FF4500',
    YouTube: '#FF0000',
    Gmail: '#D44638',
    Etsy: '#F1641E',
    Mercari: '#4DC9F6',
    Poshmark: '#CF0032',
    Other: '#6B7280',
};

/** Platform color map for dark mode (lighter variants for contrast) */
export const PLATFORM_COLORS_DARK: Record<string, string> = {
    TikTok: '#E8E8E8',
    LinkedIn: '#4A9AE8',
    Other: '#9CA3AF',
};

/** All supported platform categories for filtering */
export const RPA_PLATFORMS = [
    'All', 'Facebook', 'TikTok', 'Twitter/X', 'Instagram',
    'LinkedIn', 'Amazon', 'Shopee', 'Reddit', 'YouTube',
    'Gmail', 'Etsy', 'Mercari', 'Poshmark', 'Other',
];

// --- Execution-layer types ---

/** Status of an RPA task execution */
export type RpaTaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/** Enhanced step with stricter action typing for the executor */
export interface ExecutableStep extends RpaTemplateStep {
    action: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'extract' | 'loop' | 'ai' | 'export';
}

/** Log entry from task execution */
export interface RpaLogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'success';
    step: number;
    message: string;
}

/** Running task instance */
export interface RpaTaskExecution {
    id: string;
    templateId: string;
    templateTitle: string;
    profilePath: string;
    profileName: string;
    browser: string;
    status: RpaTaskStatus;
    currentStep: number;
    totalSteps: number;
    progress: number; // 0-100
    startTime: string;
    endTime: string | null;
    variables: Record<string, string | number | boolean>;
    logs: RpaLogEntry[];
    sessionId: string | null;
    /** Frequency for scheduled tasks */
    frequency: 'once' | 'daily' | 'weekly' | 'custom';
}

