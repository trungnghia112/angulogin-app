# Phase 02: Rust Commands

**Status:** ⬜ Pending
**Dependencies:** Phase 01

## Objective

Tạo các Tauri commands (Rust) để scan profiles và launch Chrome.

## Requirements

### Functional
- [ ] `scan_profiles(path)` → Trả về danh sách folder con
- [ ] `launch_chrome(profile_path)` → Mở Chrome với `--user-data-dir`
- [ ] `check_path_exists(path)` → Kiểm tra path có tồn tại không

### Error Handling
- [ ] Trả về lỗi rõ ràng nếu path không tồn tại
- [ ] Trả về lỗi nếu Chrome chưa được cài đặt

## Implementation Steps

1. [ ] Tạo command `scan_profiles` sử dụng `std::fs::read_dir`
2. [ ] Tạo command `launch_chrome` sử dụng `std::process::Command`
3. [ ] Register commands trong `lib.rs`

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `src-tauri/src/commands.rs` | [NEW] Rust commands |
| `src-tauri/src/lib.rs` | Register commands |

## API Contract

```rust
#[tauri::command]
fn scan_profiles(path: String) -> Result<Vec<String>, String>

#[tauri::command]
fn launch_chrome(profile_path: String) -> Result<(), String>

#[tauri::command]
fn check_path_exists(path: String) -> bool
```

## Test Criteria

- [ ] `scan_profiles("/Volumes")` trả về danh sách ổ đĩa
- [ ] `launch_chrome("/path/to/profile")` mở Chrome mới
- [ ] `check_path_exists("/invalid")` trả về `false`

---

**Next Phase:** [Phase 03: Angular Services](./phase-03-angular-services.md)
