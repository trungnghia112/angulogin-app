# Audit Report - 2026-01-24: Dark/Light Mode Standards

## Summary
- 🔴 Critical Issues: 2
- 🟡 Warnings: 3
- 🟢 Suggestions: 2

## 🔴 Critical Issues (Phải sửa ngay)
1. **Hardcoded Dark Backgrounds in Home View**
   - File: `src/app/views/pages/home/home.html`
   - Nguy hiểm: Nhiều phần tử như Dropdown, Profile Card, và Dialog Input đang fix cứng màu `bg-surface-900` hoặc `bg-surface-950` mà không có prefix `dark:`. Khi người dùng chuyển sang Light Mode, các phần này vẫn sẽ có màu tối thui, gây lỗi hiển thị và không thể đọc được text.
   - Cách sửa: Thêm prefix `dark:` cho các class background tối và bổ sung background sáng (ví dụ: `dark:bg-surface-900`).

2. **Inconsistent Main Container Backgrounds**
   - File: `src/app/views/pages/pages.html`, `src/app/views/components/sidebar/sidebar.html`, `src/app/views/components/main-nav/main-nav.html`
   - Nguy hiểm: Mỗi component đang dùng một cấp độ background khác nhau (50, 100, 950) mà không theo quy tắc phân lớp (Layering). Sidebar đang dùng `bg-surface-100` trong khi Home dùng `bg-surface-50`, tạo ra cảm giác app bị ghép nối rời rạc.
   - Cách sửa: Thống nhất hệ thống phân lớp (xem phần Suggestions).

## 🟡 Warnings (Nên sửa)
1. **Text Color Inconsistency**
   - Nhiều chỗ dùng `text-surface-0` (Trắng) trực tiếp mà không có `dark:` prefix. Trong Light Mode, text này sẽ biến mất trên nền trắng.
2. **Border Color Logic**
   - Các border đang dùng hỗn hợp `border-surface-200`, `border-surface-300` và `border-surface-700` một cách ngẫu hứng, không phân biệt rõ ràng giữa Light và Dark mode.
3. **Empty State & Loading UI**
   - Phần loading và empty state trong `home.html` cũng đang fix cứng màu text/icon sáng, sẽ bị chìm nghỉm khi ở Light Mode.

## 🟢 Suggestions (Tùy chọn)
1. **Standardized Surface Pattern (Đề xuất)**
   - **Main App Background**: `bg-surface-50 dark:bg-surface-950`
   - **Sidebar/Nav Background**: `dark:bg-surface-900`
   - **Card/Popups**: `dark:bg-surface-800`
   - **Borders**: `border-surface-200 dark:border-surface-800`
   - **Text**: `text-surface-700 dark:text-surface-200` (Secondary) và `text-surface-900 dark:text-surface-0` (Primary).

2. **Tailwind v4 Utility Aliases**
   - Nên tạo các utility components hoặc sử dụng CSS variables chung để quản lý theme thay vì viết lặp lại class `dark:` quá nhiều lần.

## Next Steps
1. Thực hiện refactor lại `home.html` để gỡ bỏ các hardcoded dark classes.
2. Cập nhật `main-nav.html` để hỗ trợ Light Mode hoàn chỉnh.
3. Thống nhất lại border-style toàn app.
