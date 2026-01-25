# Phase 01: Storage Dashboard UI
Status: ⬜ Pending
Dependencies: None

## Objective
Tạo trang Storage Dashboard hiển thị phân tích dung lượng tất cả profiles dưới dạng charts trực quan.

## Requirements

### Functional
- [ ] Tạo route `/storage` và navigation
- [ ] Hiển thị tổng dung lượng tất cả profiles
- [ ] Pie chart: Tỷ lệ dung lượng từng profile
- [ ] Bar chart: Top 10 profiles lớn nhất
- [ ] Cards: Profile lớn nhất, nhỏ nhất, trung bình
- [ ] List view: Tất cả profiles với size, sorted by size

### Non-Functional
- [ ] Responsive layout (desktop + tablet)
- [ ] Dark mode support
- [ ] Loading state khi fetching data

## Implementation Steps

### Backend (Rust)
1. [ ] Add command `get_storage_stats` - trả về tổng dung lượng và breakdown
2. [ ] Optimize profile size calculation (đã có từ scan, có thể reuse)

### Frontend (Angular)
1. [ ] Tạo component `storage-dashboard` trong `views/pages/storage-dashboard/`
2. [ ] Add route `/storage` trong `app.routes.ts`
3. [ ] Add navigation link "Storage" trong sidebar/nav
4. [ ] Install/configure Chart.js hoặc ng2-charts
5. [ ] Implement PieChart component cho profile breakdown
6. [ ] Implement BarChart component cho top profiles
7. [ ] Implement stat cards (total, largest, smallest, average)
8. [ ] Implement sortable table với tất cả profiles

## Files to Create/Modify

### Create
- `src/app/views/pages/storage-dashboard/storage-dashboard.ts`
- `src/app/views/pages/storage-dashboard/storage-dashboard.html`
- `src/app/views/pages/storage-dashboard/storage-dashboard.css`

### Modify
- `src/app/app.routes.ts` - Add route
- `src/app/views/components/main-nav/main-nav.html` - Add nav item
- `src-tauri/src/commands.rs` - Add storage stats command (optional, can reuse existing)

## UI Mockup

```
┌─────────────────────────────────────────────────────────┐
│  Storage Dashboard                                       │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Total    │ │ Largest  │ │ Smallest │ │ Average  │   │
│  │ 4.5 GB   │ │ Work     │ │ Test     │ │ 150 MB   │   │
│  │          │ │ 1.2 GB   │ │ 50 MB    │ │          │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  ┌─────────────────────┐  ┌─────────────────────────┐   │
│  │    PIE CHART        │  │     BAR CHART           │   │
│  │                     │  │     Top 10 Profiles     │   │
│  │   Profile Share     │  │     ████████            │   │
│  │                     │  │     ██████              │   │
│  └─────────────────────┘  └─────────────────────────┘   │
│                                                          │
│  All Profiles (sorted by size)                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Name          │ Size    │ Last Used │ Actions   │   │
│  │ Work Profile  │ 1.2 GB  │ 2 hrs ago │ [Open]    │   │
│  │ Personal      │ 800 MB  │ 1 day ago │ [Open]    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Test Criteria
- [ ] Dashboard loads without errors
- [ ] Charts render correctly with mock/real data
- [ ] Size values formatted properly (KB/MB/GB)
- [ ] Sorting works in table
- [ ] Responsive on smaller screens
- [ ] Dark mode looks correct

## Notes
- Có thể dùng PrimeNG Chart component (wrapper của Chart.js)
- Size data đã có từ `scan_profiles`, không cần command mới
- Consider caching để không scan lại mỗi lần vào page

---
Next Phase: phase-02-usage-statistics.md
