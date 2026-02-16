# Audit Report — Privacy Mode Feature
> Date: 2026-02-17 | Scope: Feature-focused (7 files changed) | Auditor: Khang

## Summary
- 🔴 Critical Issues: **0**
- 🟡 Warnings: **2**
- 🟢 Suggestions: **3**

---

## 🟡 Warnings (Nên sửa)

### W1. Duplicate Flags Risk — Custom Flags + Privacy Mode
**File:** [commands.rs](file:///Volumes/DataMac/dev/chrome-profile-manager/src-tauri/src/commands.rs#L609-L648)

**Triệu chứng:** Nếu user bật Privacy Mode **đồng thời** nhập thủ công flag giống nhau trong Custom Flags (ví dụ `--disable-sync`), Chrome sẽ nhận duplicate args. Không crash, nhưng Chrome có thể log warning và nó cho thấy thiếu dedup logic.

**Hậu quả:** Không gây lỗi trực tiếp, nhưng Chrome stderr sẽ có duplicate warning, gây noise khi debug.

**Cách sửa:**
```rust
// After building privacy flags + custom flags, dedup:
args.sort();
args.dedup();
```
Hoặc dùng `HashSet` trước khi convert sang `Vec`. Lưu ý giữ thứ tự nếu cần (`--user-data-dir` phải đi trước).

---

### W2. UI Flags List Mismatch — 8 items vs 10 flags
**File:** [profile-edit-dialog.html](file:///Volumes/DataMac/dev/chrome-profile-manager/src/app/views/pages/home/profile-edit-dialog/profile-edit-dialog.html#L300-L312)

**Triệu chứng:** Rust backend inject **10 flags**, nhưng UI chỉ liệt kê **8 mục** (gộp "metrics & sync" thành 1, thiếu `--disable-webrtc-event-logging`). User có thể thắc mắc khi check `chrome://version` thấy nhiều flags hơn UI hiển thị.

**Hậu quả:** Gây nhầm lẫn cho power user verify flags qua `chrome://version`.

**Cách sửa:** Đồng bộ UI list với Rust flags, hoặc thêm note "(10 flags total)" để user biết rõ.

---

## 🟢 Suggestions (Tùy chọn)

### S1. Accessibility — Label thiếu `for` attribute
**File:** [profile-edit-dialog.html:293](file:///Volumes/DataMac/dev/chrome-profile-manager/src/app/views/pages/home/profile-edit-dialog/profile-edit-dialog.html#L293)

**Triệu chứng:** `<label>` "Privacy Mode" không có `for="home-edit-dialog-privacy-toggle"`. Screen reader không liên kết label với toggle switch.

**Cách sửa:**
```html
<label for="home-edit-dialog-privacy-toggle" class="block text-xs font-medium text-color">Privacy Mode</label>
```

> [!NOTE]
> Đây là pattern tương tự đã tồn tại ở các toggle khác trong cùng file (Disable Extensions cũng thiếu `for`). Nên sửa đồng loạt tất cả toggles.

---

### S2. Logging — Không có log khi Privacy Mode active
**File:** [commands.rs:609-626](file:///Volumes/DataMac/dev/chrome-profile-manager/src-tauri/src/commands.rs#L609-L626)

**Triệu chứng:** Proxy relay có `eprintln!` rất rõ ràng, nhưng Privacy Mode inject flags "lặng lẽ" — không có log nào để debug.

**Cách sửa:**
```rust
if antidetect_enabled.unwrap_or(false) {
    eprintln!("[Antidetect] Privacy Mode active — injecting {} flags", privacy_flags.len());
    // ... existing code
}
```

---

### S3. `antidetectEnabled` nên nằm trong `LaunchBrowserOptions` thay vì extend type
**File:** [profile.service.ts:226](file:///Volumes/DataMac/dev/chrome-profile-manager/src/app/services/profile.service.ts#L226)

**Triệu chứng:** `antidetectEnabled` đã có trong `LaunchBrowserOptions` interface, nhưng `launchBrowser` method vẫn khai báo thêm `& { antidetectEnabled?: boolean }` — redundant.

**Cách sửa:**
```typescript
// Chỉ cần:
async launchBrowser(options: LaunchBrowserOptions & { disableExtensions?: boolean }): Promise<void> {
// antidetectEnabled đã có trong LaunchBrowserOptions rồi
```

---

## Security Deep Dive

| Check | Result | Notes |
|-------|--------|-------|
| Can user inject dangerous flags via Privacy Mode? | ✅ Safe | Flags hardcoded in Rust, not from user input |
| Can `antidetect_enabled` bypass other security checks? | ✅ Safe | Privacy flags appended BEFORE custom flag sanitization |
| Can metadata file be tampered to enable antidetect? | ⚠️ N/A | Same risk as all metadata fields — local file, local trust model |
| Does Privacy Mode interfere with proxy relay? | ✅ Safe | Proxy args set before privacy flags, no conflict |
| Are privacy flags safe for all supported browsers? | ✅ Safe | All flags are Chromium-standard, supported by Chrome/Brave/Edge |

---

## Code Quality Summary

| Metric | Status |
|--------|--------|
| Naming consistency (camelCase ↔ snake_case) | ✅ Correct serde rename |
| Pattern consistency with `disableExtensions` | ✅ Exact same pattern |
| Build passes (Angular + Rust) | ✅ Zero errors |
| Dead code introduced | ✅ None |
| Missing error handling | ✅ None (bool field, no failure mode) |

---

## Next Steps

📋 Anh muốn làm gì tiếp theo?

1️⃣ Xem báo cáo chi tiết trước
2️⃣ Sửa lỗi Warning ngay (dùng /code)
3️⃣ Bỏ qua, lưu báo cáo
4️⃣ 🔧 FIX ALL - Tự động sửa TẤT CẢ lỗi có thể sửa

Gõ số (1-4) để chọn.
