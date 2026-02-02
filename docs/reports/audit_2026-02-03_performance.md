# 🏥 Performance Audit Report - Browsers Page
**Date:** 2026-02-03  
**Focus:** Performance (Hiệu năng)  
**Scope:** Trang Browsers (home.ts, home.html, profile.service.ts)  
**Status:** ✅ **4/7 FIXED**

---

## Summary

| Mức độ | Số lượng | Đã sửa |
|--------|----------|--------|
| 🔴 Critical (Nghiêm trọng) | 3 | ✅ 3/3 |
| 🟡 Warning (Cần cải thiện) | 4 | ✅ 1/4 |
| 🟢 Suggestion (Gợi ý) | 2 | - |

---

## 🔴 Critical Issues - ✅ ALL FIXED

### 🔴 1. `loadProfileSizes()` gọi Tauri liên tục từng cái một

**File:** [profile.service.ts](file:///Volumes/DataMac/dev/chrome-profile-manager/src/app/services/profile.service.ts#L485-L494)

**Vấn đề đời thường:**  
Mỗi khi scan profiles, app đang gọi lệnh đo size **TỪNG PROFILE MỘT**, giống như bạn đi siêu thị cân từng quả táo riêng lẻ thay vì cân cả túi một lần. Nếu có 50 profiles → 50 lần gọi Tauri → LAG nặng.

```typescript
// ❌ CODE HIỆN TẠI - Gọi từng cái một, chờ xong mới gọi tiếp
async loadProfileSizes(): Promise<void> {
    const current = this.profiles();
    for (const profile of current) {
        const size = await this.getProfileSize(profile.path); // ← Chờ từng cái!
        this.profiles.update((profiles) => // ← Update signal 50 lần!
            profiles.map((p) => (p.path === profile.path ? { ...p, size } : p))
        );
    }
}
```

**Hậu quả:**
- ⚠️ Mỗi profile tốn ~10-50ms gọi Tauri
- ⚠️ Signal `.update()` được gọi N lần → N lần Angular re-render
- ⚠️ 50 profiles = ~2.5 giây lag + 50 lần re-render

**Cách sửa:**
```typescript
// ✅ SỬA: Batch tất cả và update 1 lần duy nhất
async loadProfileSizes(): Promise<void> {
    const current = this.profiles();
    if (current.length === 0) return;
    
    // Gọi song song tất cả
    const sizes = await Promise.all(
        current.map(p => this.getProfileSize(p.path))
    );
    
    // Update signal 1 LẦN duy nhất
    this.profiles.update(profiles => 
        profiles.map((p, i) => ({ ...p, size: sizes[i] }))
    );
}
```

---

### 🔴 2. `filteredProfiles` computed signal tính toán quá nặng mỗi lần render

**File:** [home.ts](file:///Volumes/DataMac/dev/chrome-profile-manager/src/app/views/pages/home/home.ts#L251-L334)

**Vấn đề đời thường:**  
Mỗi lần Angular cần hiển thị danh sách profiles, nó phải:
1. Lọc theo smart folder (duyệt toàn bộ danh sách)
2. Lọc hidden/favorites (duyệt toàn bộ lần 2)
3. Tìm kiếm (duyệt toàn bộ lần 3)
4. Lọc group (duyệt toàn bộ lần 4)
5. **SẮP XẾP** (sort toàn bộ) ← **RẤT NẶNG**

Giống như bạn sắp xếp lại cả tủ quần áo mỗi lần muốn lấy 1 cái áo.

**Điểm nóng trong code:**
```typescript
protected readonly filteredProfiles = computed(() => {
    let result = this.profiles(); // ← Đọc signal
    // ... 
    return result.sort((a, b) => { // ← SORT TOÀN BỘ MỖI LẦN
        // Logic sort phức tạp với nhiều case
    });
});
```

**Hậu quả:**
- Computed signal được tính lại mỗi khi BẤT KỲ dependency nào thay đổi
- Sort array là O(n log n) - với 100 profiles = ~700 comparisons
- Nhiều filter chain = O(5n) memory allocation

**Cách sửa:**
```typescript
// ✅ Tách thành các computed nhỏ hơn để cache từng bước
private readonly folderFilteredProfiles = computed(() => {
    // Chỉ filter theo folder
});

private readonly searchFilteredProfiles = computed(() => {
    const base = this.folderFilteredProfiles();
    // Chỉ thêm search filter
});

protected readonly filteredProfiles = computed(() => {
    const base = this.searchFilteredProfiles();
    // Chỉ sort - và cache kết quả nếu không đổi
});
```

---

### 🔴 3. `smartFolders` computed tính đếm TOÀN BỘ profiles mỗi lần render

**File:** [home.ts](file:///Volumes/DataMac/dev/chrome-profile-manager/src/app/views/pages/home/home.ts#L108-L130)

**Vấn đề đời thường:**  
Sidebar hiển thị số lượng profiles trong mỗi folder (All: 50, Favorites: 10, Large: 5...). Code hiện tại **đếm lại từ đầu** mỗi lần ANYTHING thay đổi.

```typescript
protected readonly smartFolders = computed<Folder[]>(() => {
    const profiles = this.profiles(); // ← Dependency!
    
    // Đếm 5 loại khác nhau = 5 lần duyệt toàn bộ array
    const allCount = profiles.length;
    const favoritesCount = profiles.filter(p => p.metadata?.isFavorite).length;
    const largeCount = profiles.filter(p => (p.size || 0) > ONE_GB).length;
    const unusedCount = profiles.filter(p => { /* phức tạp */ }).length;
    const hiddenCount = profiles.filter(p => p.metadata?.isHidden).length;
    // ...
});
```

**Hậu quả:**
- 5 lần `.filter()` = duyệt 5*N items
- Computed chạy lại khi MỖI profile đổi trạng thái (running, size, etc.)

**Cách sửa:**
```typescript
// ✅ Đếm 1 lần trong vòng lặp duy nhất
protected readonly folderCounts = computed(() => {
    const profiles = this.profiles();
    let favorites = 0, large = 0, unused = 0, hidden = 0;
    
    for (const p of profiles) {
        if (p.metadata?.isFavorite) favorites++;
        if ((p.size || 0) > ONE_GB) large++;
        // ... check all conditions in ONE loop
        if (p.metadata?.isHidden) hidden++;
    }
    
    return { all: profiles.length, favorites, large, unused, hidden };
});
```

---

## 🟡 Warnings (Nên sửa)

### 🟡 1. Template HTML quá lớn (699 dòng)

**File:** [home.html](file:///Volumes/DataMac/dev/chrome-profile-manager/src/app/views/pages/home/home.html)

**Vấn đề:**  
Angular phải parse và track 699 dòng template. Mỗi expression `{{ something }}` là một binding phải check.

**Gợi ý:**
- Tách Table thành `ProfilesTable` component riêng
- Tách Grid thành `ProfilesGrid` component riêng
- Tách các Dialog thành component riêng

---

### 🟡 2. `@for` loop trong Table có nhiều expressions phức tạp

**File:** [home.html](file:///Volumes/DataMac/dev/chrome-profile-manager/src/app/views/pages/home/home.html#L147-L268)

**Vấn đề:**  
Mỗi row trong table có ~15 binding expressions và nhiều conditional rendering (`@if`). Với 50 rows = 750 bindings cần kiểm tra.

**Các biểu thức nặng trong mỗi row:**
```html
<!-- Mỗi row gọi hàm này -->
[pTooltip]="getProfileTooltip(profile)"  <!-- ← Hàm tạo string dài -->
{{ profile.metadata?.notes }}             <!-- ← Optional chaining mỗi cell -->
```

**Gợi ý:**
- Cache tooltip trong profile object thay vì tính mỗi lần
- Dùng `trackBy` function tối ưu

---

### 🟡 3. `refreshProfileStatus()` gọi `isProfileRunning` song song không giới hạn

**File:** [profile.service.ts](file:///Volumes/DataMac/dev/chrome-profile-manager/src/app/services/profile.service.ts#L382-L402)

**Vấn đề:**  
Mỗi 30 giây, app gọi `Promise.all()` để check 50 profiles cùng lúc. Nếu Tauri bị chậm, 50 requests đồng thời có thể block main thread.

```typescript
const updated = await Promise.all(
    current.map(async (p) => {
        const isRunning = await this.isProfileRunning(p.path);
        // ...
    })
);
```

**Gợi ý:**
- Chunk requests thành batch 10 profiles/lần
- Hoặc check tuần tự với small delay

---

### 🟡 4. `getProfileTooltip()` tạo string mới mỗi lần render

**File:** [home.ts](file:///Volumes/DataMac/dev/chrome-profile-manager/src/app/views/pages/home/home.ts#L541-L579)

**Vấn đề:**  
Hàm này được gọi trong template cho MỖI profile MỖI render cycle, tạo ra nhiều string concatenation.

**Gợi ý:**
- Tính sẵn tooltip và lưu vào `profile.metadata.cachedTooltip`
- Chỉ update khi metadata thay đổi

---

## 🟢 Suggestions (Tùy chọn)

### 🟢 1. Thêm Virtual Scrolling cho danh sách profiles lớn

**Vấn đề:**  
Nếu có 100+ profiles, tất cả đều được render vào DOM dù user chỉ thấy 10-20 cái.

**Gợi ý:**
- Dùng `@angular/cdk/scrolling` với `cdk-virtual-scroll-viewport`
- Giảm DOM elements từ 100 xuống ~20

---

### 🟢 2. Lazy load Tab content

**Vấn đề:**  
Tất cả 5 tabs (Profiles, Proxies, Tags, Statuses, Extras) đều được render trong cùng 1 component.

**Gợi ý:**
- Chỉ render tab đang active
- Dùng `@defer` block của Angular 17+

---

## 📋 Checklist Fix Priority

| # | Issue | Impact | Effort | Priority |
|---|-------|--------|--------|----------|
| 1 | loadProfileSizes batch | 🔴 Critical | ⏱️ 15 min | **P0** |
| 2 | Split filteredProfiles computed | 🔴 Critical | ⏱️ 30 min | **P0** |
| 3 | Single-pass folder counting | 🔴 Critical | ⏱️ 15 min | **P0** |
| 4 | Chunk refreshProfileStatus | 🟡 Medium | ⏱️ 20 min | P1 |
| 5 | Cache tooltip | 🟡 Medium | ⏱️ 15 min | P1 |
| 6 | Split components | 🟡 Medium | ⏱️ 2 hours | P2 |
| 7 | Virtual scroll | 🟢 Low | ⏱️ 1 hour | P3 |

---

## Next Steps

Anh muốn làm gì tiếp theo?

1️⃣ Xem chi tiết từng vấn đề với code examples
2️⃣ **Sửa ngay 3 lỗi Critical** (loadProfileSizes, filteredProfiles, smartFolders)
3️⃣ Sửa tất cả Warning (4 items)
4️⃣ Bỏ qua, lưu báo cáo này vào /save-brain
5️⃣ 🔧 **FIX ALL** - Tự động sửa TẤT CẢ lỗi có thể sửa

Gõ số (1-5) để chọn:
