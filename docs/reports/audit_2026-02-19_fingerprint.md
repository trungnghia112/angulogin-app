# Audit Report — Fingerprint Feature
**Date:** 2026-02-19 | **Auditor:** Khang (Antigravity Code Auditor)  
**Scope:** Fingerprint preview/checker + Stealth extension (~1,274 lines across 14 files)

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 3 |
| 🟡 Warning | 3 |
| 🟢 Suggestion | 4 |

> [!CAUTION]
> Antidetect code is ONLY valuable if it's INVISIBLE. 3 critical issues make this detectable by services like CreepJS and PixelScan.

---

## 🔴 Critical Issues

### 1. Config Exposed in MAIN World — Race Condition
**File:** `content.js:21-28` + `commands.rs:640-660`  
**Nguy hiểm:** Trang web có thể đọc `window.__stealth_config__` trước khi content.js xóa nó. Config chứa toàn bộ thông tin giả lập (seed, WebGL, navigator...). Detection service phát hiện = biết chắc user dùng antidetect.

**Chi tiết kỹ thuật:**  
`config_inject.js` gán `window.__stealth_config__` trong MAIN world → trang web có thể dùng `Object.defineProperty` trap hoặc inline script đọc trước. Dù `delete window.__stealth_config__` ở line 348, window of exposure vẫn tồn tại.

**Cách sửa:** Nhúng config trực tiếp vào `content.js` thay vì file riêng. Tauri đã copy extension per-profile — chỉ cần find/replace placeholder trong content.js. Hoàn toàn loại bỏ `config_inject.js`.

---

### 2. Canvas Noise Modifies Original Canvas — Double-Read Detection
**File:** `content.js:104-118`  
**Nguy hiểm:** `toDataURL()` override THAY ĐỔI pixels thật trên canvas trước khi trả kết quả. Trang web gọi `toDataURL()` 2 lần → kết quả khác nhau → phát hiện antiledetect.

**Chi tiết kỹ thuật:**  
```
// Call 1: canvas pixels → apply noise → return (canvas is now noisy)
// Call 2: noisy canvas → apply MORE noise → return (different result!)
```
Tương tự cho `toBlob()`. `getImageData()` thì OK vì chỉ noise bản copy.

**Cách sửa:** Clone canvas vào temp canvas → apply noise trên clone → trả kết quả từ clone. Canvas gốc giữ nguyên.

---

### 3. Fingerprint Không Persistent Per Profile — Thay Đổi Mỗi Lần Launch
**File:** `commands.rs:603` + `generator.rs:200-223`  
**Nguy hiểm:** `generate(None)` dùng `SystemTime::now().subsec_nanos()` làm entropy → MỖI LẦN launch ra fingerprint MỚI. Detection service kiểm tra fingerprint stability → thay đổi mỗi lần = bị flag ngay.

**Chi tiết kỹ thuật:**
- `prepare_stealth_extension()` gọi `generate(None)` không truyền seed
- `random_range()` dùng nanoseconds, không reproducible
- Cache bị xóa trước mỗi launch (`remove_dir_all`)

**Cách sửa:** Thêm `generate_seeded(seed: u64)` sử dụng seeded PRNG. Seed từ profile path hash (đã có ở line 604). Chỉ regenerate khi user bấm "Randomize".

---

## 🟡 Warnings

### 4. RTCPeerConnection `prototype.constructor` Mismatch
**File:** `content.js:260-272`  
**Chi tiết:** `WrappedRTC.prototype = OriginalRTC.prototype` → `RTCPeerConnection.prototype.constructor !== RTCPeerConnection` (should be true in real browser). Detection vector.

**Cách sửa:** `WrappedRTC.prototype.constructor = WrappedRTC;` — nhưng cẩn thận vì prototype is shared.

---

### 5. `navigator.languages` Returns Same Reference
**File:** `content.js:197`  
**Chi tiết:** `navigator.languages === navigator.languages` trả `true` (vì cùng frozen object). Trong Chrome thật, trả `false` (mỗi lần trả array mới).

**Cách sửa:** Getter trả `Object.freeze([...languages])` mỗi lần gọi.

---

### 6. Empty `chrome.runtime = {}` Is Detectable
**File:** `content.js:336-338`  
**Chi tiết:** Object rỗng thiếu `connect`, `sendMessage`, `id`… Detection service kiểm tra → phát hiện giả.

**Cách sửa:** Không gán `{}`. Nếu `chrome.runtime` đã tồn tại (extension context) thì để yên. Nếu không tồn tại thì cũng để yên.

---

## 🟢 Suggestions

### 7. Silent Error Handling in Fingerprint Checker
**File:** `fingerprint-checker.ts:69-70, 88-89`  
**Chi tiết:** `catch {}` nuốt lỗi — user bấm "Generate" hoặc "Launch" mà không biết tại sao thất bại.

**Cách sửa:** Hiển thị toast message khi có lỗi.

---

### 8. Temp Profile Directory Never Cleaned Up
**File:** `fingerprint-checker.ts:81`  
**Chi tiết:** `fingerprint-checker-profile` tạo mỗi lần "Launch" nhưng không bao giờ xóa. Tích lũy cache data.

**Cách sửa:** Thêm cleanup khi component destroy hoặc khi launch mới.

---

### 9. Permissions API Spoof Too Narrow
**File:** `content.js:312`  
**Chi tiết:** Chỉ spoof `notifications` → `denied`. Các permission khác (`camera`, `microphone`...) không spoof → inconsistency là detection signal.

**Cách sửa:** Mở rộng danh sách hoặc bỏ spoof permissions hoàn toàn.

---

### 10. More `eprintln!` Debug Logs in Production
**File:** `commands.rs:674, 678, 684`  
**Chi tiết:** 3 `eprintln!` trong `prepare_stealth_extension` và launch flow.

**Cách sửa:** Thay bằng `log::info!` / `log::debug!`.

---

## Next Steps

```
📋 Anh muốn làm gì tiếp theo?

1️⃣ Xem báo cáo chi tiết trước
2️⃣ Sửa lỗi Critical ngay (dùng /code)
3️⃣ Dọn dẹp code smell (dùng /refactor)
4️⃣ Bỏ qua, lưu báo cáo vào /save-brain
5️⃣ 🔧 FIX ALL - Tự động sửa TẤT CẢ lỗi có thể sửa

Gõ số (1-5) để chọn:
```
