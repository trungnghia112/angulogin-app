# Phase 03: Testing & Polish
Status: ⬜ Pending
Dependencies: Phase 01, Phase 02

## Objective
Test the complete backup flow end-to-end and polish any rough edges.

## Test Cases

### TC 3.1: Basic Backup Flow
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Home with profiles | Profiles visible |
| 2 | Click Backup button on a profile (Table view) | Save dialog opens |
| 3 | Choose location, click Save | ZIP file created |
| 4 | Check toast | "Backup Successful" with filename |
| 5 | Check saved file | ZIP exists at chosen location |
| 6 | Extract ZIP | Profile folder contents intact |

### TC 3.2: Grid View Backup
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Switch to Grid view | Cards visible |
| 2 | Hover over profile card | Action buttons appear |
| 3 | Click Backup button | Save dialog opens |
| 4 | Complete backup | Same as TC 3.1 |

### TC 3.3: Cancel Backup
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click Backup button | Save dialog opens |
| 2 | Click Cancel | Dialog closes |
| 3 | Check toast | NO error toast shown |

### TC 3.4: Error Handling - Invalid Profile
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Attempt to backup non-existent profile | Error toast: "Profile does not exist" |

### TC 3.5: Activity Log (if implemented)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Complete a backup | Backup logged |
| 2 | Open Activity Log dialog | Entry shows with 📥 icon |
| 3 | Entry details | Shows "Backed up" + filename |

### TC 3.6: Large Profile Performance
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Backup a profile >500MB | No UI freeze |
| 2 | During backup | App remains responsive |
| 3 | After completion | Toast shows success |

## Polish Items

### UI Polish
- [ ] Icon choice: `pi-download` or `pi-file-export` (prefer `pi-download`)
- [ ] Tooltip text: "Backup to ZIP" or "Export as ZIP"
- [ ] Button order: Backup before Incognito (more common action)

### Error Messages
- [ ] "Profile does not exist" → User-friendly
- [ ] "Failed to create backup file" → Check permissions hint
- [ ] Network/ZIP errors → Show original error for debugging

### Edge Cases
- [ ] Profile with spaces in name
- [ ] Profile with special characters
- [ ] Very long profile name → Truncate in toast
- [ ] Profile already running → Should still backup fine

## Build Verification
- [ ] `npm run build` passes with no new errors
- [ ] `cargo build` passes
- [ ] App launches and backup works in release mode

## Files Touched (Summary)
| File | Changes |
|------|---------|
| `profile.service.ts` | +1 method (~25 lines) |
| `home.ts` | +1 method (~20 lines) |
| `home.html` | +2 buttons (~6 lines each) |
| `activity-log.service.ts` | +1 method, update 2 maps (~10 lines) |

## Estimated Effort
- **Coding:** ~1 hour
- **Testing:** ~30 minutes
- **Total:** ~1.5 hours

---

## Completion Checklist
- [ ] Phase 01 complete
- [ ] Phase 02 complete
- [ ] All test cases pass
- [ ] Build passes
- [ ] Commit with message: `feat(profiles): add backup to ZIP functionality`

---

## Notes

### Why not add a dedicated Backup page?
- Backup is a **rare action** (unlike browsing profiles)
- Context menu is the right place for per-profile actions
- Consistent with "Duplicate" and "Delete" which are also in actions

### Future: Bulk Backup
If users want to backup multiple profiles:
1. Select profiles with checkboxes
2. "Backup All" button in bottom action bar
3. Creates a single ZIP with all profiles, or
4. Opens save dialog for each (with "Save All" option)

This is out of scope for Phase 1.
