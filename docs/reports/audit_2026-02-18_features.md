# Audit Report — Quick Win Features
**Date:** 2026-02-18
**Auditor:** Khang (Antigravity Auditor)
**Scope:** Full Audit — 3 recently implemented features
**Status:** ✅ ALL ISSUES RESOLVED (commit 7643136)

## Summary
- 🔴 Critical Issues: 1
- 🟡 Warnings: 3
- 🟢 Suggestions: 3

---

## 🔴 Critical Issues (Phải sửa ngay!)

### 1. SOCKS4 + Auth = Silent Failure (Backend Bug)
**File:** `src-tauri/src/commands.rs` line 601
**Feature:** SOCKS4 Support (13.4)

**Triệu chứng:**
Khi user dùng proxy SOCKS4 CÓ username/password, hệ thống sẽ xử lý sai. Code hiện tại chỉ check `is_socks5 = proxy.starts_with("socks5://")`. Nếu proxy là `socks4://`, biến `is_socks5 = false`, và code chạy vào nhánh HTTP relay (`start_proxy_relay`).

**Nguy hiểm:**
HTTP relay sẽ gửi HTTP CONNECT + `Proxy-Authorization` header đến SOCKS4 server — **hai protocol hoàn toàn khác nhau**. Kết quả: kết nối sẽ thất bại âm thầm, user không hiểu vì sao proxy không hoạt động.

**Backend code (vấn đề):**
```rust
let is_socks5 = proxy.starts_with("socks5://");
// ...
let local_port = if is_socks5 {
    crate::proxy_relay::start_socks5_relay(...)?  // Only SOCKS5
} else {
    crate::proxy_relay::start_proxy_relay(...)?   // HTTP relay — WRONG for SOCKS4!
};
```

**Cách sửa (2 lựa chọn):**
- **Option A (Quick Fix):** Disable auth fields khi user chọn SOCKS4 (vì SOCKS4 protocol không support auth anyway). Thêm validation ở Angular side.
- **Option B (Full Fix):** Implement `start_socks4_relay` trong Rust, hoặc dùng `is_socks5` check để bao gồm cả SOCKS4 (vì SOCKS4 cũng dùng binary protocol, không phải HTTP).

**Khuyến nghị:** Option A — SOCKS4 spec không hỗ trợ authentication, nên disable auth input cho SOCKS4 là đúng behavior.

---

## 🟡 Warnings (Nên sửa)

### 2. GeoIP API dùng HTTP thay vì HTTPS
**File:** `src/app/services/geoip.service.ts` line 101
**Feature:** GeoIP Display (13.2)

**Triệu chứng:**
ip-api.com free tier chỉ hỗ trợ HTTP. Dữ liệu gửi đi (IP proxy) đi qua mạng không mã hóa.

**Mức độ:**
Vì đây là desktop app và data gửi chỉ là IP của proxy (không phải credential), rủi ro thấp. Tuy nhiên, nếu user dùng WiFi công cộng, attacker có thể thấy danh sách proxy IP.

**Cách sửa:**
- Dùng ip-api.com Pro (HTTPS) hoặc chuyển sang API khác hỗ trợ HTTPS miễn phí (ví dụ: `ipinfo.io`, `ipwhois.app/json/`).

---

### 3. Thiếu Rate Limiting cho GeoIP batch requests
**File:** `src/app/services/geoip.service.ts` line 86-96
**Feature:** GeoIP Display (13.2)

**Triệu chứng:**
`batchLookup` xử lý tối đa 5 request đồng thời, nhưng **không có delay giữa các batch**. ip-api.com giới hạn 45 request/phút. Nếu user có > 45 proxy IPs khác nhau, sẽ bị rate-limited (HTTP 429).

**Cách sửa:**
Thêm delay giữa các batch:
```typescript
for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(h => this.lookupAsync(h)));
    // Throttle: wait 1.5s between batches (45 req/min = ~1.3s/req)
    if (i + batchSize < unique.length) {
        await new Promise(r => setTimeout(r, 1500));
    }
}
```

---

### 4. Mass Proxy Apply button thiếu loading state
**File:** `src/app/views/pages/home/home.ts` line 1702
**Feature:** Mass Proxy Change (12.2)

**Triệu chứng:**
`bulkAssignProxy()` là async nhưng button không disable trong lúc xử lý. User có thể double-click → gọi hàm 2 lần → update lặp lại.

**Cách sửa:**
```typescript
protected readonly bulkProxyLoading = signal(false);

async bulkAssignProxy(): Promise<void> {
    if (this.bulkProxyLoading()) return; // Guard
    this.bulkProxyLoading.set(true);
    try {
        // ...existing logic...
    } finally {
        this.bulkProxyLoading.set(false);
    }
}
```
Và trong template: `[loading]="bulkProxyLoading()"`.

---

## 🟢 Suggestions (Tùy chọn)

### 5. Dead code: `lookup()` method không ai gọi
**File:** `src/app/services/geoip.service.ts` lines 38-46
**Feature:** GeoIP Display (13.2)

**Mô tả:** Method `lookup()` được define nhưng không được sử dụng bất kỳ đâu. Chỉ có `lookupAsync()` (qua `batchLookup`) được gọi. Code thừa nên xóa để giữ codebase sạch.

---

### 6. Flag emoji thiếu ARIA label
**File:** `src/app/views/pages/home/home.html` lines 199-200
**Feature:** GeoIP Display (13.2)

**Mô tả:** Flag emoji (`🇺🇸`) không có `aria-label`. Screen reader có thể đọc thành "regional indicator symbol letter U, regional indicator symbol letter S" thay vì "United States".

**Cách sửa:**
```html
<span [pTooltip]="geo.label" tooltipPosition="top"
      class="cursor-default" role="img" [attr.aria-label]="geo.label">{{ geo.flag }}</span>
```

---

### 7. GeoIP extractHost regex không handle auth-embedded URLs
**File:** `src/app/services/geoip.service.ts` line 128
**Feature:** GeoIP Display (13.2)

**Mô tả:** Regex `^(?:https?|socks[45]):\/\/([^:]+):\d+$` không match proxy URL dạng `socks5://user:pass@host:port`. Hiện tại không gây lỗi vì `formatProxyUrl` không embed auth vào URL. Nhưng nếu tương lai thay đổi logic lưu proxy, sẽ break.

**Cách sửa:**
```typescript
const match = proxyStr.match(/^(?:https?|socks[45]):\/\/(?:[^@]+@)?([^:]+):(\d+)$/);
```

---

## Tổng kết theo Feature

| Feature | 🔴 | 🟡 | 🟢 | Đánh giá |
|---------|-----|-----|-----|----------|
| SOCKS4 Support (13.4) | 1 | 0 | 0 | ⚠️ Cần sửa auth relay |
| Mass Proxy Change (12.2) | 0 | 1 | 0 | ✅ Tốt, cần thêm loading |
| GeoIP Display (13.2) | 0 | 2 | 3 | ✅ Tốt, vài điểm cải thiện |

---

## Next Steps
1. Sửa SOCKS4 auth issue (Critical)
2. Thêm loading state cho bulk proxy
3. Thêm inter-batch delay cho GeoIP
4. Xóa dead code và thêm ARIA labels
