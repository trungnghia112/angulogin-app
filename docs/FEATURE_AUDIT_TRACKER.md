# Feature Audit Tracker

> **Project:** Chrome Profile Manager  
> **Started:** 2026-02-11  
> **Last Updated:** 2026-02-11  
> **Overall Grade:** B+ (from initial codebase audit)

---

## Progress Overview

| # | Feature | Scope | Status | Issues | Fixed |
|---|---------|-------|--------|--------|-------|
| **A1** | Browsers (Home Page) | Page | ⬜ Pending | - | - |
| **A2** | Extensions Manager | Page | ⬜ Pending | - | - |
| **A3** | Settings | Page | ⬜ Pending | - | - |
| **A4** | Storage Dashboard | Page | ⬜ Pending | - | - |
| **A5** | Usage Dashboard | Page | ⬜ Pending | - | - |
| **B1** | Profile CRUD | Feature | ✅🔧 Fixed | 4W + 3S | 4/7 |
| **B2** | Profile Launch | Feature | ⬜ Pending | - | - |
| **B3** | Profile Metadata | Feature | ⬜ Pending | - | - |
| **B4** | Folder Management | Feature | ⬜ Pending | - | - |
| **B5** | Profile Views (Card/Table) | Feature | ⬜ Pending | - | - |
| **B6** | Search & Filter | Feature | ⬜ Pending | - | - |
| **B7** | Drag & Drop Reorder | Feature | ⬜ Pending | - | - |
| **B8** | Bulk Operations | Feature | ⬜ Pending | - | - |
| **B9** | Backup & Restore | Feature | ⬜ Pending | - | - |
| **B10** | Import/Export Settings | Feature | ⬜ Pending | - | - |
| **B11** | Clear Cookies/Cache | Feature | ⬜ Pending | - | - |
| **B12** | Profile Health Check | Feature | ⬜ Pending | - | - |
| **B13** | Pin/Hide/Favorite | Feature | ⬜ Pending | - | - |
| **B14** | Profile Status Monitor | Feature | ⬜ Pending | - | - |
| **B15** | Keyboard Shortcuts | Feature | ⬜ Pending | - | - |
| **C1** | Main Nav | Component | ⬜ Pending | - | - |
| **C2** | Command Palette | Component | ⬜ Pending | - | - |
| **C3** | Profile Edit Dialog | Component | ⬜ Pending | - | - |
| **C4** | Profile Toolbar | Component | ⬜ Pending | - | - |
| **C5** | Home Sidebar | Component | ⬜ Pending | - | - |
| **D1** | ProfileService | Service | ✅🔧 Fixed | 6W + 5S | 7/11 |
| **D2** | ProfileBackend | Service | ⬜ Pending | - | - |
| **D3** | ProxyService | Service | ⬜ Pending | - | - |
| **D4** | FolderService | Service | ⬜ Pending | - | - |
| **D5** | NavigationService | Service | ⬜ Pending | - | - |
| **D6** | ActivityLogService | Service | ⬜ Pending | - | - |
| **D7** | SettingsService | Service | ⬜ Pending | - | - |
| **D8** | GlobalErrorHandler | Service | ⬜ Pending | - | - |
| **E1-E14** | Rust Backend Commands | Backend | ⬜ Pending | - | - |

**Legend:** ⬜ Pending | 🔍 Auditing | ✅ Passed | ⚠️ Issues Found | 🔧 Fixing | ✅🔧 Fixed

---

## Audit Priority Order

Suggested order (highest risk first):

1. **D1 ProfileService** — ~~Central service, 621 LOC, touches everything~~ ✅ DONE (519 LOC after refactor)
2. **B1 Profile CRUD** — ~~Core business logic (create/rename/delete/duplicate)~~ ✅ DONE
3. **B2 Profile Launch** — Security-sensitive (spawns processes)
4. **D3 ProxyService** — Security-sensitive (passwords, network)
5. **E1-E14 Rust Backend** — Native code, input sanitization
6. **B9 Backup & Restore** — File system operations, ZIP handling
7. **A3 Settings** — App configuration, persistence
8. **B3 Profile Metadata** — Data integrity
9. **B4 Folder Management** — CRUD + persistence
10. **B8 Bulk Operations** — Multi-profile actions
11. **A1 Browsers (Home)** — Main UI, 1447 LOC
12. **B5 Profile Views** — Card/Table rendering
13. **C2 Command Palette** — Search UX
14. **B6 Search & Filter** — Query logic
15. **A4 Storage Dashboard** — Charts, data viz
16. **A5 Usage Dashboard** — Charts, activity log
17. **A2 Extensions** — Extension installation flow
18. **Remaining (C1,C3-C5, D4-D8, B7,B10-B15)** — Lower risk items

---

## Completed Audits

### Codebase-wide Audit (2026-02-11)

**Report:** `docs/AUDIT_REPORT.md`

| Priority | Issue | Status |
|----------|-------|--------|
| P0 | Leaked `.env` token | ✅ Fixed |
| P0 | Missing `package-lock.json` | ✅ Fixed |
| P1 | No wildcard 404 route | ✅ Fixed |
| P1 | Package identity missing | ✅ Fixed |
| P1 | Mock data in production | ✅ Fixed |
| P1 | `any` types in ProfileBackend | ✅ Fixed |
| P2 | Stub features visible in nav | ✅ Fixed |
| P2 | No global error handler | ✅ Fixed |
| P2 | Firestore rules logic bug | ✅ Fixed |
| P2 | Firebase API key unrestricted | ⬜ Manual (GCP Console) |
| P3 | CommonModule imports | ✅ Fixed |
| P3 | Duplicate Rust functions | ✅ Fixed |
| P3 | No input sanitization (Rust) | ✅ Fixed |
| P3 | Proxy passwords in plain text | ⬜ Backlog |

---

## Individual Feature Audits

---

### D1 ProfileService — Audit (2026-02-11)

**Scope:** Full audit of `src/app/services/profile.service.ts` (621→519 LOC, -121 lines)  
**Files:** `profile.service.ts`, `home.ts` (callers)  
**Audit Type:** Full Audit  
**Commit:** `refactor(profile-service): audit fixes`

#### 🔴 Critical Issues
- None

#### 🟡 Warnings (6 found, 6 fixed)
- W1: `saveProfileMetadata` had 17 positional params → Refactored to `Partial<ProfileMetadata>` object
- W2: `toggleFavorite`/`updateSortOrder` reconstructed full metadata → Now pass only changed field
- W3: `backupProfile`/`bulkExportProfiles` bypass backend interface → Comments cleaned, added to backlog
- W4: `updateUsageStats` swallowed errors with `console.error` → Changed to `debugLog`
- W5: `loadProfileSizes` no chunking → Added CHUNK_SIZE=10 with `hasChanges` optimization
- W6: 15+ lines stale "thinking aloud" comments → Removed

#### 🟢 Suggestions (5 found, 1 fixed)
- S1: `duplicateProfile` missing input validation → ✅ Added same regex as createProfile/renameProfile
- S2: `launchChrome` redundant wrapper → ⬜ Low risk, skip
- S3: `Profile.id` inconsistent (mock-only) → ⬜ Needs broader discussion
- S4: `bulkExportProfiles` mock returns fake data → ⬜ Low risk, skip
- S5: Error handling inconsistent → ✅ Fixed via W4

#### Actions Taken
| # | Issue | Fix | Status |
|---|-------|-----|--------|
| 1 | W1: 17-param saveProfileMetadata | Refactored to `Partial<ProfileMetadata>` object | ✅ |
| 2 | W2: toggleFavorite/updateSortOrder fragile | Simplified to 1-line calls using new API | ✅ |
| 3 | W3: bypass backend abstraction | Cleaned comments, architecture decision → Backlog | ⬜ |
| 4 | W4: console.error in updateUsageStats | Changed to debugLog | ✅ |
| 5 | W5: loadProfileSizes no chunking | Added CHUNK_SIZE=10 + hasChanges check | ✅ |
| 6 | W6: stale comments | Removed 15+ lines | ✅ |
| 7 | S1: duplicateProfile no validation | Added invalid chars regex check | ✅ |
| 8 | Bonus: saveProxyRotationState | Simplified to use saveProfileMetadata | ✅ |
| 9 | Bonus: unused imports | Removed MOCK_PROFILES, BrowserType | ✅ |
| 10 | Callers: home.ts 4 call sites | Updated to new object-based API | ✅ |

#### Impact Summary
- **Lines removed:** 121 (621 → 519 LOC)
- **Files changed:** 2 (`profile.service.ts`, `home.ts`)
- **Insertions:** 94, **Deletions:** 215

---

### B1 Profile CRUD — Audit (2026-02-11)

**Scope:** Create/Rename/Delete/Duplicate across 4 layers (UI → Service → Backend → Rust)  
**Files:** `home.ts`, `profile.service.ts`, `profile.backend.ts`, `commands.rs`, NEW `validation.util.ts`  
**Audit Type:** Full Audit + Security Focus  
**Commit:** `fix(profile-crud): audit B1 fixes`

#### 🔴 Critical Issues
- None

#### 🟡 Warnings (4 found, 4 fixed)
- W1: `duplicateProfile` (home.ts) had no validation unlike create/rename → ✅ Added full validation + duplicate name check
- W2: `duplicate_profile` (Rust) used broken copy-then-rename pattern → ✅ Fixed with `content_only` + cleanup on failure
- W3: `delete_profile` (Rust) could delete ANY directory → ✅ Added safety checks (dir-only, no symlinks, min depth, no traversal)
- W4: Validation rules mismatched across 3 layers → ✅ Created shared `validateProfileName()` utility, unified Rust `sanitize_profile_name`

#### 🟢 Suggestions (3 found, 0 fixed — low risk)
- S1: Unify duplicate name check (case-insensitive) at service layer → ⬜ Low risk
- S2: Delete path scope against registered base directory → ⬜ Needs app-state changes
- S3: Transaction pattern for multi-step FS operations → ⬜ Backlog

#### Actions Taken
| # | Issue | Fix | Status |
|---|-------|-----|--------|
| 1 | W1: duplicateProfile no validation | Added validateProfileName + duplicate name check in home.ts | ✅ |
| 2 | W2: Rust duplicate copy-then-rename | Use `content_only: true` + cleanup on failure | ✅ |
| 3 | W3: delete_profile no path scope | Added 4 safety checks (is_dir, no symlink, min depth, no traversal) | ✅ |
| 4 | W4: Validation mismatch | Created `validation.util.ts`, updated Rust to also reject `<>:"|?*` | ✅ |

#### Impact Summary
- **Files changed:** 4 (`commands.rs`, `validation.util.ts` (NEW), `profile.service.ts`, `home.ts`)
- **Insertions:** 120, **Deletions:** 27

-->

