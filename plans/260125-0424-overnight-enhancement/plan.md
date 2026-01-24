# Plan: Overnight Profile Enhancement Package
Created: 2026-01-25T04:24:00+07:00
Status: 🟡 In Progress

## Overview
Implement 4 safe, self-contained UI enhancements with high pass rate for overnight execution.
User will verify results in the morning.

## Tech Stack
- Frontend: Angular 21 + PrimeNG + Tailwind CSS
- Backend: Tauri 2.x (Rust) - minimal changes
- Database: JSON metadata files (.profile-meta.json)

## Phases

| Phase | Name | Status | Progress | Est. Time |
|-------|------|--------|----------|-----------|
| 01 | Color Coding | ⬜ Pending | 0% | 45 min |
| 02 | Hidden Profiles | ⬜ Pending | 0% | 30 min |
| 03 | Activity Log | ⬜ Pending | 0% | 45 min |
| 04 | Profile Preview | ⬜ Pending | 0% | 30 min |

**Total Estimated:** 2.5 hours

## Implementation Summary

### Phase 1: Color Coding
- Add `color` field to ProfileMetadata
- Color picker in Edit dialog
- Color dot/badge display in profile cards/table

### Phase 2: Hidden Profiles
- Add `isHidden` field to ProfileMetadata
- Toggle hide in context menu
- "Show Hidden" toggle in header

### Phase 3: Activity Log
- Track profile open/close events
- Store in localStorage or separate JSON
- View log in a simple dialog

### Phase 4: Profile Preview
- Tooltip on hover showing full profile info
- Use PrimeNG Tooltip with template

## Morning Test Checklist
See: `test-checklist.md`

## Commits
- [ ] feat: color coding for profiles
- [ ] feat: hidden profiles toggle
- [ ] feat: activity log tracking
- [ ] feat: profile preview on hover

---
Started: 2026-01-25T04:24:00+07:00
