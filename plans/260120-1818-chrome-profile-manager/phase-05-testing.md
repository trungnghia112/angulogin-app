# Phase 05: Testing

**Status:** ⬜ Pending
**Dependencies:** Phase 04

## Objective

Test toàn bộ app với các scenarios thực tế.

## Test Scenarios

### Happy Path
- [ ] Mở app → Nhập path → Scan → Hiển thị profiles → Click → Chrome mở

### Edge Cases
- [ ] Path không tồn tại → Hiển thị error message
- [ ] Folder rỗng → Hiển thị "No profiles found"
- [ ] Chrome chưa cài → Hiển thị hướng dẫn

### Security
- [ ] Không thể đọc ngoài `/Volumes/*`
- [ ] Rút ổ ngoài → App không crash, hiển thị warning

## Implementation Steps

1. [ ] Test manual với ổ cứng ngoài thực
2. [ ] Test các edge cases
3. [ ] Fix bugs nếu có

## Test Checklist

| Scenario | Expected | Status |
|----------|----------|--------|
| Scan valid path | List profiles | ⬜ |
| Scan invalid path | Error toast | ⬜ |
| Launch profile | Chrome opens | ⬜ |
| Empty folder | "No profiles" msg | ⬜ |
| Disconnect drive | Warning shown | ⬜ |

---

**Completion:** Sau khi pass tất cả tests → MVP hoàn thành! 🎉
