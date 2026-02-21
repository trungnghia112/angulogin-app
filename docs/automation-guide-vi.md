# AnguLogin — Hướng Dẫn Tính Năng Automation (RPA)

> Tài liệu dành cho đội Marketing & Founder  
> Cập nhật: 21/02/2026  
> ⚠️ Nội dung đã verify 100% với source code thực tế

---

## 1. Automation — Tổng quan

AnguLogin tích hợp sẵn **RPA Engine** (Robotic Process Automation) cho phép tự động hoá thao tác trên trình duyệt: click, gõ chữ, scroll, navigate — tất cả chạy trên Chrome profile riêng biệt, giống như người thật đang dùng.

### Có 2 cách sử dụng:

| Cách | Dành cho | Mô tả |
|------|---------|-------|
| **Qua UI (giao diện app)** | User thông thường | Dùng các tab trong app để chọn template, chọn profile, bấm Start |
| **Qua REST API** | Developer / Tích hợp | Gọi HTTP request từ script hoặc hệ thống bên ngoài, không cần mở UI |

---

## 2. Các tab trong module Automation

Module Automation gồm 4 tab chính trên sidebar:

| Tab | Chức năng thực tế |
|-----|-------------------|
| **Marketplace** | Duyệt kho template → xem chi tiết → lưu về (nút "Save process") |
| **Process** | Hiện danh sách template đã lưu. Bấm ▶ Play → chuyển sang tab Task với dialog Create Task đã chọn sẵn template |
| **Task** | **Đây là nơi chạy automation thật.** Bấm "Create Task" → chọn template + profile + browser → Start Task. Theo dõi realtime, xem logs, cancel task |
| **My Templates** | Template do user tự tạo (chưa có template editor hoàn chỉnh) |

---

## 3. Flow sử dụng — Từng bước chính xác

### Bước 1: Tạo Chrome Profile (nếu chưa có)

1. Mở app **AnguLogin**
2. Ở tab **Profiles** (sidebar), click **"+ New Profile"**
3. Đặt tên profile (VD: "FB Account 1")
4. Click **Create**

> **Profile là gì?** Mỗi profile = 1 trình duyệt Chrome riêng biệt, có cookies, fingerprint, lịch sử hoàn toàn tách biệt. Giống như chạy trên nhiều máy tính khác nhau.

### Bước 2: Đăng nhập platform trên Profile

Template social media (Facebook, TikTok, Instagram...) yêu cầu bạn **đã đăng nhập sẵn** trên profile:

1. Ở tab **Profiles**, click **"Open"** trên profile vừa tạo → Chrome mở ra
2. Vào website muốn automation (VD: facebook.com)
3. **Đăng nhập thủ công** bằng email/password
4. Đóng Chrome khi xong

> Cookies được lưu tự động trong profile. Lần sau không cần đăng nhập lại.

### Bước 3: Lưu template từ Marketplace

1. Click **Automation** trên sidebar
2. Vào tab **Marketplace**
3. Duyệt danh sách template (có thể lọc theo platform, search, sort)
4. **Click vào 1 template** → Dialog chi tiết hiện ra:
   - Mô tả template
   - Danh sách các bước sẽ thực hiện
   - Biến (variables) cần truyền vào
   - Yêu cầu (login hay không)
5. Click **"Save process"** → Template được lưu vào tab Process

### Bước 4: Tạo Task và chạy ← ĐÂY LÀ BƯỚC CHẠY THẬT

1. Chuyển sang tab **Task**
2. Click nút **"Create Task"** (góc trên phải)
3. Dialog hiện ra với 3 dropdown:

| Field | Mô tả |
|-------|-------|
| **Template** | Chọn 1 template đã save từ Marketplace |
| **Profile** | Chọn Chrome profile muốn chạy automation |
| **Browser** | Chọn trình duyệt: Chrome / Brave / Edge |

4. Click **"Start Task"**
5. Dialog đóng → Task xuất hiện trong bảng

### Bước 5: Theo dõi Task

Tab **Task** hiện bảng realtime:

| Cột | Hiển thị |
|-----|---------|
| Template | Tên template đang chạy |
| Profile | Profile nào đang dùng |
| Status | `running` / `completed` / `failed` / `cancelled` |
| Progress | Thanh tiến độ + "Step 2/6" |
| Started | Thời gian bắt đầu |
| Actions | ■ Cancel (nếu đang chạy), 📄 View Logs, 🗑 Remove |

Click **"View Logs"** để xem chi tiết từng bước automation đang làm gì.

---

## 4. Tóm tắt flow (sơ đồ)

```
Profiles → Tạo profile → Mở browser → Đăng nhập platform → Đóng browser
                                              ↓
                              Marketplace → Duyệt → Click template
                                              ↓
                              Dialog chi tiết → Click "Save process"
                                              ↓
                              Task → Click "Create Task"
                                              ↓
                              Dialog: Chọn Template + Profile + Browser
                                              ↓
                              Click "Start Task" → Automation chạy
                                              ↓
                              Bảng Task → Theo dõi realtime + View Logs
```

---

## 5. Chạy nhiều profile cùng lúc

### Qua UI:

1. Tab **Task** → "Create Task" → chọn Template A + Profile 1 → Start
2. Quay lại → "Create Task" → chọn Template A + Profile 2 → Start
3. Lặp lại cho các profile khác
4. Tất cả task chạy **song song**, mỗi task trên 1 Chrome riêng

### Qua REST API (khuyến nghị cho 5+ profile):

```javascript
const profiles = ['FB-01', 'FB-02', 'FB-03', 'FB-04', 'FB-05'];

for (const profile of profiles) {
  // Mở browser cho profile
  await fetch(`http://localhost:50200/api/v1/browser/open?profile_id=${profile}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  await sleep(3000);

  // Chạy template
  await fetch('http://localhost:50200/api/v1/automation/execute', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile_name: profile,
      template_id: 'tiktok-search-like',
      variables: { keyword: 'AI technology' }
    })
  });
}
// → 5 task chạy đồng thời, mỗi cái trên 1 browser riêng
```

### Giới hạn phần cứng:

| Profile song song | RAM cần | Ghi chú |
|-------------------|---------|---------|
| 3-5 | 8 GB | Đủ cho hầu hết máy |
| 5-10 | 16 GB | Khuyến nghị SSD |
| 10+ | 32 GB | Nên dùng VPS/server |

---

## 6. Chạy nhiều luồng trên 1 profile

### ⚠️ KHÔNG THỂ — và đây là lý do:

Mỗi profile = 1 trình duyệt Chrome = 1 tab active. Nếu chạy 2 task cùng lúc trên 1 profile, cả 2 sẽ giành nhau điều khiển cùng 1 tab → xung đột.

### Quy tắc:

> **1 Profile = tối đa 1 Task tại 1 thời điểm**

### Giải pháp:

| Muốn | Cách làm đúng |
|------|--------------|
| Nhiều hành động trên cùng 1 account | Tạo 1 template kết hợp (Like + Comment trong 1 template) |
| Chạy song song | Tạo nhiều profile, mỗi profile chạy 1 task |
| Chạy tuần tự | Chờ task 1 xong → chạy task 2 trên cùng profile |

---

## 7. Hệ thống chống phát hiện Bot — Kết quả kiểm chứng thực tế

> Đã test trên 4 trang bot detection ngày 21/02/2026. Kết quả bên dưới.

### Kết quả kiểm tra trên các trang detection

| Trang test | Kết quả | Chi tiết |
|-----------|---------|----------|
| **bot.sannysoft.com** | 26/31 PASS | WebDriver ẩn ✅, Selenium ẩn ✅, **Canvas bị phát hiện** ❌ |
| **browserleaks.com/webrtc** | ✅ PASS | "No Leak", Local IP ẩn, chỉ hiện Public IP |
| **creepjs** | ⚠️ Partial | 0% headless ✅, 0% stealth ✅, nhưng 31% "like headless" |
| **pixelscan.net** | ✅ ALL GREEN | Fingerprint "is consistent", "No masking detected", "No automated behavior" |

### Trạng thái từng lớp (đã verify)

| Lớp | Hoạt động? | Bằng chứng |
|-----|:----------:|------------|
| WebDriver ẩn | ✅ | Sannysoft: `missing (passed)` |
| Navigator spoofing | ✅ | Plugins=5, userAgent đúng, languages đúng |
| WebRTC prevention | ✅ | BrowserLeaks: "No Leak", Local IP = `-` |
| WebGL spoofing | ✅ | Hiện đúng `Apple M4` — consistent với máy thật |
| Canvas spoofing | ⚠️ Một phần | Pixelscan: no masking ✅. Sannysoft: phát hiện cross-context hash ❌ |
| Anti-detection JS | ⚠️ Một phần | CreepJS: 0% stealth ✅ nhưng 31% like headless (có thể do CDP) |

### Nhóm 1: Anti-Fingerprint (tự động khi mở browser)

| Lớp | Mô tả |
|-----|-------|
| Canvas Spoofing | Thêm noise vào canvas pixel — qua được Pixelscan nhưng Sannysoft phát hiện hash trùng giữa contexts |
| WebGL Spoofing | Giả vendor/renderer GPU |
| Navigator Spoofing | Giả RAM, CPU, ngôn ngữ, OS, userAgent |
| Screen Spoofing | Giả kích thước màn hình |
| WebRTC Prevention | Chặn lộ IP thật — đã verify trên BrowserLeaks |
| Webdriver Flag | Ẩn `navigator.webdriver` — đã verify trên Sannysoft |

### Nhóm 2: Human-like Behavior (khi chạy automation)

| Hành vi | Bot thông thường | AnguLogin |
|---------|-----------------|-----------|
| Gõ phím | `el.value='...'` (instant) | Từng phím 90ms/key, 5% gõ sai + xoá |
| Click | `el.click()` JS | Di chuột → hover → mouseDown → delay → mouseUp |
| Di chuột | Không có | 1-3 micro movements trước mỗi click |
| Scroll | Luôn 80% viewport | Random 50-110%, 15% scroll ngược |
| Thời gian | Random đều [min, max] | Gaussian (tập trung quanh trung bình, tự nhiên hơn) |

### ⚠️ Hạn chế đã biết

- **Canvas spoofing**: Qua được Pixelscan nhưng Sannysoft phát hiện. Cần cải thiện randomize per-context
- **CDP artifacts**: CreepJS phát hiện 31% "like headless" — có thể do Chrome DevTools Protocol connection còn lộ dấu vết

---

## 8. Danh sách 15 Templates hiện có

### Social Media — Engagement

| Template | Platform | Steps | Cần login |
|---------|----------|:-----:|:---------:|
| TikTok Search & Like Comment | TikTok | 6 | ✅ |
| X Like & AI Comment | Twitter/X | 6 | ✅ |
| Instagram Auto Follow | Instagram | 5 | ✅ |
| YouTube Watch & Subscribe | YouTube | 8 | ✅ |
| Reddit Upvote & Comment | Reddit | 5 | ✅ |

### Social Media — Quản lý

| Template | Platform | Steps | Cần login |
|---------|----------|:-----:|:---------:|
| FB Group Search & Join | Facebook | 4 | ✅ |
| FB Group Exit | Facebook | 4 | ✅ |
| FB Add Suggested Friends | Facebook | 5 | ✅ |
| FB Friends Counter | Facebook | 4 | ✅ |

### E-Commerce

| Template | Platform | Steps | Cần login |
|---------|----------|:-----:|:---------:|
| Etsy Browse Goods | Etsy | 6 | ❌ |
| Shopee Browse Products | Shopee | 7 | ❌ |
| Amazon Review Scraper | Amazon | 5 | ❌ |
| Poshmark Auto Share | Poshmark | 5 | ✅ |

### Networking & Communication

| Template | Platform | Steps | Cần login |
|---------|----------|:-----:|:---------:|
| LinkedIn Auto Connect | LinkedIn | 5 | ✅ |
| Gmail Bulk Sender | Gmail | 5 | ✅ |

---

## 9. REST API (cho Developer)

API server chạy tự động tại `http://localhost:50200` khi mở app.

### Endpoints:

| Method | Endpoint | Chức năng |
|--------|----------|-----------|
| GET | `/api/v1/profile/list` | Danh sách profile |
| GET | `/api/v1/browser/open?profile_id=X` | Mở browser |
| GET | `/api/v1/browser/close?profile_id=X` | Đóng browser |
| GET | `/api/v1/browser/status?profile_id=X` | Trạng thái browser |
| POST | `/api/v1/automation/execute` | Chạy template |
| GET | `/api/v1/automation/tasks` | Danh sách task |
| GET | `/api/v1/automation/task?task_id=X` | Chi tiết task + logs |
| POST | `/api/v1/automation/cancel` | Huỷ task đang chạy |

### API Key:

Lưu tại `~/Library/Application Support/AnguLogin/api_config.json`. Truyền qua header `Authorization: Bearer <API_KEY>`.

---

## 10. So sánh với đối thủ

| Tính năng | AnguLogin | GoLogin | Multilogin | AdsPower |
|-----------|:---------:|:-------:|:----------:|:--------:|
| Multi-profile Chrome | ✅ | ✅ | ✅ | ✅ |
| Anti-fingerprint | ✅ | ✅ | ✅ | ✅ |
| RPA Automation tích hợp | ✅ | ❌ | ❌ | ✅ (hạn chế) |
| Marketplace templates | ✅ (15+) | ❌ | ❌ | ✅ (ít) |
| REST API headless | ✅ | ❌ | ✅ (riêng) | ❌ |
| Human-like behavior (6 lớp) | ✅ | ❌ | ❌ | ❌ |
| Chi phí | Miễn phí | $49/tháng | $99/tháng | $9/tháng |

---

## 11. Hạn chế hiện tại (trung thực)

| Hạn chế | Mô tả |
|---------|-------|
| Nút "Save and create task" ở Marketplace | Hiện chỉ save, chưa tự navigate sang Create Task |
| Template Editor | Chưa hoàn thiện — tạo template phức tạp cần hiểu JSON |
| Chỉ macOS | App desktop chỉ chạy trên macOS |
| Cần app mở | API server chỉ hoạt động khi app AnguLogin đang mở |

---

## 12. FAQ

**Q: Template chạy được khi chưa đăng nhập không?**  
A: Etsy, Shopee, Amazon → được (chỉ browse/xem). Facebook, TikTok, Instagram, LinkedIn, Gmail → cần đăng nhập trước.

**Q: Chạy automation có bị ban không?**  
A: Có 6 lớp chống phát hiện nhưng không đảm bảo 100%. Nên giới hạn ~50 lượt/ngày/account, dùng proxy riêng mỗi profile.

**Q: App phải mở liên tục không?**  
A: Có. API server chạy trên port 50200, chỉ hoạt động khi app đang mở.
