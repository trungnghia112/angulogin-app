# Phase 02: Settings Dialog UI Structure
Status: ⬜ Pending

## Objective
Create the visual shell of the Settings Dialog using PrimeNG, integrated into the Main Nav.

## Requirements
### Functional
- [ ] Create standalone `SettingsDialog` component.
- [ ] Use `p-dialog` with `modal="true"`.
- [ ] Layout: Sidebar Navigation (Left) + Content Area (Right) OR `p-tabView` (Vertical).
- [ ] Connect `MainNav` "Settings" button to open this dialog.

## Implementation Steps
1. [ ] Create `src/app/views/components/settings-dialog/settings-dialog.ts` (+html/css).
2. [ ] define `visible` signal in `MainNav` or use a Service to control visibility widely.
3. [ ] Implement the layout structure (Sidebar + Content).

## Files to Create
- `src/app/views/components/settings-dialog/settings-dialog.ts`
- `src/app/views/components/settings-dialog/settings-dialog.html`
