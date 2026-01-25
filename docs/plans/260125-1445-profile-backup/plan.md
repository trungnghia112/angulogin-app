# Plan: Profile Backup Feature
Created: 2026-01-25 14:45
Status: 🟡 In Progress

## Overview

Implement the ability to **backup individual profiles as ZIP files** from the Home page UI. The Rust backend command `backup_profile` already exists - this plan focuses on connecting the frontend.

### Problem Statement
- Users can **Restore** profiles from backup (via Settings → Data)
- But there's **NO UI to create backups** in the first place
- Users need a way to backup profiles before making changes or for migration

### Solution
- Add **"Backup" action** to profile context menu (both Table and Grid views)
- Using existing Rust `backup_profile(profile_path, backup_path)` command
- Save as ZIP file to user-selected location via Save Dialog

## Tech Stack
- **Frontend:** Angular 21 + PrimeNG
- **Backend:** Tauri 2.x + Rust
- **UI Components:** PrimeNG Button + Context Menu + Dialog plugin

## Competitive Analysis

| Feature | Multilogin | GoLogin | Incogniton | **Our App** |
|---------|------------|---------|------------|-------------|
| Local Backup | ✅ ZIP + metadata | ✅ ZIP | ✅ Local only | 🎯 **ZIP** |
| Cloud Sync | ✅ Encrypted | ✅ Unstable | ⚠️ Limited | ❌ (Phase 2) |
| Fingerprint backup | ✅ Yes | ⚠️ Partial | ⚠️ Limited | ❌ N/A |
| Price | $99-399/mo | $49-99/mo | $30-99/mo | **FREE** |

### Our Differentiation
1. **100% Local** - No cloud, no account required
2. **Open Source / Free** - No subscription
3. **Simple UX** - Just right-click → Backup

## Phases

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 01 | Frontend Service Method | ✅ Complete | 100% |
| 02 | UI Integration | ✅ Complete | 100% |
| 03 | Testing & Polish | ⬜ Pending | 0% |

## Quick Commands
- Start Phase 1: `/code phase-01`
- Check progress: `/next`
- Save context: `/save-brain`

---

## Dependencies

### Already Implemented ✅
1. **Rust Backend:** `backup_profile(profile_path: String, backup_path: String)` in `commands.rs:420-470`
2. **Rust Backend:** `restore_from_backup(...)` in `commands.rs`
3. **Settings UI:** Restore from Backup dialog in Settings → Data
4. **Filesystem permissions:** `fs:allow-write-text-file` for $HOME/**/*

### Need to Implement ❌
1. **ProfileService:** `backupProfile(path: string)` method
2. **Home UI:** Backup button in profile actions
3. **Toast feedback:** Success/Error messages

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large profile (>1GB) blocks UI | High | Consider: Show progress, use async backup |
| Permission denied on save location | Medium | Catch error, show helpful message |
| ZIP corruption | Low | Rust zip library is stable |

---

## Future Enhancements (Phase 2+)

1. **Bulk Backup:** Select multiple profiles → Backup all
2. **Auto-backup:** Schedule daily/weekly backups
3. **Backup History:** List recent backups with restore shortcuts
4. **Cloud Integration:** Optional sync to Google Drive/Dropbox
