# Phase 03: Cleanup Suggestions
Status: ⬜ Pending
Dependencies: Phase 01, Phase 02 (có usage data)

## Objective
Phân tích profiles và đề xuất cleanup để giải phóng dung lượng disk.

## Requirements

### Functional
- [ ] Detect profiles không dùng lâu (>30 ngày)
- [ ] Detect profiles có size bất thường lớn
- [ ] Calculate cache size trong mỗi profile
- [ ] Suggest cache cleanup với estimated savings
- [ ] Suggest profile deletion với confirmation
- [ ] Preview total space to be freed

### Non-Functional
- [ ] Không xóa gì mà không có user confirmation
- [ ] Clear warnings về data loss
- [ ] Undo option (nếu có thể)

## Implementation Steps

### Backend (Rust)
1. [ ] Add command `analyze_profile_cache(profile_path)` - trả về cache size
2. [ ] Add command `clear_profile_cache(profile_path)` - xóa cache folders
3. [ ] Define cache folders: `Cache/`, `Code Cache/`, `GPUCache/`

### Frontend (Angular)
1. [ ] Create CleanupSuggestions component
2. [ ] Add "Cleanup" tab/section trong Storage Dashboard
3. [ ] List unused profiles (>30 days since lastOpened)
4. [ ] List large cache profiles
5. [ ] "Clean All Caches" bulk action
6. [ ] Confirmation dialogs với size preview

## Files to Create/Modify

### Create
- `src/app/views/pages/storage-dashboard/cleanup-suggestions/cleanup-suggestions.ts`

### Modify
- `src/app/views/pages/storage-dashboard/storage-dashboard.ts` - Add tab
- `src-tauri/src/commands.rs` - Add cache commands

## Cleanup Analysis Logic

```typescript
interface CleanupSuggestion {
  type: 'unused_profile' | 'large_cache' | 'corrupted';
  profilePath: string;
  profileName: string;
  reason: string;           // "Not used for 45 days"
  potentialSavings: number; // bytes
  action: 'delete' | 'clear_cache' | 'archive';
  riskLevel: 'low' | 'medium' | 'high';
}
```

## Chrome Profile Cache Folders
```
Profile/
├── Cache/           # Main cache
├── Code Cache/      # V8 compiled code
├── GPUCache/        # GPU shader cache
├── Service Worker/  # SW cache
├── IndexedDB/       # May contain important data!
└── Local Storage/   # App data - DO NOT DELETE
```

**Safe to delete:** Cache/, Code Cache/, GPUCache/
**Warning required:** Service Worker/
**Never delete:** IndexedDB/, Local Storage/, Cookies

## UI Design

```
┌─────────────────────────────────────────────────────────┐
│  🧹 Cleanup Suggestions                                  │
├─────────────────────────────────────────────────────────┤
│  Potential savings: 2.3 GB                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ⚠️ Unused Profiles (not opened in 30+ days)       │  │
│  │ ┌─────────────────────────────────────────────┐   │  │
│  │ │ Old Work Profile  │ 45 days │ 500 MB │ [Del] │  │  │
│  │ │ Test Profile      │ 60 days │ 200 MB │ [Del] │  │  │
│  │ └─────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 💾 Large Cache (can be safely cleared)            │  │
│  │ ┌─────────────────────────────────────────────┐   │  │
│  │ │ Work Profile    │ Cache: 800 MB │ [Clear]   │   │  │
│  │ │ Personal        │ Cache: 400 MB │ [Clear]   │   │  │
│  │ └─────────────────────────────────────────────────┘   │  │
│  │                                                   │  │
│  │ [Clear All Caches] (1.2 GB)                       │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Test Criteria
- [ ] Correctly identifies unused profiles
- [ ] Cache size calculation is accurate
- [ ] Clear cache works without breaking profile
- [ ] Confirmation dialogs show correct info
- [ ] UI updates after cleanup

## Notes
- Cẩn thận với IndexedDB - có thể chứa data quan trọng
- Luôn test cleanup trên profile test trước
- Consider "Archive" option thay vì delete hoàn toàn

---
Next Phase: phase-04-export-reports.md
