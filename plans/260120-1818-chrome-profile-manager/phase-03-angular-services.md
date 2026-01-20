# Phase 03: Angular Services

**Status:** ⬜ Pending
**Dependencies:** Phase 02

## Objective

Tạo Angular services để gọi Tauri commands và quản lý state.

## Requirements

### Functional
- [ ] Service gọi được Rust commands qua `@tauri-apps/api`
- [ ] Lưu đường dẫn đã chọn vào localStorage/Tauri store
- [ ] Quản lý state bằng signals

## Implementation Steps

1. [ ] Cài đặt `@tauri-apps/api`
2. [ ] Tạo `ProfileService` với các methods gọi Rust
3. [ ] Tạo `SettingsService` để lưu/load config

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `src/app/services/profile.service.ts` | [NEW] Gọi Rust commands |
| `src/app/services/settings.service.ts` | [NEW] Lưu config |
| `src/app/models/profile.model.ts` | [NEW] TypeScript interfaces |

## API Contract

```typescript
// ProfileService
scanProfiles(path: string): Promise<string[]>
launchChrome(profilePath: string): Promise<void>
checkPathExists(path: string): Promise<boolean>

// SettingsService
getProfilesPath(): string | null
setProfilesPath(path: string): void
```

## Test Criteria

- [ ] `ProfileService.scanProfiles()` trả về danh sách từ Rust
- [ ] `SettingsService` lưu và load path thành công

---

**Next Phase:** [Phase 04: Frontend UI](./phase-04-frontend-ui.md)
