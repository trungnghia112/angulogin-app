# 💡 BRIEF: Chrome Profile Manager

**Ngày tạo:** 2026-01-20
**Platform:** macOS Desktop (Tauri v2)

---

## 1. VẤN ĐỀ CẦN GIẢI QUYẾT

Người dùng có nhiều tài khoản Chrome (MMO/Dev) nhưng:
- Không muốn lưu cache, cookies, history vào ổ cứng trong của Mac
- Cần quản lý và khởi chạy nhiều profile một cách có tổ chức
- Cần đảm bảo Chrome gốc không bị ảnh hưởng khi rút ổ ngoài

## 2. GIẢI PHÁP ĐỀ XUẤT

Desktop app (Tauri v2) quản lý và khởi chạy Chrome profiles được lưu trữ hoàn toàn trên ổ cứng ngoài (External HDD/SSD) thông qua flag `--user-data-dir`.

## 3. ĐỐI TƯỢNG SỬ DỤNG

- **Primary:** Bản thân (power user, làm MMO/Dev)
- **Secondary:** Những ai cần quản lý nhiều Chrome profiles

## 4. TECH STACK

| Layer | Technology |
|-------|------------|
| Frontend | Angular 21 (Standalone, Signals) + TailwindCSS |
| Backend | Tauri v2 (Rust Commands) |
| OS | macOS (lệnh `open -n -a`) |

## 5. TÍNH NĂNG

### 🚀 MVP (Bắt buộc có):
- [ ] Chọn đường dẫn thư mục chứa profiles (ví dụ: `/Volumes/SSD_Samsung/Profiles`)
- [ ] Quét và hiển thị danh sách các folder con (mỗi folder = 1 profile)
- [ ] Click vào profile → Khởi chạy Chrome với `--user-data-dir`
- [ ] Lưu đường dẫn đã chọn (localStorage hoặc Tauri store)

### 🎁 Phase 2 (Làm sau):
- [ ] Tạo profile mới (tạo folder mới)
- [ ] Đổi tên profile
- [ ] Xóa profile (với confirm dialog)
- [ ] Custom icon/avatar cho mỗi profile
- [ ] Hiển thị trạng thái profile đang chạy

### 💭 Backlog (Cân nhắc):
- [ ] Backup/Restore profiles
- [ ] Sync profiles giữa các ổ
- [ ] Gắn tag/nhóm cho profiles

## 6. KIẾN TRÚC KỸ THUẬT

### Flow:
```
Angular UI → Tauri Command (Rust) → Shell Execute
     ↑              ↓
     └── Response ──┘
```

### Tauri Capabilities cần cấu hình:
- `fs:read-dir` - Scope: `/Volumes/*`
- `shell:execute` - Cho lệnh `open`

### Rust Commands:
- `scan_profiles(path: String) -> Vec<String>` - Quét folder
- `launch_profile(profile_path: String)` - Chạy Chrome

## 7. RỦI RO & LƯU Ý

| Rủi ro | Giải pháp |
|--------|-----------|
| Ổ ngoài chưa mount | Kiểm tra path tồn tại trước khi scan |
| Chrome chưa cài | Kiểm tra app tồn tại, hiện thông báo |
| Permission denied | Hướng dẫn user cấp quyền |

## 8. ƯỚC TÍNH

- **Độ phức tạp:** Đơn giản - Trung bình
- **MVP:** 1-2 sessions
- **Full app:** 3-4 sessions

---

## 🎯 BƯỚC TIẾP THEO

→ Chạy `/plan` để lên thiết kế chi tiết (UI, Rust commands, Angular services)
