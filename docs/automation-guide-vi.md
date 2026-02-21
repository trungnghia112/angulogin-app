# AnguLogin — Hướng Dẫn Tính Năng Automation (RPA)

> Tài liệu chi tiết dành cho đội ngũ Marketing & Founder  
> Cập nhật: Tháng 02/2026

---

## Mục lục

1. [So sánh với đối thủ](#1-so-sánh-với-đối-thủ)
2. [Tổng quan tính năng](#2-tổng-quan-tính-năng)
3. [Flow sử dụng chi tiết](#3-flow-sử-dụng-chi-tiết)
4. [Chọn Profile & Chạy Template](#4-chọn-profile--chạy-template)
5. [Chạy nhiều profile cùng lúc](#5-chạy-nhiều-profile-cùng-lúc)
6. [Chạy nhiều luồng trên 1 profile](#6-chạy-nhiều-luồng-trên-1-profile)
7. [Hệ thống chống phát hiện Bot](#7-hệ-thống-chống-phát-hiện-bot)
8. [Danh sách Templates có sẵn](#8-danh-sách-templates-có-sẵn)
9. [REST API cho Developer/Tích hợp](#9-rest-api-cho-developertích-hợp)
10. [Câu hỏi thường gặp](#10-câu-hỏi-thường-gặp)

---

## 1. So sánh với đối thủ

| Tính năng | **AnguLogin** | GoLogin | Multilogin | AdsPower |
|-----------|:------------:|:-------:|:----------:|:--------:|
| Quản lý multi-profile Chrome | ✅ | ✅ | ✅ | ✅ |
| Anti-fingerprint (Canvas, WebGL, Navigator) | ✅ | ✅ | ✅ | ✅ |
| **RPA Automation tích hợp** | ✅ | ❌ | ❌ | ✅ (hạn chế) |
| **Marketplace Templates sẵn** | ✅ 15+ | ❌ | ❌ | ✅ (ít) |
| **REST API** (headless, không cần mở UI) | ✅ | ❌ | ✅ (riêng) | ❌ |
| **Chống phát hiện bot 6 lớp** | ✅ | ❌ | ❌ | ❌ |
| Tự tạo template | ✅ | ❌ | ❌ | ✅ |
| Chi phí | Miễn phí | $49/tháng | $99/tháng | $9/tháng |
| Chạy song song nhiều profile | ✅ | ✅ | ✅ | ✅ |
| Chạy không cần màn hình (API) | ✅ | ❌ | ❌ | ❌ |

### Điểm khác biệt chính:

1. **AnguLogin = Profile Manager + RPA Engine + Marketplace** — tất cả trong 1 app. Đối thủ cần cài thêm tool RPA riêng (iMacros, Selenium, v.v.)
2. **REST API** cho phép tích hợp vào hệ thống có sẵn (CRM, dashboard, scheduler) — không cần mở app
3. **6 lớp chống bot** tích hợp sẵn — đối thủ chỉ có anti-fingerprint, không có human-like behavior

---

## 2. Tổng quan tính năng

### Automation hoạt động như thế nào?

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   1. Marketplace │────▶│   2. Chọn Profile │────▶│   3. Chạy Auto   │
│   Chọn template  │     │   Gán profile     │     │   Theo dõi tiến  │
│   (browse/save)  │     │   cho template    │     │   độ realtime    │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Các thành phần trong app:

| Tab | Chức năng | Mô tả |
|-----|-----------|-------|
| **Marketplace** | Kho template | Duyệt, xem chi tiết, lưu template về |
| **Process** | Template đã lưu | Danh sách template đã save, sẵn sàng chạy |
| **Task** | Theo dõi tiến độ | Monitor realtime, xem log từng bước |
| **My Templates** | Template tự tạo | Tạo kịch bản automation riêng |
| **Template Editor** | Soạn kịch bản | Visual editor kéo thả các bước |

---

## 3. Flow sử dụng chi tiết

### Bước 1: Mở app AnguLogin & tạo Profile

Nếu chưa có profile:

1. Mở app **AnguLogin**
2. Click **"+ New Profile"** ở góc trên phải
3. Đặt tên (VD: "TikTok - Account 1")
4. (Tuỳ chọn) Cài proxy, chọn OS fingerprint
5. Click **"Create"**

> **🎯 Profile là gì?**  
> Profile = 1 trình duyệt Chrome riêng biệt, với cookies, lịch sử, fingerprint hoàn toàn tách biệt. Giống như bạn có nhiều máy tính khác nhau.

### Bước 2: Đăng nhập tài khoản trên Profile

Hầu hết template cần bạn đã đăng nhập sẵn trên platform tương ứng:

1. Trong trang **Profiles**, click **"Open"** để mở trình duyệt của profile
2. Truy cập website (VD: facebook.com, tiktok.com)
3. **Đăng nhập thủ công** bằng email/password
4. Đóng trình duyệt khi xong

> ⚠️ **Quan trọng**: Bạn chỉ cần đăng nhập **1 lần**. Cookies sẽ được lưu tự động trong profile. Lần sau mở lại không cần đăng nhập lại.

### Bước 3: Vào Marketplace & Chọn Template

1. Click vào tab **"Automation"** trên sidebar
2. Chọn sub-tab **"Marketplace"**
3. Duyệt qua 15+ template sẵn có
4. Click vào template muốn dùng → xem chi tiết (mô tả, số bước, platform)
5. Click **"Save"** để lưu template vào Process

### Bước 4: Chạy Template

1. Chuyển sang tab **"Process"**
2. Tìm template vừa lưu
3. Click nút **▶ Play** cạnh template
4. **Chọn profile** muốn chạy (dropdown danh sách profile)
5. (Tuỳ chọn) Điền biến (variables): keyword tìm kiếm, URL, v.v.
6. Click **"Run"**

### Bước 5: Theo dõi tiến độ

1. Chuyển sang tab **"Task"**
2. Xem realtime:
   - ✅ Bước nào đã hoàn thành
   - 🔄 Bước đang chạy
   - ❌ Lỗi (nếu có)
   - 📝 Log chi tiết từng hành động
3. Có thể **Cancel** để dừng giữa chừng

---

## 4. Chọn Profile & Chạy Template

### Qua giao diện (UI):

```
Profiles → Mở browser → Đăng nhập platform → Đóng browser
  ↓
Marketplace → Chọn template → Save
  ↓
Process → Chọn template → Click Play → Chọn profile → Run
  ↓
Task → Theo dõi tiến độ realtime
```

### Qua REST API (cho developer):

```bash
# 1. Lấy danh sách profile
curl -H "X-API-Key: YOUR_API_KEY" http://localhost:50200/api/v1/profile/list

# 2. Mở browser cho profile cụ thể
curl -H "X-API-Key: YOUR_API_KEY" \
  "http://localhost:50200/api/v1/browser/open?profile_id=TenProfile"

# 3. Chạy template
curl -X POST -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "profile_name": "TenProfile",
    "template_id": "etsy-browse-goods",
    "variables": {
      "keyword": "handmade jewelry"
    }
  }' \
  http://localhost:50200/api/v1/automation/execute

# 4. Theo dõi tiến độ
curl -H "X-API-Key: YOUR_API_KEY" \
  "http://localhost:50200/api/v1/automation/task?task_id=task_abc123"
```

### API Key lấy ở đâu?

API Key được tạo tự động khi cài app, lưu tại:
```
~/Library/Application Support/AnguLogin/api_config.json
```

Mở file này sẽ thấy:
```json
{
  "api_key": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

---

## 5. Chạy nhiều profile cùng lúc (Multi-Profile Parallel)

### Tình huống:

> "Tôi có 10 tài khoản Facebook, muốn auto like bài viết trên cả 10 tài khoản cùng lúc"

### Cách thực hiện:

**Cách 1: Qua UI** (thủ công, từng cái)
1. Chạy template trên Profile 1 → Tab Task hiện task 1
2. Quay lại Process → Chạy template trên Profile 2 → Task hiện thêm task 2
3. Lặp lại cho các profile còn lại
4. Tất cả task chạy **song song**, theo dõi trên tab Task

**Cách 2: Qua Script/API** (tự động, khuyến nghị)

```javascript
// Chạy 10 profile cùng lúc
const profiles = [
  'FB-Account-01', 'FB-Account-02', 'FB-Account-03',
  'FB-Account-04', 'FB-Account-05', 'FB-Account-06',
  'FB-Account-07', 'FB-Account-08', 'FB-Account-09',
  'FB-Account-10',
];

// Mở tất cả browser
for (const profile of profiles) {
  await api('GET', `/api/v1/browser/open?profile_id=${profile}`);
  await sleep(2000); // Đợi 2s giữa mỗi browser
}

// Chạy template trên tất cả (song song)
const tasks = await Promise.all(
  profiles.map(profile =>
    api('POST', '/api/v1/automation/execute', {
      profile_name: profile,
      template_id: 'x-like-ai-comment',
      variables: { keyword: 'AI technology', max_posts: 5 }
    })
  )
);

// Tất cả 10 task chạy đồng thời, mỗi cái trên 1 browser riêng
console.log(`${tasks.length} tasks đang chạy song song!`);
```

### Giới hạn:

| Yếu tố | Khuyến nghị | Tối đa |
|---------|------------|--------|
| Profile chạy song song | 5-10 | Tuỳ RAM (mỗi Chrome ~200MB) |
| Delay giữa các lần mở | 2-5 giây | Tránh mở quá nhanh |
| RAM cần thiết | 8GB cho 5 profile | 16GB cho 10+ profile |

---

## 6. Chạy nhiều luồng trên 1 Profile (Multi-Task per Profile)

### ⚠️ KHÔNG KHUYẾN NGHỊ — Đây là lý do:

Mỗi profile = 1 browser Chrome. Mỗi browser chỉ có 1 tab đang active tại 1 thời điểm. Nếu chạy 2 template trên cùng 1 profile:

```
Profile "FB-01"
  ├── Task 1: Like bài viết (đang scroll Facebook)
  └── Task 2: Comment AI (cũng cần scroll Facebook)
      → XUNG ĐỘT! 2 task giành nhau điều khiển cùng 1 tab
```

### Giải pháp đúng:

| Muốn làm gì | Cách đúng |
|-------------|-----------|
| Like + Comment trên cùng 1 account | Tạo 1 template chứa CẢ 2 hành động |
| Like trên 10 account cùng lúc | Tạo 10 profile → chạy song song |
| Like xong rồi Comment | Chạy template 1 → đợi xong → chạy template 2 |

### Quy tắc vàng:

> **1 Profile = 1 Task tại 1 thời điểm**  
> Muốn chạy song song → Tạo nhiều profile → Mỗi profile chạy 1 task

---

## 7. Hệ thống chống phát hiện Bot

AnguLogin có **6 lớp chống phát hiện**, chia làm 2 nhóm:

### Nhóm 1: Anti-Fingerprint (Stealth Extension)

Chạy tự động khi mở browser, giấu thông tin "máy thật":

| Lớp | Chức năng | Hiệu quả |
|-----|-----------|-----------|
| Canvas Spoofing | Thay đổi "vân tay" đồ hoạ | Mỗi profile có fingerprint riêng |
| WebGL Spoofing | Giả thông tin card đồ hoạ | Tránh tracking qua GPU |
| Navigator Spoofing | Giả RAM, CPU, ngôn ngữ, OS | Mỗi profile "giống" 1 máy khác |
| Screen Spoofing | Giả kích thước màn hình | Không bị gom nhóm theo resolution |
| WebRTC Prevention | Chặn lộ IP thật qua WebRTC | Bảo vệ khi dùng proxy |
| Webdriver Flag | Ẩn flag `navigator.webdriver` | Tránh phát hiện CDP/Puppeteer |

### Nhóm 2: Human-like Behavior (RPA Engine)

Mô phỏng hành vi người thật khi tự động hoá:

| Lớp | Bot thông thường | AnguLogin |
|-----|-----------------|-----------|
| **Gõ phím** | Set value 1 lần | Gõ từng phím, 90ms/phím, 5% gõ sai + xoá |
| **Click chuột** | `element.click()` JS | Di chuột → hover → click, random offset |
| **Di chuột** | Không có | 1-3 micro movements trước mỗi click |
| **Scroll** | Fixed 80% viewport | Random 50-110%, 15% scroll ngược |
| **Thời gian** | Random đều [min, max] | Gaussian distribution (tự nhiên) |
| **JS Patches** | Không có | Fake `document.hasFocus()`, fuzz timing |

### Kết quả: Website thấy gì?

- **Không có AnguLogin**: "Đây là bot/Selenium/Puppeteer" → BAN
- **Có AnguLogin**: "Đây là 1 người dùng Chrome bình thường trên máy Windows, đang duyệt web tự nhiên" → OK

---

## 8. Danh sách Templates có sẵn

### Social Media — Engagement

| # | Template | Platform | Steps | Mô tả |
|---|---------|----------|:-----:|-------|
| 1 | TikTok Search & Like Comment | TikTok | 6 | Tìm video → like comments → tăng tương tác |
| 2 | X (Twitter) Like & AI Comment | Twitter/X | 6 | Like bài → AI tự tạo comment thông minh |
| 3 | Instagram Auto Follow | Instagram | 5 | Follow tự động từ hashtag → tăng follower |
| 4 | YouTube Watch & Subscribe | YouTube | 8 | Xem video → subscribe → tăng kênh YouTube |
| 5 | Reddit Upvote & Comment | Reddit | 5 | Upvote + comment trên subreddit |

### Social Media — Quản lý

| # | Template | Platform | Steps | Mô tả |
|---|---------|----------|:-----:|-------|
| 6 | FB Group Search & Join | Facebook | 4 | Tìm nhóm → Join tự động |
| 7 | FB Group Exit | Facebook | 4 | Rời nhóm hàng loạt |
| 8 | FB Add Suggested Friends | Facebook | 5 | Kết bạn từ gợi ý tự động |
| 9 | FB Friends Counter | Facebook | 4 | Đếm & export danh sách bạn bè |

### E-Commerce

| # | Template | Platform | Steps | Mô tả |
|---|---------|----------|:-----:|-------|
| 10 | Etsy Browse Goods | Etsy | 6 | Duyệt sản phẩm → xem chi tiết → reviews |
| 11 | Shopee Browse Products | Shopee | 7 | Tìm kiếm → scroll → xem sản phẩm |
| 12 | Amazon Review Scraper | Amazon | 5 | Đọc reviews → paginate → extract data |
| 13 | Poshmark Auto Share | Poshmark | 5 | Share listings tự động |

### Networking & Communication

| # | Template | Platform | Steps | Mô tả |
|---|---------|----------|:-----:|-------|
| 14 | LinkedIn Auto Connect | LinkedIn | 5 | Tìm người → gửi kết nối + note |
| 15 | Gmail Bulk Sender | Gmail | 5 | Gửi email hàng loạt |

---

## 9. REST API cho Developer/Tích hợp

### Tổng quan endpoints:

| Nhóm | Method | Endpoint | Chức năng |
|-------|--------|----------|-----------|
| **Profile** | GET | `/api/v1/profile/list` | Danh sách profile |
| | GET | `/api/v1/profile/detail?profile_id=X` | Chi tiết 1 profile |
| | POST | `/api/v1/profile/create` | Tạo profile mới |
| | POST | `/api/v1/profile/update` | Cập nhật profile |
| | POST | `/api/v1/profile/delete` | Xoá profile |
| **Browser** | GET | `/api/v1/browser/open?profile_id=X` | Mở trình duyệt |
| | GET | `/api/v1/browser/close?profile_id=X` | Đóng trình duyệt |
| | GET | `/api/v1/browser/status?profile_id=X` | Trạng thái browser |
| | GET | `/api/v1/browser/active` | Danh sách browser đang mở |
| | GET | `/api/v1/browser/cdp?profile_id=X` | Lấy CDP WebSocket URL |
| **Automation** | POST | `/api/v1/automation/execute` | Chạy template |
| | GET | `/api/v1/automation/tasks` | Danh sách tasks |
| | GET | `/api/v1/automation/task?task_id=X` | Chi tiết task + logs |
| | POST | `/api/v1/automation/cancel` | Huỷ task |

### Ví dụ tích hợp thực tế:

**Scenario**: Scheduler chạy TikTok engagement mỗi sáng 8h

```javascript
// cron-job.js (chạy mỗi ngày 8:00 AM)
const PROFILES = ['TikTok-01', 'TikTok-02', 'TikTok-03'];
const KEYWORDS = ['AI technology', 'cooking tips', 'travel vlog'];

for (let i = 0; i < PROFILES.length; i++) {
  // Mở browser
  await fetch('http://localhost:50200/api/v1/browser/open' +
    '?profile_id=' + PROFILES[i], {
    headers: { 'X-API-Key': API_KEY }
  });

  // Chạy template
  await fetch('http://localhost:50200/api/v1/automation/execute', {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      profile_name: PROFILES[i],
      template_id: 'tiktok-search-like',
      variables: { keyword: KEYWORDS[i], max_videos: 10 }
    })
  });

  // Đợi 5s giữa các profile
  await new Promise(r => setTimeout(r, 5000));
}
```

---

## 10. Câu hỏi thường gặp

### Q: Template có chạy được khi chưa đăng nhập không?

**A**: Tuỳ template.
- **Etsy Browse, Amazon Review, Shopee Browse**: ✅ Không cần đăng nhập — chỉ browse/xem
- **Facebook, TikTok, Instagram, LinkedIn, Gmail**: ❌ Cần đăng nhập trước trên profile

### Q: Chạy automation có bị ban tài khoản không?

**A**: AnguLogin có 6 lớp chống phát hiện, nhưng KHÔNG thể đảm bảo 100%. Khuyến nghị:
- Không chạy quá 50 lượt/ngày trên 1 tài khoản
- Dùng proxy riêng cho mỗi profile
- Để `humanDelay` cao (3-8 giây giữa các bước)
- Tham khảo giới hạn rate limit của từng platform

### Q: Tôi có thể tạo template riêng không?

**A**: Có! Dùng tab **My Templates** → **"+ New Template"**. Mỗi template gồm:
- Tên, mô tả, platform
- Danh sách các bước (navigate, click, type, scroll, wait, evaluate)
- Biến (variables) để tuỳ chỉnh khi chạy

### Q: App phải mở liên tục không?

**A**: Có, app AnguLogin phải chạy trong background. API server chạy trên port 50200 — chỉ hoạt động khi app đang mở.

### Q: Có chạy trên VPS/server được không?

**A**: Hiện tại AnguLogin là ứng dụng Desktop (macOS). Để chạy trên server, cần có môi trường desktop (GUI). Có thể dùng VNC/remote desktop trên VPS có GUI.

### Q: Multi-profile chạy song song cần bao nhiêu RAM?

**A**: Mỗi Chrome profile ngốn ~150-300MB RAM. Khuyến nghị:
- 5 profile song song → 8GB RAM
- 10 profile song song → 16GB RAM
- 20+ profile → 32GB RAM + SSD

---

> **Tài liệu này được viết cho đội Marketing & Founder của AnguLogin.**  
> Nội dung kỹ thuật đã được đơn giản hoá để dễ hiểu.  
> Để xem API docs chi tiết hơn, truy cập: `http://localhost:50200/api/docs`
