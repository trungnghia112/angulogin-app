# 🌅 Morning Test Checklist

**Date:** 2026-01-25
**Tester:** John (sau khi ngủ dậy)

## How to Test

1. Start app: `npm run tauri dev` (already running)
2. Open Home page
3. Follow each test case below

---

## Phase 1: Color Coding ✨

### Test Cases:

- [ ] **TC1.1** - Edit profile → See color picker with 8 color options
- [ ] **TC1.2** - Select a color → Save → Color dot appears in profile card
- [ ] **TC1.3** - Color persists after app reload
- [ ] **TC1.4** - Remove color (select none) → Color dot disappears
- [ ] **TC1.5** - Color shows in table view (small dot before name)

### Expected Colors:
Red, Orange, Yellow, Green, Blue, Purple, Pink, Gray

---

## Phase 2: Hidden Profiles 👻

### Test Cases:

- [ ] **TC2.1** - Right-click/menu on profile → See "Hide Profile" option
- [ ] **TC2.2** - Hide profile → It disappears from list
- [ ] **TC2.3** - Toggle "Show Hidden" in header → Hidden profiles appear (grayed out)
- [ ] **TC2.4** - Unhide profile → Returns to normal visibility
- [ ] **TC2.5** - Hidden status persists after reload

---

## Phase 3: Activity Log 📋

### Test Cases:

- [ ] **TC3.1** - Launch any profile → Entry added to activity log
- [ ] **TC3.2** - Click "Activity Log" button (in settings or header) → See log dialog
- [ ] **TC3.3** - Log shows: Profile name, browser, timestamp
- [ ] **TC3.4** - Clear log button works
- [ ] **TC3.5** - Log persists after reload

---

## Phase 4: Profile Preview 👁️

### Test Cases:

- [ ] **TC4.1** - Hover over profile card → Tooltip appears
- [ ] **TC4.2** - Tooltip shows: Name, Group, Tags, Notes, Size, Last used
- [ ] **TC4.3** - Tooltip disappears when mouse leaves
- [ ] **TC4.4** - Works in both table and grid view

---

## Results Summary

| Phase | Tests Passed | Status |
|-------|--------------|--------|
| 1. Color Coding | /5 | ⬜ |
| 2. Hidden Profiles | /5 | ⬜ |
| 3. Activity Log | /5 | ⬜ |
| 4. Profile Preview | /4 | ⬜ |

**Overall:** /19 tests

---

## Issues Found

| Issue | Severity | Notes |
|-------|----------|-------|
| | | |

---

## Notes for AI

If any phase failed during overnight:
- Check git log for commit messages
- Check `plan.md` for progress updates
- Check terminal output for compilation errors
