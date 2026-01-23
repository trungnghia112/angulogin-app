/**
 * Platform detection utilities for Tauri/Web environments.
 * Used to determine if the app is running in Tauri (native) or browser (dev) mode.
 */

/**
 * Checks if the Tauri runtime is available.
 * Tauri injects `window.__TAURI__` when running in native mode.
 *
 * @returns true if running in Tauri, false if running in browser
 */
export function isTauriAvailable(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Checks if the app is running in web development mode (no Tauri).
 *
 * @returns true if running in browser dev mode
 */
export function isWebDevMode(): boolean {
    return !isTauriAvailable();
}
