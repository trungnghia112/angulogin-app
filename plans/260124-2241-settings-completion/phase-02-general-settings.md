# Phase 02: General Settings
Status: ⬜ Pending
Dependencies: Phase 01

## Objective
Implement simple general preferences to control application behavior.

## Requirements
### Functional
- [ ] **Default Browser Type:** Dropdown to select default browser engine (Chrome, Brave, Edge, Arc) for new profiles or quick launches.
- [ ] **On Launch Action:** What to do when launching a profile? (Keep App Open, Minimize, Close).
- [ ] **Show/Hide:** Toggle sidebar by default?

## Implementation Steps
1.  [ ] **Model Update:** Update `AppSettings` interface in `settings.service.ts` to include `general` section.
2.  [ ] **UI Implementation:** Add form controls to `settings.html` (SelectButtons, Toggles).
3.  [ ] **Logic:** Bind signals to UI.

## Files to Modify
- `src/app/core/services/settings.service.ts`
- `src/app/views/pages/settings/settings.html`
- `src/app/views/pages/settings/settings.ts`

## Test Criteria
- [ ] Changing "Default Browser" persists.
- [ ] UI reflects changes immediately.

---
Next Phase: [Phase 03: Data Management](./phase-03-data-management.md)
