/**
 * Unified profile name validation matching Rust sanitize_profile_name.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateProfileName(name: string): string | null {
    const trimmed = name.trim();

    if (!trimmed) {
        return 'Profile name cannot be empty';
    }

    if (trimmed.length > 255) {
        return 'Profile name is too long (max 255 characters)';
    }

    // Path traversal
    if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
        return 'Profile name contains invalid characters (.. / \\)';
    }

    // Filesystem-unsafe characters
    if (/[<>:"/\\|?*]/.test(trimmed)) {
        return 'Profile name cannot contain < > : " / \\ | ? *';
    }

    // Hidden files
    if (trimmed.startsWith('.')) {
        return 'Profile name cannot start with a dot';
    }

    return null;
}
