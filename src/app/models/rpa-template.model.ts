/**
 * RPA Template Schema v1.0
 * Standard format for all RPA automation templates.
 * Templates are stored as JSON and loaded dynamically.
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

export interface RpaTemplate {
    id: string;
    version: string;
    metadata: RpaTemplateMetadata;
    stats: RpaTemplateStats;
    requirements: RpaTemplateRequirements;
    overview: string;
    steps: RpaTemplateStep[];
    variables: RpaTemplateVariable[];
}

/** Platform color map for UI rendering */
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

/** All supported platform categories for filtering */
export const RPA_PLATFORMS = [
    'All', 'Facebook', 'TikTok', 'Twitter/X', 'Instagram',
    'LinkedIn', 'Amazon', 'Shopee', 'Reddit', 'YouTube',
    'Gmail', 'Etsy', 'Mercari', 'Poshmark', 'Other',
];
