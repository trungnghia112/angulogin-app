━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 HANDOVER DOCUMENT — 2026-02-20 01:01 AM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Đang làm: RPA Marketplace (Phase 2 complete)
🔢 Đến bước: Phase 2 DONE, Phase 3 pending

✅ ĐÃ XONG (5 commits tonight):
   - Marketplace UI + Automation sidebar layout ✓ (da07ad5)
   - Process + Task pages ✓ (0f2ebbd)
   - Phase 1: JSON schema + service layer ✓ (09f786f)
   - Phase 2: Firestore 2-tier architecture ✓ (003b572)
   - Audit: fix 7 issues + deploy rules ✓ (154ecf2)
   - Data seeded: 15 templates on Firestore ✓
   - Verified: Marketplace loads from Firestore ✓

⏳ CÒN LẠI:
   - Seed emulator data (ng serve connects to emulator)
   - Phase 3: Template Authoring (JSON editor)
   - Smart Defaults & Onboarding
   - Automation API (Puppeteer/Playwright)
   - Real-world stealth testing

🔧 QUYẾT ĐỊNH QUAN TRỌNG:
   - Firestore 2-tier: catalog index + detail docs
   - Progressive Auth: public read, auth for save/run
   - 3-layer fallback: Firestore → localStorage → asset
   - LRU eviction (max 50) for detail cache
   - Singleton service: NEVER destroy from component

⚠️ LƯU Ý CHO SESSION SAU:
   - ng serve uses emulators (useEmulators: true)
   - Data is on PRODUCTION Firestore (angulogin-com)
   - To test locally: set useEmulators: false in environment.ts
   - Task page uses MOCK_TASKS (placeholder, no backend yet)
   - firestore.rules deployed with public read for rpa-*

📁 FILES QUAN TRỌNG:
   - src/app/services/rpa-template.service.ts (Firestore service)
   - src/app/models/rpa-template.model.ts (schema)
   - src/assets/rpa-templates/templates.json (bundled fallback)
   - scripts/seed-rpa-templates.ts (upload to Firestore)
   - firestore.rules (public read rules)
   - .brain/session.json (session state)
   - .brain/brain.json (project knowledge)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Đã lưu! Để tiếp tục: Gõ /recap
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
