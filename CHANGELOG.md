# Changelog

## [2026-02-09]
### Added
- **Folder Management (2.5)**: 
    - Full support for creating, editing, and deleting custom folders.
    - **System Folders**: Added "Large Files (>1GB)" and "Unused (>30 days)" auto-categorization.
    - **Manage Folders Dialog**: New UI to manage custom folders directly from the Home screen.
- **UI Enhancements**:
    - Added "Create Folder" and "Manage Folders" dialogs to Home component.
    - Integrated folder management into the Sidebar interactions.

### Changed
- **FolderService**: Refactored to include logic for system folders (Large/Unused) and optimized profile counting.
- **Home Component**: 
    - Updated to use `FolderService` signal directly.
    - Fixed visibility of `folderService` for template access.

### Added
- **Dark/Light Mode Support**: Comprehensive implementation across all containers (`bg-surface-50 dark:bg-surface-950`).
- **Theme Persistence**: Dark mode choice is now saved to `localStorage`.
- **Accessibility Improvements**: Added `aria-label`, `aria-current`, and semantic tags to sidebar and main navigation.
- **Audit System**: Created `docs/reports/audit_2026_01_24.md` with UI/UX and Security findings.
- **Settings Page (Rebuilt)**: Full-page settings with proper PrimeNG API usage:
  - Dynamic Primary Color (6 colors via `updatePrimaryPalette`)
  - Dynamic Surface Palette (5 palettes via `updateSurfacePalette`)
  - Interface Scale (14px/16px/18px)
  - Dark Mode toggle with single source of truth
- **SettingsService**: Centralized state management with signals and localStorage persistence.

### Fixed
- **Security**: 
    - Moved `.env` to `.gitignore` and removed from git tracking.
    - Updated `firestore.rules` to enforce authentication and owner-based access.
- **UI/UX Bugs**:
    - Fixed invalid classes: `text-surface-00` -> `text-surface-0`.
    - Fixed invalid colors: `bg-surface-900-800` -> `bg-surface-800`.
    - Resolved build warning: `h-(--spacing-header)` -> `h-[var(--spacing-header)]` for Tailwind v4 compatibility.
- **Dark Mode Root Cause**: Fixed PrimeNG + Tailwind dark mode synchronization. Root cause was PrimeNG using `'system'` (prefers-color-scheme) while Tailwind used `.dark` class. Solution: Set `darkModeSelector: '.dark'` in PrimeNG config and add `dark:` variants to all Tailwind surface classes.
- **Visual Polish**: Refined border colors in Dark Mode (Zinc-800) for better contrast and subtlety.

### Changed
- Refactored `Sidebar` and `MainNav` components for better structure and theme compliance.
- Switched to unified Grey palette for all surface colors.
- **Home Header**: Search input now fullwidth, Sort/Filter dropdowns replaced with `p-menu [popup]`.
- **Removed ThemeService**: Consolidated into SettingsService.
