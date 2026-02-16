# 💡 BRIEF: AnguLogin Antidetect Browser

**Ngày tạo:** 2026-02-17
**Quyết định:** Tích hợp Camoufox engine để thương mại hoá

---

## 1. VẤN ĐỀ

Marketer, seller, agency quản lý nhiều tài khoản (Facebook, Google, TikTok, Amazon) cần browser isolated cho mỗi account. Giải pháp hiện tại đắt và cloud lock-in.

## 2. GIẢI PHÁP

Tích hợp **Camoufox** (patched Firefox, C++ level fingerprint spoofing) vào AnguLogin desktop app. Local-first, giá cạnh tranh.

## 3. QUYẾT ĐỊNH KIẾN TRÚC

### Engine: Camoufox (Firefox-based)
- **Antidetect level:** ~95% (C++ level spoofing, undetectable by JS)
- **Binary size:** ~80-100MB (auto-download on first use)
- **Reference:** DonutBrowser's `camoufox_manager.rs`, `fingerprint-network-definition.zip`, `webgl_data.db`
- **License:** Viết lại clean-room (DonutBrowser là AGPL-3.0)

### Tại sao Camoufox thay vì Chromium:
| | Camoufox | Chromium CDP | Custom Chromium |
|---|---|---|---|
| Antidetect | ~95% | ~85% | ~95% |
| Effort | 6 tuần | 4 tuần | 3 tháng |
| Binary size | 80MB | 0MB | 200MB+ |
| Detection risk | Rất thấp | Trung bình | Thấp |
| Maintenance | Camoufox team update | Tự maintain | Tự maintain |

### Kiến trúc tổng thể:
```
┌─────────────────────────────────┐
│      AnguLogin Desktop (Tauri)  │
├─────────────────────────────────┤
│ Profile Manager (Angular UI)    │
│  ├── Chrome profiles (legacy)   │
│  └── Camoufox profiles (new)    │
├─────────────────────────────────┤
│ Rust Backend                    │
│  ├── camoufox_manager.rs (NEW)  │
│  │   ├── Download & install     │
│  │   ├── Fingerprint generation │
│  │   ├── Launch with config     │
│  │   └── Profile data dir       │
│  ├── fingerprint_engine.rs (NEW)│
│  │   ├── OS spoofing            │
│  │   ├── Screen/Resolution      │
│  │   ├── WebGL/Canvas noise     │
│  │   ├── Font enumeration       │
│  │   └── Timezone/Locale        │
│  └── commands.rs (existing)     │
│      └── launch_browser()       │
│          ├── Chrome (existing)   │
│          └── Camoufox (new path) │
└─────────────────────────────────┘
```

---

## 4. NGHIÊN CỨU THỊ TRƯỜNG

| App | Giá/tháng | Engine | Antidetect |
|-----|-----------|--------|-----------|
| Multilogin | €99-299 | Mimic (Chromium) + Stealthfox (Firefox) | ~95% |
| GoLogin | $24-99 | Orbita (Chromium) | ~80% |
| AdsPower | $9-59 | SunBrowser (Chromium) + FlowerBrowser (Firefox) | ~90% |
| **AnguLogin** | **$0-29** | **Camoufox (Firefox)** | **~95%** |

**Điểm khác biệt:**
1. Desktop-first, local-first (data không lên cloud)
2. Tauri = ~15MB installer (vs 200MB+ Electron)
3. Proxy rotation built-in (đối thủ charge riêng)
4. Free tier 5 profiles

---

## 5. TÍNH NĂNG — PHASE 2 (Camoufox Integration)

### 🚀 MVP (6 tuần):
- [ ] Auto-download Camoufox binary on first use
- [ ] Fingerprint generation engine (OS, Screen, WebGL, Canvas, Fonts, TZ)
- [ ] Per-profile fingerprint storage in metadata
- [ ] Launch Camoufox with fingerprint config
- [ ] UI: Engine selector (Chrome / Camoufox) trong profile edit
- [ ] UI: Fingerprint preview card
- [ ] UI: "Randomize fingerprint" button
- [ ] Fingerprint checker page (built-in test)

### 🎁 Phase 3 (sau MVP):
- [ ] Fingerprint templates (preset: Win10/Mac/Linux)
- [ ] Bulk profile creation with random fingerprints
- [ ] Team collaboration
- [ ] API automation (Selenium/Playwright)
- [ ] Subscription/licensing system

---

## 6. PRICING

| Tier | Giá/tháng | Profiles | Antidetect |
|------|-----------|----------|------------|
| Free | $0 | 5 | CLI flags only |
| Starter | $15 | 50 | Camoufox engine |
| Pro | $29 | 200 | + Fingerprint templates + Team |

---

## 7. BƯỚC TIẾP THEO

→ `/plan` Phase 2: Camoufox Integration
