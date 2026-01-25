# Plan: Sprint 5 - Storage & Analytics
Created: 2026-01-25 11:54
Status: 🟡 In Progress

## Overview
Thêm tính năng phân tích dung lượng và thống kê sử dụng cho Chrome Profile Manager. Giúp users quản lý disk space hiệu quả và hiểu usage patterns của họ.

## Tech Stack
- Frontend: Angular 20+, PrimeNG, Chart.js
- Backend: Rust (Tauri commands)
- Storage: Local filesystem analysis

## Features in this Sprint

### 1. Storage Dashboard
- Biểu đồ dung lượng từng profile (pie/bar chart)
- Tổng dung lượng tất cả profiles
- Profile lớn nhất, nhỏ nhất
- Trend theo thời gian (nếu có history)

### 2. Cleanup Suggestions
- Gợi ý xóa profiles không dùng lâu (>30 ngày)
- Gợi ý xóa cache/temp files
- Preview dung lượng sẽ giải phóng

### 3. Usage Statistics
- Số lần mở mỗi profile (launch count)
- Tổng thời gian sử dụng
- Profile hay dùng nhất
- Usage heatmap theo ngày/tuần

### 4. Export Reports
- Export usage data ra CSV
- Export storage report ra CSV/PDF

## Phases

| Phase | Name | Status | Description |
|-------|------|--------|-------------|
| 01 | Storage Dashboard UI | ⬜ Pending | Tạo page + charts |
| 02 | Usage Statistics | ⬜ Pending | Track & display usage |
| 03 | Cleanup Suggestions | ⬜ Pending | Analyze & recommend |
| 04 | Export Reports | ⬜ Pending | CSV/PDF export |

## Estimated Effort
- Total: 4-6 coding sessions
- Phase 01: 1-2 sessions
- Phase 02: 1 session
- Phase 03: 1-2 sessions
- Phase 04: 1 session

## Quick Commands
- Start Phase 1: `/code phase-01`
- Check progress: `/next`

## Dependencies
- Profile size data (already available from scan)
- Metadata with lastOpened (already exists)
- Activity Log (already exists - can leverage)
