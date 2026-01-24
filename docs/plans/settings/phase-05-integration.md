# Phase 05: Integration & Persistence
Status: ⬜ Pending

## Objective
Ensure settings are loaded and applied immediately upon application startup to prevent "Style FOUC" (Flash of Unstyled Content).

## Requirements
### Functional
- [ ] **App Init**: Load settings from LocalStorage before Angular app fully renders.
- [ ] **Theme Application**: Apply Primary Color and Scale immediately.
- [ ] **Validation**: Ensure corrupt settings data doesn't crash the app (Safety fallback).

## Implementation Steps
1. [ ] Create `APP_INITIALIZER` provider in `app.config.ts`.
2. [ ] Call `settingsStore.load()` and `themeService.apply()`.
3. [ ] Verify "Fuchsia" (or saved color) is applied correctly on reload.

## Test Criteria
- [ ] Reload app: Theme matches saved preference instantly.
- [ ] Invalid JSON in localStorage: App reverts to defaults without error.
