# Phase 01: Usage Statistics
Status: ⬜ Pending
Dependencies: None

## Objective
Track và hiển thị thống kê sử dụng cho mỗi profile: số lần mở, thời gian dùng, session gần nhất.

## Requirements

### Functional
- [ ] Đếm số lần launch mỗi profile
- [ ] Track thời gian sử dụng (ước lượng từ launch → close)
- [ ] Lưu last session duration
- [ ] Hiển thị stats trong UI (table, grid, tooltip)
- [ ] Persist dữ liệu qua app restart

### Non-Functional
- [ ] Performance: Không ảnh hưởng startup time
- [ ] Storage: Sử dụng existing metadata file

## Implementation Steps

### 1. Extend Data Model
```typescript
// ProfileMetadata extension
interface ProfileMetadata {
  // ... existing fields
  launchCount?: number;           // Số lần mở
  totalUsageMinutes?: number;     // Tổng thời gian sử dụng (phút)
  lastSessionDuration?: number;   // Session cuối (phút)
  lastLaunchTimestamp?: string;   // ISO timestamp launch gần nhất
}
```

### 2. Create UsageTrackingService
```typescript
// src/app/services/usage-tracking.service.ts
@Injectable({ providedIn: 'root' })
export class UsageTrackingService {
  // Track active sessions: Map<profilePath, launchTimestamp>
  private activeSessions = new Map<string, Date>();
  
  startSession(profile: Profile): void;
  endSession(profile: Profile): void;
  getStats(profile: Profile): UsageStats;
}
```

### 3. Integrate with Profile Launch
- Khi `launchProfile()`: gọi `usageTracking.startSession()`
- Update `launchCount++`
- Update `lastLaunchTimestamp`

### 4. Estimate Session End
**Options:**
- A) Check Chrome process mỗi 30s (phức tạp)
- B) Estimate: assume session = 30 phút mặc định, update khi launch lại
- C) User manually "end session" (bad UX)

**Recommended:** Option B - Simple estimation với refinement

### 5. UI Display
```html
<!-- Table column -->
<td>
  <span class="text-sm">{{ profile.metadata?.launchCount || 0 }} launches</span>
  <span class="text-xs text-muted-color">~{{ formatMinutes(profile.metadata?.totalUsageMinutes) }}</span>
</td>

<!-- Tooltip -->
"Launched 45 times\nTotal: ~12 hours\nLast session: 35 min"
```

## Files to Create/Modify
- `src/app/services/usage-tracking.service.ts` - NEW
- `src/app/models/profile.model.ts` - Extend metadata
- `src-tauri/src/commands.rs` - Extend ProfileInfo struct
- `src/app/views/pages/home/home.ts` - Integrate tracking
- `src/app/views/pages/home/home.html` - Display stats

## Test Criteria
- [ ] Launch profile → launchCount increases
- [ ] Launch time được lưu
- [ ] Stats persist sau app restart
- [ ] Stats hiển thị đúng trong UI
- [ ] Performance: no lag khi có nhiều profiles

## Notes
- ActivityLogService đã track launch events → có thể tính launchCount từ đó
- Có thể combine với existing lastOpened tracking
- Consider: reset stats option?

---
Next Phase: [Phase 02 - Storage Dashboard](./phase-02-storage-dashboard.md)
