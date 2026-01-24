# Phase 01: Browser Paths Implementation
Status: ⬜ Pending
Dependencies: None

## Objective
Implement the "Browser Paths" tab in the Settings page to allow users to select the directory where their Chrome User Data is located. This is critical for users who have non-standard installations or want to manage profiles from a different location/drive.

## Requirements
### Functional
- [ ] Display current "Profiles Path" (readonly input).
- [ ] "Browse" button to open native Folder Picker (via Tauri Dialog).
- [ ] "Reset to Default" button to revert to standard Chrome path.
- [ ] Auto-detect default path based on OS (macOS/Windows/Linux) if empty.
- [ ] Validate that the selected folder looks like a Chrome User Data folder (optional but recommended: check for "Local State" or "Default" folder).

### Non-Functional
- [ ] Handle Tauri APIs gracefully (browser mock fallback).
- [ ] Persist selection immediately.

## Implementation Steps
1.  [ ] **Service Update:** Add `detectDefaultPath()` to `SettingsService` to provide OS-specific standard paths.
2.  [ ] **Service Update:** Add `validatePath()` (basic check).
3.  [ ] **UI Implementation:** Build the Browser Path section in `settings.html`.
    -   InputGroup with Readonly Input + Button.
4.  [ ] **Logic Implementation:** Implement `browseProfilesPath()` in `settings.ts`.
    -   Use `open()` from `@tauri-apps/plugin-dialog`.

## Files to Modify
- `src/app/core/services/settings.service.ts` - Logic for paths.
- `src/app/views/pages/settings/settings.html` - UI.
- `src/app/views/pages/settings/settings.ts` - Component logic.

## Test Criteria
- [ ] Click "Browse" opens native folder picker.
- [ ] Selecting a folder updates the input and local storage.
- [ ] Click "Reset" restores the default OS path.
- [ ] App should allow launching profiles from the new location (Manual verification).

---
Next Phase: [Phase 02: General Settings](./phase-02-general-settings.md)
