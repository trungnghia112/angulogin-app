# Phase 04: Frontend UI

**Status:** ⬜ Pending
**Dependencies:** Phase 03

## Objective

Xây dựng giao diện người dùng với Angular + TailwindCSS + PrimeNG.
Sử dụng /ui-ux-pro-max để tạo layout, component.

## Requirements

### Functional
- [ ] Hiển thị ô input để nhập/chọn đường dẫn
- [ ] Hiển thị danh sách profiles dạng grid/list
- [ ] Click profile → Launch Chrome
- [ ] Hiển thị trạng thái loading/error

### UI/UX
- [ ] Dark mode support
- [ ] Responsive layout
- [ ] Hover effects trên profile cards

## Implementation Steps

1. [ ] Tạo layout chính với header + content
2. [ ] Tạo component chọn đường dẫn (PathSelector)
3. [ ] Tạo component hiển thị danh sách profiles (ProfileList)
4. [ ] Tạo component card cho mỗi profile (ProfileCard)
5. [ ] Kết nối với services và xử lý events

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `src/app/app.html` | Layout chính |
| `src/app/views/pages/home/` | [NEW] Home page component |
| `src/app/views/components/path-selector/` | [NEW] Input chọn path |
| `src/app/views/components/profile-card/` | [NEW] Card hiển thị profile |

## UI Mockup

```
┌─────────────────────────────────────────────┐
│  Chrome Profile Manager              [─][□][×]│
├─────────────────────────────────────────────┤
│  📁 Profiles Path:                          │
│  ┌─────────────────────────────────┐ [Scan] │
│  │ /Volumes/SSD_Samsung/Profiles   │        │
│  └─────────────────────────────────┘        │
├─────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ Profile │ │ Profile │ │ Profile │        │
│  │    A    │ │    B    │ │    C    │        │
│  │  [Run]  │ │  [Run]  │ │  [Run]  │        │
│  └─────────┘ └─────────┘ └─────────┘        │
└─────────────────────────────────────────────┘
```

## Test Criteria

- [ ] UI hiển thị đúng trên cả Light/Dark mode
- [ ] Click "Scan" → Hiển thị loading → Hiển thị profiles
- [ ] Click "Run" → Chrome mở với profile tương ứng
- [ ] Hiển thị toast khi có lỗi

---

**Next Phase:** [Phase 05: Testing](./phase-05-testing.md)
