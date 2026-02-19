# 💡 BRIEF: Automation System cho Chrome Profile Manager

**Ngày tạo:** 2026-02-19
**Dựa trên:** 181 Q&A AppSumo + Nghiên cứu AdsPower

---

## 1. VẤN ĐỀ CẦN GIẢI QUYẾT

Users anti-detect browser cần **tự động hóa hàng loạt** các thao tác lặp đi lặp lại:
- Mở 50 profiles → login FB → post ads → đóng
- Check đơn hàng trên 20 tài khoản Amazon mỗi ngày
- Gửi connection requests LinkedIn từ 10 accounts

**Pain point:** Hầu hết users là marketer/dropshipper — KHÔNG BIẾT CODE. Họ cần giải pháp **no-code**.

---

## 2. GIẢI PHÁP ĐỀ XUẤT (Lấy cảm hứng từ AdsPower)

Xây dựng **3 trụ cột** automation:

### Trụ cột 1: Local REST API
> Giống AdsPower: HTTP server tại `localhost:PORT`

Cho phép tools bên ngoài (Puppeteer, Make, Zapier, n8n) kết nối và điều khiển profiles.

### Trụ cột 2: No-Code RPA Builder (Visual)
> Giống AdsPower RPA: Kéo thả actions

Visual workflow builder cho users **không biết code**:
- Kéo thả các blocks: Click → Type → Wait → Scroll → Screenshot
- Pre-built templates cho Facebook, LinkedIn, Amazon
- Human-like behavior: Random delays, smooth scrolling

### Trụ cột 3: Multi-Window Synchronizer
> Giống AdsPower Synchronizer: Mirror actions

Thao tác trên 1 window → tự động lặp lại trên tất cả windows khác.

---

## 3. ĐỐI TƯỢNG SỬ DỤNG

- **Primary:** Agency/Freelancer chạy Facebook Ads multi-account (no-code)
- **Secondary:** Devs cần API để integrate với automation pipeline

---

## 4. NGHIÊN CỨU ĐỐI THỦ

### AdsPower (Benchmark):

| Feature | AdsPower | Chúng ta (hiện tại) |
|---------|----------|---------------------|
| Local API | ✅ Full CRUD + Browser control | ❌ Chưa có |
| RPA Builder | ✅ Visual, drag-and-drop | ❌ Chưa có |
| Synchronizer | ✅ Mirror actions | ❌ Chưa có |
| Templates | ✅ FB, YouTube, Discord | ❌ Chưa có |
| Scheduling | ✅ One-time, daily, weekly | ✅ Đã có (ScheduleService) |
| Human-like | ✅ Random delays, typing speed | ❌ Chưa có |

### Điểm khác biệt của mình:

| USP | Chi tiết |
|-----|---------|
| **Multi-browser** | Chrome, Brave, Edge, Arc, Camoufox — AdsPower chỉ SunBrowser |
| **Cross-platform** | Mac + Windows + Linux — AdsPower chủ yếu Windows |
| **No license lock** | Dùng bao nhiêu máy cũng được |
| **Proxy rotation có sẵn** | Auto rotation + health check |
| **Camoufox built-in** | Anti-detect engine riêng |

---

## 5. TÍNH NĂNG

### 🚀 MVP Phase 1 — Local REST API

> **Tại sao làm trước?** Vì đây là nền tảng cho RPA Builder (Phase 2) sử dụng.

- [ ] HTTP server built-in (Tauri sidecar hoặc Actix-web trong Rust)
- [ ] API Key authentication
- [ ] **Browser endpoints:**
  - `GET /api/v1/browser/open?profile_id=xxx` — Mở profile
  - `GET /api/v1/browser/close?profile_id=xxx` — Đóng profile
  - `GET /api/v1/browser/status?profile_id=xxx` — Check trạng thái
  - `GET /api/v1/browser/active` — Liệt kê profiles đang chạy
- [ ] **Profile endpoints:**
  - `POST /api/v1/profile/create` — Tạo profile mới
  - `POST /api/v1/profile/update` — Cập nhật profile
  - `GET /api/v1/profile/list` — Liệt kê tất cả profiles
  - `GET /api/v1/profile/detail?profile_id=xxx` — Chi tiết profile
  - `POST /api/v1/profile/delete` — Xóa profile
- [ ] **Proxy endpoints:**
  - `POST /api/v1/proxy/add` — Thêm proxy
  - `POST /api/v1/proxy/update` — Cập nhật proxy
  - `GET /api/v1/proxy/list` — Liệt kê proxies
  - `POST /api/v1/proxy/delete` — Xóa proxy
  - `GET /api/v1/proxy/check?proxy_id=xxx` — Health check
- [ ] **Group endpoints:**
  - `POST /api/v1/group/create` — Tạo folder/group
  - `GET /api/v1/group/list` — Liệt kê groups
- [ ] Response format chuẩn: `{ code: 0, msg: "success", data: {...} }`
- [ ] API docs page trong app (Swagger-like)
- [ ] CDP endpoint trả về: `ws://127.0.0.1:{port}` cho Puppeteer/Playwright

### 🚀 MVP Phase 2 — No-Code RPA Builder

- [ ] Visual workflow builder (drag-and-drop UI)
- [ ] **Action blocks:**
  - `Access URL` — Mở URL
  - `Click Element` — Click vào element (CSS selector / XPath)
  - `Type Text` — Nhập text vào input
  - `Wait` — Chờ (fixed / random / until element appears)
  - `Scroll` — Cuộn trang
  - `Hover` — Di chuột
  - `Screenshot` — Chụp màn hình
  - `New Tab / Close Tab` — Quản lý tabs
  - `Execute JavaScript` — Chạy JS tùy chỉnh
  - `If/Else` — Rẽ nhánh logic
  - `Loop` — Lặp lại N lần
  - `Wait for element` — Chờ element xuất hiện
- [ ] **Human-like settings:**
  - Random delay giữa các actions (min-max ms)
  - Typing speed simulation (chars/second + random variance)
  - Smooth scrolling thay vì jump
  - Mouse movement simulation (bezier curve)
- [ ] Save/Load workflows
- [ ] Pre-built templates: Facebook Login, LinkedIn Connect, Amazon Check Orders
- [ ] Run workflow trên 1 hoặc nhiều profiles
- [ ] Execution log (realtime hiển thị step đang chạy)

### 🎁 Phase 3 — Multi-Window Synchronizer

- [ ] Chọn "main window" — các window khác mirror
- [ ] Sync actions: click, type, scroll, hover
- [ ] Click delay + Typing delay settings (human-like)
- [ ] Tile windows (sắp xếp cửa sổ cạnh nhau)
- [ ] Text input modes: Identical / Designated (mỗi window text khác nhau)
- [ ] Toggle sync on/off per action type

### 💭 Backlog:

- [ ] Cloud workflow sharing (chia sẻ templates)
- [ ] Marketplace templates (cộng đồng đóng góp)
- [ ] AI-powered element selector (tự tìm element)
- [ ] Record & Replay (ghi lại thao tác → tạo workflow)
- [ ] Webhook integrations (notify khi workflow hoàn thành)
- [ ] Google Sheets integration (đọc/ghi data từ sheets)
- [ ] CAPTCHA solving integration (2Captcha, AntiCaptcha)

---

## 6. ƯỚC TÍNH SƠ BỘ

| Phase | Effort | Mô tả |
|-------|--------|-------|
| **Phase 1: Local API** | 🟡 2-3 tuần | HTTP server + endpoints + auth + docs |
| **Phase 2: RPA Builder** | 🔴 4-6 tuần | Visual builder + action engine + templates |
| **Phase 3: Synchronizer** | 🟡 2-3 tuần | Window management + action mirroring |

### Rủi ro:
- **RPA Builder phức tạp:** Visual drag-and-drop UI tốn effort nhiều
- **CDP management:** Quản lý nhiều debugging ports cùng lúc
- **Human-like accuracy:** Simulation phải đủ tốt để không bị detect

---

## 7. BƯỚC TIẾP THEO

```
/plan Phase 1 (Local REST API)
  → /design (API schema, Rust HTTP server)
  → /code (implement)
  → /test (API testing)
```
