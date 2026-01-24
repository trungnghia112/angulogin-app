# Phase 04: General & Data Tabs
Status: ⬜ Pending

## Objective
Implement General interactions (Launch logic) and Data Management.

## Requirements
### Functional
- [ ] **General Tab**:
  - `Startup`: Toggle Switch.
  - `Tray`: Toggle Switch. (Note: Only UI for now, logic requires Tauri backend later).
- [ ] **Data Tab**:
  - `Backup`: Button -> Triggers JSON export of Store.
  - `Restore`: File Input -> Parses JSON -> Updates Store.
  - `Reset`: ConfirmDialog -> Clears Store.

## Implementation Steps
1. [ ] Flesh out UI for General & Data tabs.
2. [ ] Implement `exportData()` and `importData()` utilities.
3. [ ] Add `p-confirmDialog` for Reset action.
