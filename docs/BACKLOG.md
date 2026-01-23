# 📋 BACKLOG: Chrome Profile Manager

**Ngày tạo:** 2026-01-23
**Cập nhật lần cuối:** 2026-01-23
**Tổng số tính năng:** 45+

---

## 📊 Trạng thái tổng quan

| Trạng thái | Số lượng |
|------------|----------|
| ✅ Done | 4 |
| 🔄 In Progress | 0 |
| 📋 Backlog | 45 |

---

## ✅ ĐÃ HOÀN THÀNH

- [x] **Profile Scanning** - Quét và hiển thị danh sách profiles từ folder
- [x] **Profile Launch** - Khởi chạy browser với profile (Chrome, Brave, Edge, Arc)
- [x] **Profile Metadata** - Lưu emoji, notes, group, shortcut, browser preference
- [x] **Native Folder Picker** - Chọn folder qua Tauri dialog

---

## 🎯 ƯU TIÊN CAO (Recommended Next)

Những tính năng nên làm sớm vì mang lại giá trị cao:

### 1. Search & Filter ✅
- **Mô tả:** Tìm kiếm profile theo tên, filter theo group/tag
- **Độ khó:** 🟢 Dễ
- **Giá trị:** Rất cao - Core UX khi có nhiều profile
- **Status:** ✅ Done

### 2. Tags System ⭐
- **Mô tả:** Gắn nhiều tags cho profile (Work, Personal, Testing...)
- **Độ khó:** 🟢 Dễ
- **Giá trị:** Cao - Tổ chức linh hoạt hơn folders
- **Status:** 📋 Backlog

### 3. Launch with URL
- **Mô tả:** Mở profile và tự động navigate đến URL
- **Độ khó:** 🟢 Dễ
- **Giá trị:** Cao - Tiết kiệm thời gian workflow
- **Status:** 📋 Backlog

### 4. Profile Pinning
- **Mô tả:** Ghim profile hay dùng lên đầu danh sách
- **Độ khó:** 🟢 Dễ
- **Giá trị:** Cao - UX tốt
- **Status:** 📋 Backlog

### 5. Quick Search (⌘+K)
- **Mô tả:** Command palette style search & launch
- **Độ khó:** 🟡 Trung bình
- **Giá trị:** Cao - Modern UX, fast access
- **Status:** 📋 Backlog

---

## 📁 NHÓM 1: Quản lý Profile Nâng Cao

| # | Tính năng | Mô tả | Độ khó | Status |
|---|-----------|-------|--------|--------|
| 1.1 | Bulk Actions | Chọn nhiều profile → launch/delete/move cùng lúc | 🟢 Dễ | 📋 |
| 1.2 | Profile Duplicating | Clone profile (copy folder) để tạo variant | 🟢 Dễ | 📋 |
| 1.3 | Profile Sorting | Sort theo tên, ngày tạo, size, lần dùng gần nhất | 🟢 Dễ | 📋 |
| 1.4 | Profile Pinning | Ghim profile hay dùng lên đầu | 🟢 Dễ | 📋 |
| 1.5 | Last Opened Tracking | Hiển thị "dùng gần nhất" cho mỗi profile | 🟢 Dễ | 📋 |
| 1.6 | Usage Statistics | Đếm số lần mở, tổng thời gian dùng | 🟡 TB | 📋 |

---

## 🏷️ NHÓM 2: Tổ chức & Phân loại

| # | Tính năng | Mô tả | Độ khó | Status |
|---|-----------|-------|--------|--------|
| 2.1 | Tags System ⭐ | Gắn nhiều tags (Work, Personal, Testing...) | 🟢 Dễ | 📋 |
| 2.2 | Smart Folders | Folder tự động dựa trên filter (VD: "Profiles > 1GB") | 🟡 TB | 📋 |
| 2.3 | Color Coding | Gán màu cho profile/group để nhận diện nhanh | 🟢 Dễ | 📋 |
| 2.4 | Favorites | Danh sách yêu thích riêng biệt | 🟢 Dễ | 📋 |
| 2.5 | Folder Management | Group profiles into custom folders | 🟡 TB | 📋 |

---

## ⚡ NHÓM 3: Khởi Chạy Nâng Cao

| # | Tính năng | Mô tả | Độ khó | Status |
|---|-----------|-------|--------|--------|
| 3.1 | Launch with URL | Mở profile + tự động navigate đến URL | 🟢 Dễ | 📋 |
| 3.2 | Launch Groups | Mở nhiều profile cùng lúc (1 click → 5 Chrome) | 🟡 TB | 📋 |
| 3.3 | Scheduled Launch | Hẹn giờ mở profile (VD: 8AM mở Work profile) | 🟡 TB | 📋 |
| 3.4 | Launch with Extensions | Toggle on/off extensions khi launch | 🔴 Khó | 📋 |
| 3.5 | Incognito Mode | Launch profile ở chế độ incognito | 🟢 Dễ | 📋 |
| 3.6 | Custom Chrome Flags | Thêm flags như `--disable-gpu`, `--no-sandbox` | 🟢 Dễ | 📋 |
| 3.7 | Window Position | Mở Chrome ở vị trí/kích thước cố định | 🟡 TB | 📋 |

---

## 🌐 NHÓM 4: Proxy & Network

| # | Tính năng | Mô tả | Độ khó | Status |
|---|-----------|-------|--------|--------|
| 4.1 | Proxy Assignment ⭐ | Gán proxy cho từng profile | 🟡 TB | 📋 |
| 4.2 | Proxy Rotation | Tự động đổi proxy theo schedule | 🔴 Khó | 📋 |
| 4.3 | Proxy Health Check | Test proxy còn hoạt động không | 🟡 TB | 📋 |
| 4.4 | Proxy Import/Export | Import danh sách proxy từ file | 🟢 Dễ | 📋 |
| 4.5 | Proxy Groups | Nhóm proxy theo region/provider | 🟢 Dễ | 📋 |

---

## 💾 NHÓM 5: Backup & Sync

| # | Tính năng | Mô tả | Độ khó | Status |
|---|-----------|-------|--------|--------|
| 5.1 | Profile Backup | Zip & backup profile ra file riêng | 🟡 TB | 📋 |
| 5.2 | Profile Restore | Restore từ backup file | 🟡 TB | 📋 |
| 5.3 | Auto Backup | Tự động backup theo schedule | 🟡 TB | 📋 |
| 5.4 | Cloud Sync (Optional) | Sync metadata lên cloud (không sync data) | 🔴 Khó | 📋 |
| 5.5 | Profile Export | Export profile settings (không data) để chia sẻ | 🟢 Dễ | 📋 |
| 5.6 | Backup Encryption | Mã hóa file backup | 🟡 TB | 📋 |

---

## 🎨 NHÓM 6: UI/UX Enhancements

| # | Tính năng | Mô tả | Độ khó | Status |
|---|-----------|-------|--------|--------|
| 6.1 | Grid/List View Toggle | Chuyển đổi giữa card grid và table list | 🟢 Dễ | 📋 |
| 6.2 | Dark/Light Theme | Toggle theme | 🟢 Dễ | 📋 |
| 6.3 | Keyboard Shortcuts | ⌘+1 mở profile 1, ⌘+N tạo mới... | 🟡 TB | 📋 |
| 6.4 | Quick Search (⌘+K) | Command palette style search | 🟡 TB | 📋 |
| 6.5 | Drag & Drop | Kéo thả để sắp xếp, di chuyển vào group | 🟡 TB | 📋 |
| 6.6 | Profile Preview | Hover để xem preview/info nhanh | 🟢 Dễ | 📋 |
| 6.7 | Compact Mode | UI thu gọn cho màn hình nhỏ | 🟢 Dễ | 📋 |
| 6.8 | Custom Themes | Cho phép user tạo theme riêng | 🟡 TB | 📋 |

---

## 🔧 NHÓM 7: Automation & Integration

| # | Tính năng | Mô tả | Độ khó | Status |
|---|-----------|-------|--------|--------|
| 7.1 | CLI Support | `cpm launch "Profile1"` từ terminal | 🟡 TB | 📋 |
| 7.2 | Alfred/Raycast Integration | Quick launch từ launcher | 🟡 TB | 📋 |
| 7.3 | Spotlight-like Search | Global hotkey để search & launch | 🟡 TB | 📋 |
| 7.4 | AppleScript Support | Automation với macOS scripts | 🔴 Khó | 📋 |
| 7.5 | Webhook Notifications | Notify khi profile được mở/đóng | 🔴 Khó | 📋 |
| 7.6 | URL Scheme | `cpm://launch/Profile1` để mở từ browser | 🟡 TB | 📋 |

---

## 🔒 NHÓM 8: Security & Privacy

| # | Tính năng | Mô tả | Độ khó | Status |
|---|-----------|-------|--------|--------|
| 8.1 | Profile Lock | Khóa profile bằng password/TouchID | 🟡 TB | 📋 |
| 8.2 | Hidden Profiles | Ẩn profile khỏi view mặc định | 🟢 Dễ | 📋 |
| 8.3 | Auto-clear Data | Tự động xóa cache/cookies khi đóng | 🟡 TB | 📋 |
| 8.4 | Activity Log | Ghi log ai mở profile nào, khi nào | 🟢 Dễ | 📋 |
| 8.5 | App Lock | Khóa toàn bộ app bằng password/TouchID | 🟡 TB | 📋 |

---

## 📊 NHÓM 9: Analytics & Insights

| # | Tính năng | Mô tả | Độ khó | Status |
|---|-----------|-------|--------|--------|
| 9.1 | Storage Dashboard | Biểu đồ dung lượng từng profile | 🟢 Dễ | 📋 |
| 9.2 | Usage Heatmap | Calendar view hiển thị ngày dùng profile | 🟡 TB | 📋 |
| 9.3 | Profile Health Check | Kiểm tra profile có lỗi, corrupted không | 🟡 TB | 📋 |
| 9.4 | Cleanup Suggestions | Gợi ý xóa cache, profile không dùng | 🟡 TB | 📋 |
| 9.5 | Export Reports | Xuất báo cáo usage dưới dạng CSV/PDF | 🟢 Dễ | 📋 |

---

## 🌍 NHÓM 10: Multi-platform & Sync

| # | Tính năng | Mô tả | Độ khó | Status |
|---|-----------|-------|--------|--------|
| 10.1 | Windows Support | Build cho Windows | 🟡 TB | 📋 |
| 10.2 | Linux Support | Build cho Linux | 🟡 TB | 📋 |
| 10.3 | Portable Mode | Chạy không cần cài đặt | 🟢 Dễ | 📋 |
| 10.4 | Multi-drive Support | Quản lý profiles từ nhiều ổ cùng lúc | 🟡 TB | 📋 |

---

## 🔮 TÍNH NĂNG TƯƠNG LAI (Nice to have)

Những ý tưởng táo bạo hơn cho future versions:

- **AI Profile Naming** - Gợi ý tên profile dựa trên usage
- **Browser Fingerprint** - Basic fingerprint customization (như anti-detect lite)
- **Session Recording** - Ghi lại session để replay
- **Profile Templates** - Tạo template profile với settings có sẵn
- **Team Sharing** - Chia sẻ profile config (không data) với team
- **Extension Sync** - Sync danh sách extensions giữa profiles
- **Bookmark Sync** - Sync bookmarks giữa profiles chọn lọc

---

## 📝 GHI CHÚ

### Độ khó:
- 🟢 **Dễ** = Vài giờ đến 1 ngày
- 🟡 **Trung bình (TB)** = 1-3 ngày
- 🔴 **Khó** = 1 tuần+

### Trạng thái:
- 📋 Backlog - Chưa bắt đầu
- 🔄 In Progress - Đang làm
- ✅ Done - Hoàn thành
- ❌ Cancelled - Hủy bỏ

---

## 🔄 CHANGELOG

| Ngày | Thay đổi |
|------|----------|
| 2026-01-23 | Khởi tạo backlog với 45+ tính năng từ brainstorm session |

