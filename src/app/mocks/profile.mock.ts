/**
 * Mock data for Angular development mode (localhost:4200).
 * This data is used when Tauri runtime is not available.
 */

import { Profile, BrowserType } from '../models/profile.model';
import { Folder, ProfileTag, ProfileProxy } from '../models/folder.model';

// ============================================================================
// MOCK PROFILES - Diverse data for testing all UI states
// ============================================================================

export const MOCK_PROFILES: Profile[] = [
    {
        id: 'profile-1',
        name: 'Personal - John',
        path: '/Users/demo/ChromeProfiles/Personal',
        metadata: {
            emoji: '🏠',
            notes: 'Main personal account for everyday browsing',
            group: 'Personal',
            shortcut: 1,
            browser: 'chrome',
            status: 'active',
            tagIds: ['personal', 'main'],
        },
        isRunning: true,
        size: 1024 * 1024 * 450, // 450MB
        osIcon: 'apple',
    },
    {
        id: 'profile-2',
        name: 'Work - Company',
        path: '/Users/demo/ChromeProfiles/Work',
        metadata: {
            emoji: '💼',
            notes: 'Office work profile with company extensions',
            group: 'Work',
            shortcut: 2,
            browser: 'brave',
            status: 'active',
        },
        isRunning: false,
        size: 1024 * 1024 * 280, // 280MB
        osIcon: 'apple',
    },
    {
        id: 'profile-3',
        name: 'Development',
        path: '/Users/demo/ChromeProfiles/Development',
        metadata: {
            emoji: '🛠️',
            notes: 'Development and testing browser',
            group: 'Development',
            shortcut: 3,
            browser: 'chrome',
            status: 'active',
            tagIds: ['dev', 'testing'],
        },
        isRunning: true,
        size: 1024 * 1024 * 1200, // 1.2GB
        osIcon: 'apple',
    },
    {
        id: 'profile-4',
        name: 'Gaming',
        path: '/Users/demo/ChromeProfiles/Gaming',
        metadata: {
            emoji: '🎮',
            notes: 'Gaming accounts and streaming',
            group: 'Personal',
            shortcut: 4,
            browser: 'edge',
            status: 'active',
        },
        isRunning: false,
        size: 1024 * 1024 * 180, // 180MB
        osIcon: 'windows',
    },
    {
        id: 'profile-5',
        name: 'Social Media',
        path: '/Users/demo/ChromeProfiles/Social',
        metadata: {
            emoji: '📱',
            notes: 'Facebook, Twitter, Instagram',
            group: 'Social',
            shortcut: 5,
            browser: 'arc',
            status: 'active',
            tagIds: ['social'],
        },
        isRunning: false,
        size: 1024 * 1024 * 320, // 320MB
        osIcon: 'apple',
    },
    {
        id: 'profile-6',
        name: 'Shopping',
        path: '/Users/demo/ChromeProfiles/Shopping',
        metadata: {
            emoji: '🛒',
            notes: 'Amazon, eBay accounts',
            group: 'Shopping',
            shortcut: null,
            browser: 'chrome',
            status: 'active',
        },
        isRunning: false,
        size: 1024 * 1024 * 95, // 95MB
        osIcon: 'apple',
    },
    {
        id: 'profile-7',
        name: 'Banking',
        path: '/Users/demo/ChromeProfiles/Banking',
        metadata: {
            emoji: '🔒',
            notes: 'Secure banking profile - no extensions',
            group: 'Work',
            shortcut: 7,
            browser: 'brave',
            status: 'active',
            tagIds: ['secure', 'finance'],
        },
        isRunning: false,
        size: 1024 * 1024 * 45, // 45MB
        osIcon: 'apple',
    },
    {
        id: 'profile-8',
        name: 'Test Profile 1',
        path: '/Users/demo/ChromeProfiles/Test1',
        metadata: {
            emoji: null,
            notes: null,
            group: 'Development',
            shortcut: null,
            browser: 'chrome',
            status: 'suspended',
        },
        isRunning: false,
        size: 1024 * 1024 * 12, // 12MB
        osIcon: 'apple',
    },
    {
        id: 'profile-9',
        name: 'Client A',
        path: '/Users/demo/ChromeProfiles/ClientA',
        metadata: {
            emoji: '🌐',
            notes: 'Client A project access',
            group: 'Work',
            shortcut: 9,
            browser: 'chrome',
            status: 'active',
        },
        isRunning: true,
        size: 1024 * 1024 * 156, // 156MB
        osIcon: 'apple',
    },
    {
        id: 'profile-10',
        name: 'Client B',
        path: '/Users/demo/ChromeProfiles/ClientB',
        metadata: {
            emoji: '📧',
            notes: 'Client B email and project management',
            group: 'Work',
            shortcut: null,
            browser: 'edge',
            status: 'active',
        },
        isRunning: false,
        size: 1024 * 1024 * 89, // 89MB
        osIcon: 'windows',
    },
    {
        id: 'profile-11',
        name: 'Archive - Old Account',
        path: '/Users/demo/ChromeProfiles/Archive',
        metadata: {
            emoji: '📦',
            notes: 'Old account - rarely used',
            group: 'Other',
            shortcut: null,
            browser: 'chrome',
            status: 'banned',
        },
        isRunning: false,
        size: 1024 * 1024 * 2100, // 2.1GB
        osIcon: 'apple',
    },
    {
        id: 'profile-12',
        name: 'Minimal Profile',
        path: '/Users/demo/ChromeProfiles/Minimal',
        metadata: {
            emoji: null,
            notes: null,
            group: null,
            shortcut: null,
            browser: null,
            status: 'no_status',
        },
        isRunning: false,
        size: 1024 * 1024 * 8, // 8MB - very small
        osIcon: 'apple',
    },
];

// ============================================================================
// MOCK FOLDERS - For sidebar testing
// ============================================================================

export const MOCK_FOLDERS: Folder[] = [
    { id: 'folder-1', name: 'Work', icon: 'pi-briefcase', color: '#3B82F6', profileCount: 4 },
    { id: 'folder-2', name: 'Personal', icon: 'pi-home', color: '#22C55E', profileCount: 3 },
    { id: 'folder-3', name: 'Development', icon: 'pi-code', color: '#8B5CF6', profileCount: 2 },
    { id: 'folder-4', name: 'Social', icon: 'pi-users', color: '#EC4899', profileCount: 1 },
    { id: 'folder-5', name: 'Shopping', icon: 'pi-shopping-cart', color: '#F59E0B', profileCount: 1 },
    { id: 'folder-6', name: 'Other', icon: 'pi-folder', color: '#71717A', profileCount: 1 },
];

// ============================================================================
// MOCK BROWSERS - Available browsers
// ============================================================================

export const MOCK_AVAILABLE_BROWSERS: BrowserType[] = ['chrome', 'brave', 'edge', 'arc'];

// ============================================================================
// MOCK TAGS - For profile tagging
// ============================================================================

export const MOCK_TAGS: ProfileTag[] = [
    { id: 'personal', name: 'Personal', color: '#22C55E' },
    { id: 'main', name: 'Main', color: '#3B82F6' },
    { id: 'dev', name: 'Dev', color: '#8B5CF6' },
    { id: 'testing', name: 'Testing', color: '#F59E0B' },
    { id: 'social', name: 'Social', color: '#EC4899' },
    { id: 'secure', name: 'Secure', color: '#EF4444' },
    { id: 'finance', name: 'Finance', color: '#14B8A6' },
];

// ============================================================================
// MOCK PROXIES - For proxy testing
// ============================================================================

export const MOCK_PROXIES: ProfileProxy[] = [
    { id: 'proxy-1', name: 'US Proxy', host: '192.168.1.100', port: 8080, type: 'http' },
    { id: 'proxy-2', name: 'EU Proxy', host: '10.0.0.50', port: 1080, type: 'socks5' },
    { id: 'proxy-3', name: 'Asia Proxy', host: 'proxy.example.com', port: 3128, type: 'http' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get mock profiles filtered by folder/group
 */
export function getMockProfilesByGroup(group: string | null): Profile[] {
    if (!group) return MOCK_PROFILES;
    return MOCK_PROFILES.filter(p => p.metadata?.group === group);
}

/**
 * Get a single mock profile by ID
 */
export function getMockProfileById(id: string): Profile | undefined {
    return MOCK_PROFILES.find(p => p.id === id);
}

/**
 * Get a single mock profile by path
 */
export function getMockProfileByPath(path: string): Profile | undefined {
    return MOCK_PROFILES.find(p => p.path === path);
}
