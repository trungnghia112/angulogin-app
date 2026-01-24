# Changelog

## [2026-01-24]
### Added
- **Dark/Light Mode Support**: Comprehensive implementation across all containers (`bg-surface-50 dark:bg-surface-950`).
- **Theme Persistence**: Dark mode choice is now saved to `localStorage`.
- **Accessibility Improvements**: Added `aria-label`, `aria-current`, and semantic tags to sidebar and main navigation.
- **Audit System**: Created `docs/reports/audit_2026_01_24.md` with UI/UX and Security findings.

### Fixed
- **Security**: 
    - Moved `.env` to `.gitignore` and removed from git tracking.
    - Updated `firestore.rules` to enforce authentication and owner-based access.
- **UI/UX Bugs**:
    - Fixed invalid classes: `text-surface-00` -> `text-surface-0`.
    - Fixed invalid colors: `bg-surface-900-800` -> `bg-surface-800`.
    - Resolved build warning: `h-(--spacing-header)` -> `h-[var(--spacing-header)]` for Tailwind v4 compatibility.

### Changed
- Refactored `Sidebar` and `MainNav` components for better structure and theme compliance.
- Switched to unified Grey palette for all surface colors.
