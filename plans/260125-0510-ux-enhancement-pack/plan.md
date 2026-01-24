# Plan: User Experience Enhancement Pack
Created: 2026-01-25T05:10:00
Status: 🟡 In Progress

## Overview
Bộ 4 tính năng nâng cao trải nghiệm người dùng: thống kê sử dụng, dashboard storage, restore backup, và kéo thả sắp xếp.

## Tech Stack
- Frontend: Angular 20 + PrimeNG + Tailwind CSS
- Backend: Tauri/Rust
- Storage: localStorage + File system
- Charts: PrimeNG Charts (Chart.js)

## Phases

| Phase | Name | Status | Progress | Est. Time |
|-------|------|--------|----------|-----------|
| 01 | Usage Statistics | ⬜ Pending | 0% | 3h |
| 02 | Storage Dashboard | ⬜ Pending | 0% | 3h |
| 03 | Profile Restore | ⬜ Pending | 0% | 3h |
| 04 | Drag & Drop | ⬜ Pending | 0% | 4h |

**Total Estimated:** ~13 hours (2-3 sessions)

## Quick Commands
- Start Phase 1: `/code phase-01`
- Check progress: `/next`
- Save context: `/save-brain`

---

## Phase Details

### Phase 01: Usage Statistics (1.6)
**Mục tiêu:** Track số lần mở, thời gian sử dụng mỗi profile

**Tasks:**
- [ ] Extend ProfileMetadata với `launchCount`, `totalUsageMinutes`, `lastSessionDuration`
- [ ] Create UsageTrackingService với signals
- [ ] Track launch time khi mở profile
- [ ] Track close time (detect Chrome process end hoặc estimate)
- [ ] Display stats trong profile card/table
- [ ] Add usage stats vào Profile Preview tooltip

**Files:**
- `src/app/services/usage-tracking.service.ts` (new)
- `src/app/models/profile.model.ts` (extend)
- `src-tauri/src/commands.rs` (extend metadata)

---

### Phase 02: Storage Dashboard (9.1)
**Mục tiêu:** Biểu đồ visual hóa dung lượng storage

**Tasks:**
- [ ] Install/configure PrimeNG Charts
- [ ] Create Storage Dashboard component
- [ ] Pie chart: tỷ lệ dung lượng các profile
- [ ] Bar chart: top 10 profiles lớn nhất
- [ ] Total storage summary card
- [ ] Cleanup suggestions (profiles > 1GB, unused > 30 days)
- [ ] Tab/Dialog trong Settings hoặc riêng

**Files:**
- `src/app/views/pages/storage-dashboard/` (new page)
- `src/app/app.routes.ts` (add route)

---

### Phase 03: Profile Restore (5.2)
**Mục tiêu:** Restore profile từ backup file đã tạo

**Tasks:**
- [ ] Add `restore_from_backup` command trong Rust
- [ ] Unzip backup → target folder
- [ ] Handle conflict: overwrite/rename/cancel
- [ ] UI: file picker để chọn backup .zip
- [ ] Restore metadata từ backup
- [ ] Progress indicator cho extraction
- [ ] Validate backup integrity trước khi restore

**Files:**
- `src-tauri/src/commands.rs` (add restore command)
- `src/app/services/profile.service.ts` (add restoreFromBackup)
- `src/app/views/pages/settings/settings.html` (add restore UI)

---

### Phase 04: Drag & Drop (6.5)
**Mục tiêu:** Kéo thả để sắp xếp thứ tự profiles

**Tasks:**
- [ ] Research: PrimeNG Table drag vs cdkDrag
- [ ] Add `sortIndex` vào ProfileMetadata
- [ ] Implement drag handles trong table rows
- [ ] Implement drag trong grid cards
- [ ] Persist new order khi drop
- [ ] Visual feedback khi đang drag
- [ ] Optional: Drag vào folder/group để move

**Files:**
- `src/app/views/pages/home/home.ts` (drag logic)
- `src/app/views/pages/home/home.html` (drag UI)
- `src/app/models/profile.model.ts` (add sortIndex)

---

## Dependencies
- Phase 01 → Phase 02 (usage stats có thể dùng trong dashboard)
- Phase 03: Independent
- Phase 04: Independent

## Recommended Order
1. **Phase 01 (Usage Statistics)** - Foundation for analytics
2. **Phase 02 (Storage Dashboard)** - Combine với usage data
3. **Phase 03 (Profile Restore)** - Standalone feature
4. **Phase 04 (Drag & Drop)** - UX polish
