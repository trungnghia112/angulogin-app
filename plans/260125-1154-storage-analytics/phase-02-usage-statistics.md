# Phase 02: Usage Statistics
Status: ⬜ Pending
Dependencies: Phase 01 (Storage Dashboard page exists)

## Objective
Track và hiển thị usage statistics: số lần launch, thời gian sử dụng, profile hay dùng nhất.

## Requirements

### Functional
- [ ] Track launch count mỗi khi mở profile
- [ ] Track session duration (thời gian từ launch đến close)
- [ ] Hiển thị usage stats trong Storage Dashboard
- [ ] Card: "Most Used Profile" với launch count
- [ ] Card: "Total Usage Time" 
- [ ] Bar chart: Top profiles by usage
- [ ] Usage heatmap (optional - calendar view)

### Non-Functional
- [ ] Stats persist qua app restarts (lưu trong metadata)
- [ ] Không ảnh hưởng performance khi tracking

## Implementation Steps

### Metadata Extension
1. [ ] Thêm fields vào ProfileMetadata:
   - `launchCount: number`
   - `totalUsageMinutes: number`
   - `lastSessionDuration: number`

### Backend (Rust)
1. [ ] Update `launch_profile` để increment launchCount
2. [ ] Add command `track_session_end(profile_path, duration_minutes)`
3. [ ] Update metadata save logic

### Frontend (Angular)
1. [ ] Update ProfileService để track launches
2. [ ] Add session end tracking (detect when Chrome closes - optional)
3. [ ] Create UsageStatsCard component
4. [ ] Add usage chart to Storage Dashboard
5. [ ] Create "Most Used" ranking list

## Files to Create/Modify

### Modify
- `src/app/models/profile.model.ts` - Add usage fields
- `src/app/services/profile.service.ts` - Track usage
- `src/app/views/pages/storage-dashboard/storage-dashboard.ts` - Display stats
- `src-tauri/src/commands.rs` - Launch count increment

## Data Structure

```typescript
interface ProfileMetadata {
  // Existing fields...
  
  // Usage Statistics (NEW)
  launchCount?: number;           // Số lần mở
  totalUsageMinutes?: number;     // Tổng thời gian dùng
  lastSessionDuration?: number;   // Phiên gần nhất (phút)
}
```

## UI Addition to Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  Usage Statistics                                        │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │Most Used │ │Total Time│ │ Launches │               │
│  │ Work     │ │ 45 hrs   │ │ 234      │               │
│  │ 89 times │ │ this mo. │ │ this mo. │               │
│  └──────────┘ └──────────┘ └──────────┘               │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │     BAR CHART: Profile Usage Ranking            │    │
│  │     Work Profile    ████████████████ 89         │    │
│  │     Personal        ██████████ 56               │    │
│  │     Development     ████████ 45                 │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Test Criteria
- [ ] Launch count increments when opening profile
- [ ] Stats display correctly in dashboard
- [ ] Stats persist after app restart
- [ ] "Most Used" shows correct profile

## Notes
- Session duration tracking phức tạp (cần detect browser close)
- Giai đoạn 1: Chỉ track launch count (đơn giản)
- Giai đoạn 2: Track duration (optional, if time permits)

---
Next Phase: phase-03-cleanup-suggestions.md
