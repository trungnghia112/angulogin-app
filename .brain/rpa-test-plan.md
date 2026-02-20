# 🧪 RPA Execution Engine — Test Plan

> **Version:** 2.0.0 | **Updated:** 2026-02-20
> **Tester:** Manual (Tauri desktop app required)

---

## Chuẩn bị

```bash
# Terminal 1: Firebase Emulator
firebase emulators:start --only auth,firestore

# Terminal 2: Tauri app
npm run tauri dev
```

**Yêu cầu:**
- Google Chrome đã cài tại `/Applications/Google Chrome.app`
- Có ít nhất 1 Chrome profile (tạo ở trang Home nếu chưa có)

---

## TC-01: Save template từ Marketplace

| # | Bước | Expected |
|---|------|----------|
| 1 | Login vào app | Dashboard hiện |
| 2 | Automation → Marketplace | 15 templates hiện |
| 3 | Click "Browse Goods on Etsy" | Detail dialog mở |
| 4 | Click Save/Add to Library | Toast "Saved" hiện |
| 5 | Vào tab Process | Template vừa save hiện trong danh sách |

**Result:** ☐ Pass ☐ Fail

---

## TC-02: Tạo RPA Task

| # | Bước | Expected |
|---|------|----------|
| 1 | Automation → Task | Trang "RPA Tasks" hiện, empty state |
| 2 | Click "Create Task" | Dialog "Create RPA Task" mở |
| 3 | Template dropdown → chọn "Browse Goods on Etsy" | Template selected |
| 4 | Profile dropdown → chọn 1 profile | Profile selected |
| 5 | Browser → giữ "Google Chrome" | Default OK |
| 6 | Click "Start Task" | Dialog đóng, task xuất hiện trong bảng |

**Result:** ☐ Pass ☐ Fail

---

## TC-03: Chạy RPA — Etsy Browse (Core Test)

| # | Bước | Expected |
|---|------|----------|
| 1 | Sau TC-02, task status = "running" | Progress bar bắt đầu chạy |
| 2 | Chrome mở | Cửa sổ Chrome mới với profile đã chọn |
| 3 | Step 1: Navigate | Chrome vào `https://www.etsy.com` |
| 4 | Step 2: Scroll | Trang scroll xuống 4 lần, mỗi lần cách nhau 2-4s |
| 5 | Step 3: Click sản phẩm | Click vào 1 listing card random |
| 6 | Step 4: Scroll chi tiết | Scroll trang sản phẩm 3 lần |
| 7 | Step 5: Quay lại | Navigate back hoặc click logo |
| 8 | Step 6: Scroll thêm | Scroll trang chính thêm |
| 9 | Task hoàn thành | Status → "completed", progress = 100% |

**Thời gian dự kiến:** 30-60 giây (bao gồm humanDelay giữa các bước)

**Result:** ☐ Pass ☐ Fail

---

## TC-04: View Task Logs

| # | Bước | Expected |
|---|------|----------|
| 1 | Ở task vừa chạy, click icon "View Logs" (📄) | Log dialog mở |
| 2 | Kiểm tra log entries | Có timestamp, step number, level (info/success/error) |
| 3 | Scroll log | Thấy log từ Step 1 → Step 6 + "Task completed" |
| 4 | Đóng dialog | Dialog đóng bình thường |

**Result:** ☐ Pass ☐ Fail

---

## TC-05: Cancel Task đang chạy

| # | Bước | Expected |
|---|------|----------|
| 1 | Tạo task mới (Etsy hoặc template khác) | Task bắt đầu chạy |
| 2 | Khi status = "running", click icon Cancel (⏹) | Status → "cancelled" |
| 3 | Chrome vẫn mở | Browser không tự đóng |
| 4 | View Logs | Log cuối = "Task cancelled by user" |

**Result:** ☐ Pass ☐ Fail

---

## TC-06: Filter tabs

| # | Bước | Expected |
|---|------|----------|
| 1 | Tab "All tasks" | Hiện tất cả tasks (completed + cancelled) |
| 2 | Tab "Active" | Chỉ hiện task đang running/paused (hoặc trống) |
| 3 | Tab "History" | Chỉ hiện completed/failed/cancelled |
| 4 | Search box gõ tên template | Danh sách filter đúng |

**Result:** ☐ Pass ☐ Fail

---

## TC-07: Remove Task

| # | Bước | Expected |
|---|------|----------|
| 1 | Với task đã completed/cancelled, click icon Remove (🗑) | Task biến mất khỏi danh sách |
| 2 | Refresh trang | Task không xuất hiện lại (in-memory, expected) |

**Result:** ☐ Pass ☐ Fail

---

## TC-08: Error Recovery

| # | Bước | Expected |
|---|------|----------|
| 1 | Chạy task với template có selector sai (vd: edit JSON tạm) | Step fail nhưng task tiếp tục |
| 2 | View Logs | Log hiện ERROR cho step bị fail, SUCCESS cho các step khác |
| 3 | Task vẫn completed | Status = "completed" (không crash) |

**Result:** ☐ Pass ☐ Fail

---

## Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| "Unsupported browser for RPA" | Browser không phải chrome/brave/edge | Chọn Google Chrome |
| "Chrome not found" | Chrome chưa cài hoặc path khác | Kiểm tra `/Applications/Google Chrome.app` |
| "Timeout waiting for CDP port (15s)" | Profile đang bị Chrome instance khác lock | Đóng hết Chrome rồi thử lại |
| Template dropdown trống | Chưa save template từ Marketplace | Làm TC-01 trước |
| Profile dropdown trống | Chưa có profile | Tạo/scan profile ở trang Home |
| Etsy selector click fail | Etsy thay đổi DOM structure | Cần update selector trong `templates.json` |

---

## Templates đã rewrite (v2.0.0)

| Template | Platform | Cần login? | Độ phức tạp |
|----------|----------|------------|-------------|
| Browse Goods on Etsy | Etsy | ❌ Không | ⭐ Thấp — test đầu tiên |
| YouTube Watch & Subscribe | YouTube | ✅ Có | ⭐⭐ Trung bình |
| TikTok Search & Comment Like | TikTok | ✅ Có | ⭐⭐ Trung bình |
| Shopee Browse Products | Shopee | ❌ Không | ⭐⭐ Trung bình |
| FB Add Suggested Friends | Facebook | ✅ Có | ⭐⭐⭐ Cao |

> **Gợi ý:** Test Etsy trước (không cần login), sau đó test Shopee, rồi mới test YouTube/TikTok/Facebook (cần profile đã login sẵn).
