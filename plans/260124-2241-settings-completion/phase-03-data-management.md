# Phase 03: Data Management
Status: ✅ Complete
Dependencies: Phase 02

## Objective
Provide tools for users to manage their application data, including backing up configuration and resetting the application.

## Requirements
### Functional
- [x] **Export Configuration:** Dump `localStorage` settings + `.brain` (metadata) to a JSON file.
- [x] **Import Configuration:** Restore settings from JSON file.
- [x] **Clear All Data:** Factory reset (wipe all settings/metadata).
    -   Must have Confirmation Dialog (`p-confirmDialog`).

## Implementation Steps
1.  [x] **Service Logic:** Add `exportData()` and `importData()` methods to `SettingsService`.
2.  [x] **UI Implementation:** Add action buttons in `Data` tab.
3.  [x] **Security:** Ensure confirm dialog is used for destructive actions.

## Files to Modify
- `src/app/core/services/settings.service.ts`
- `src/app/views/pages/settings/settings.html`
- `src/app/views/pages/settings/settings.ts`

## Test Criteria
- [x] Export creates a downloadable JSON file.
- [x] Import restores settings correctly.
- [x] Clear Data wipes storage and redirects to Welcome/Home (or resets state).

---
End of Plan
