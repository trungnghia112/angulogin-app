/**
 * Platform detection utilities for Tauri/Web environments.
 * Used to determine if the app is running in Tauri (native) or browser (dev) mode.
 */

import { isTauri } from '@tauri-apps/api/core';

/**
 * Checks if the Tauri runtime is available.
 * Uses the official Tauri API for reliable detection.
 *
 * @returns true if running in Tauri, false if running in browser
 */
export function isTauriAvailable(): boolean {
    return isTauri();
}

/**
 * Checks if the app is running in web development mode (no Tauri).
 *
 * @returns true if running in browser dev mode
 */
export function isWebDevMode(): boolean {
    return !isTauriAvailable();
}
