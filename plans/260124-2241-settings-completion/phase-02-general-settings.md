# Phase 02: General Settings
Status: ✅ Complete
Dependencies: Phase 01

## Objective
Implement simple general preferences to control application behavior.

## Requirements
### Functional
- [x] **Default Browser Type:** Dropdown to select default browser engine (Chrome, Brave, Edge, Arc) for new profiles or quick launches.
- [x] **On Launch Action:** What to do when launching a profile? (Keep App Open, Minimize, Close).
- [x] **Show/Hide:** Toggle sidebar by default? (Replaced by Startup/App Preferences)
- [x] **Launch at Startup:** Automatically start app when you log in.
- [x] **Start Minimized:** Do not show main window on startup.
- [x] **Confirm on Delete:** Show warning before deleting a profile.

## Implementation Steps
1.  [x] **Model Update:** Update `AppSettings` interface in `settings.service.ts` to include `general` section.
2.  [x] **UI Implementation:** Add form controls to `settings.html` (SelectButtons, ToggleSwitches).
3.  [x] **Logic:** Bind signals to UI.

## Files to Modify
- `src/app/core/services/settings.service.ts`
- `src/app/views/pages/settings/settings.html`
- `src/app/views/pages/settings/settings.ts`

## Test Criteria
- [x] Changing "Default Browser" persists.
- [x] UI reflects changes immediately.

---
Next Phase: [Phase 03: Data Management](./phase-03-data-management.md)
