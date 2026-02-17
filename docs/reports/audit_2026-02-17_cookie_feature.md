# Audit Report — Cookie Import/Export Feature
**Date:** 2026-02-17 | **Scope:** Feature-focused (cookie import/export only) | **Auditor:** Khang

## Summary
- 🔴 Critical Issues: 3
- 🟡 Warnings: 4
- 🟢 Suggestions: 3

---

## 🔴 Critical Issues (Phải sửa ngay)

### 1. Tauri Commands Block Main Thread (UI Freeze)
- **File:** [commands.rs](file:///Volumes/DataMac/dev/chrome-profile-manager/src-tauri/src/commands.rs#L1478-L1487)
- **Vấn đề:** `export_profile_cookies` và `import_profile_cookies` là **sync** functions, nhưng chúng thực hiện SQLite I/O + crypto operations (PBKDF2 1003 iterations + AES decryption). Trên profile có nhiều cookies (10k+), điều này sẽ **đóng băng UI** vì Tauri chạy sync commands trên main thread.
- **Hậu quả:** App bị "Not Responding" khi export/import profiles lớn.
- **Cách sửa:**
```diff
-#[tauri::command]
-pub fn export_profile_cookies(...)
+#[tauri::command(async)]
+pub async fn export_profile_cookies(...)
```
Thêm `async` cho cả 2 commands để Tauri tự spawn thread riêng.

### 2. Import Cookie Không Giới Hạn Kích Thước JSON
- **File:** [cookies.rs:247](file:///Volumes/DataMac/dev/chrome-profile-manager/src-tauri/src/cookies.rs#L247)
- **Vấn đề:** `import_cookies()` nhận `cookies_json: String` không giới hạn kích thước. User có thể paste một file JSON 500MB → OOM crash.
- **Hậu quả:** App crash do out-of-memory khi import file quá lớn.
- **Cách sửa:** Thêm check kích thước trước khi parse:
```rust
const MAX_COOKIE_JSON_SIZE: usize = 10 * 1024 * 1024; // 10MB
if cookies_json.len() > MAX_COOKIE_JSON_SIZE {
    return Err(format!("Cookie JSON too large: {} bytes (max {})", cookies_json.len(), MAX_COOKIE_JSON_SIZE));
}
```

### 3. SameSite Mapping Không Nhất Quán (Export ≠ Import)
- **File Export:** [cookies.rs:218-223](file:///Volumes/DataMac/dev/chrome-profile-manager/src-tauri/src/cookies.rs#L218-L223)
- **File Import:** [cookies.rs:322-327](file:///Volumes/DataMac/dev/chrome-profile-manager/src-tauri/src/cookies.rs#L322-L327)
- **Vấn đề:** Export maps `samesite = 0` → `"unspecified"`, nhưng Import không handle `"unspecified"` → defaults to `-1` (no_restriction). Export → Import round-trip sẽ **thay đổi sameSite behavior** của cookies.
- **Hậu quả:** Cookies bị đổi sameSite policy sau round-trip export→import, có thể gây lỗi authentication.
- **Cách sửa:**
```rust
// Import: thêm "unspecified" vào match
let samesite = match cookie.same_site.as_deref() {
    Some("strict") => 2,
    Some("lax") => 1,
    Some("unspecified") => 0,          // <-- THÊM
    Some("no_restriction") | Some("none") => -1,
    _ => -1,
};
```

---

## 🟡 Warnings (Nên sửa)

### 4. `eprintln!` Debug Logging trong Production Code
- **File:** [cookies.rs:369](file:///Volumes/DataMac/dev/chrome-profile-manager/src-tauri/src/cookies.rs#L369)
- **Vấn đề:** `eprintln!("[CookieImport] Imported {} cookies...")` — debug logging bị hard-code. Không nên dùng trực tiếp `eprintln`, nên dùng `log::info!` hoặc `tracing::info!` để có log levels.
- **Cách sửa:** Đổi thành `log::info!` hoặc xóa nếu không cần.

### 5. Double Path Validation (Overhead nhỏ, logic thừa)
- **File:** [cookies.rs:144](file:///Volumes/DataMac/dev/chrome-profile-manager/src-tauri/src/cookies.rs#L144) và [cookies.rs:248](file:///Volumes/DataMac/dev/chrome-profile-manager/src-tauri/src/cookies.rs#L248)
- **Vấn đề:** `validate_path_safety()` đã được gọi trong `export_cookies()` và `import_cookies()`, nhưng các Tauri commands trong `commands.rs` cũng gọi trực tiếp các functions này (không validate thêm). Tuy không lỗi, nhưng pattern này tạo coupling giữa `cookies.rs` và `commands.rs`. Nên validate ở MỘT chỗ (commands layer - entry point).
- **Cách sửa:** Move validation to commands layer only, hoặc document rõ policy.

### 6. Frontend: `cookieExportLoading` Signal Là Global State
- **File:** [home.ts:333](file:///Volumes/DataMac/dev/chrome-profile-manager/src/app/views/pages/home/home.ts#L333)
- **Vấn đề:** `cookieExportLoading` là single signal cho TẤT CẢ profiles. Nếu user click Export trên profile A, loading spinner sẽ hiện trên ALL export buttons. Cần per-profile loading state, hoặc disable toàn bộ khi đang export.
- **Cách sửa:** Đổi sang `cookieExportingProfilePath = signal<string | null>(null)` rồi check `[loading]="cookieExportingProfilePath() === profile.path"`.

### 7. File Import Không Check File Size Trước Khi Đọc
- **File:** [home.ts:1319-1320](file:///Volumes/DataMac/dev/chrome-profile-manager/src/app/views/pages/home/home.ts#L1319-L1320)
- **Vấn đề:** `readTextFile(filePath)` đọc toàn bộ file vào memory mà không check size. Nếu user chọn nhầm file 1GB → browser tab crash.
- **Cách sửa:** Check file size trước khi đọc:
```typescript
const { stat } = await import('@tauri-apps/plugin-fs');
const fileInfo = await stat(filePath as string);
if (fileInfo.size > 10 * 1024 * 1024) {
    this.messageService.add({ severity: 'error', summary: 'File Too Large', detail: 'Max 10MB' });
    return;
}
```

---

## 🟢 Suggestions (Tùy chọn)

### 8. Export Nên Có Confirmation Dialog
- **Vấn đề:** Export trực tiếp gọi backend + save dialog mà không hỏi user trước. Nên có confirm vì: (a) export đọc sensitive data (cookies chứa session tokens), (b) consistency với UX pattern khác trong app.
- **Cách sửa:** Thêm `confirmationService.confirm()` wrapper.

### 9. `samesite = -1` Khi Fallback Có Thể Gây Nhầm
- **File:** [cookies.rs:325-326](file:///Volumes/DataMac/dev/chrome-profile-manager/src-tauri/src/cookies.rs#L325-L326)
- **Vấn đề:** Chrome dùng `-1` cho "unset" và `0` cho "unspecified". Nhưng code hiện tại fallback mọi unknown value thành `-1`, có thể không đúng ý nghĩa cho một số extensions export `"none"` (nên map sang `-1` là đúng rồi, nhưng nên log warning).

### 10. Có thể Tách CookieService Riêng
- **Vấn đề:** Cookie logic hiện nằm trong `ProfileService`. Khi feature grow (filter by domain, search cookies, edit single cookie...), sẽ nên tách ra `CookieService` riêng.
- **Khi nào:** Khi thêm cookie browser/editor features trong tương lai.

---

## Next Steps
```
📋 Có 3 lỗi Critical cần sửa ngay, 4 Warning nên sửa.

1️⃣ Xem báo cáo chi tiết trước
2️⃣ Sửa lỗi Critical ngay (3 lỗi)
3️⃣ Sửa cả Critical + Warning (7 lỗi)
4️⃣ Bỏ qua, lưu báo cáo
5️⃣ 🔧 FIX ALL - Tự động sửa TẤT CẢ lỗi có thể sửa

Gõ số (1-5) để chọn:
```
