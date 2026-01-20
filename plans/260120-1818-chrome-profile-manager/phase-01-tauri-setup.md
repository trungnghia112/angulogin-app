# Phase 01: Tauri Setup

**Status:** ⬜ Pending
**Dependencies:** None

## Objective

Cấu hình Tauri capabilities để cho phép đọc thư mục và chạy shell commands.

## Requirements

### Functional
- [ ] Cho phép đọc thư mục trong `/Volumes/*`
- [ ] Cho phép chạy lệnh `open` của macOS

### Security
- [ ] Chỉ cho phép scope `/Volumes/*` (không phải toàn bộ filesystem)
- [ ] Chỉ cho phép lệnh `open`, không phải shell tùy ý

## Implementation Steps

1. [ ] Cài đặt plugin `@tauri-apps/plugin-fs`
2. [ ] Cài đặt plugin `@tauri-apps/plugin-shell`
3. [ ] Cấu hình `capabilities/default.json` với scope phù hợp
4. [ ] Test permission bằng cách đọc thử `/Volumes`

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `src-tauri/capabilities/default.json` | Cấu hình permissions |
| `src-tauri/Cargo.toml` | Thêm plugin dependencies |
| `src-tauri/src/lib.rs` | Register plugins |
| `package.json` | Thêm npm dependencies |

## Test Criteria

- [ ] App có thể liệt kê các ổ đĩa trong `/Volumes`
- [ ] App có thể chạy lệnh `open -a "Google Chrome"`

---

**Next Phase:** [Phase 02: Rust Commands](./phase-02-rust-commands.md)
