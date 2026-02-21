# Plan: Automation API — External RPA Execution & CDP Bridge
Created: 2026-02-21 14:50
Status: 🟡 Planning

## Overview
Add automation execution endpoints to the existing Local REST API, enabling external tools
(Python scripts, Puppeteer, Playwright, n8n, Make.com) to:
1. Execute RPA templates on profiles programmatically
2. Get CDP (Chrome DevTools Protocol) WebSocket URLs for direct browser control
3. Monitor task execution status and logs

## Existing Infrastructure (Already Built)
- **REST API Server:** `api_server.rs` — 800 LOC, Axum, API key auth, 20+ endpoints
- **RPA Executor:** `rpa-executor.service.ts` — Angular service, CDP via Tauri IPC
- **CDP Bridge:** `rpa.rs` + `cdp.rs` — Rust, WebSocket CDP relay
- **Templates:** 15 templates in Firestore, `RpaTemplate` model

## Architecture Decision

### Option A: Add to existing Rust API server (Recommended)
- Reuse `api_server.rs` Axum router
- Call `rpa.rs` functions directly from Rust
- No Angular dependency — works even without UI open
- Consistent API key auth

### Option B: Expose via Tauri IPC → Angular → API
- Requires Angular frontend running
- Extra hop, more latency
- Not suitable for headless automation

**Decision: Option A** — Direct Rust implementation in `api_server.rs`

## Phases

| Phase | Name | Status | Tasks |
|-------|------|--------|-------|
| 01 | CDP Connection API | ✅ Done | 4 |
| 02 | Template Execution API | ⬜ Pending | 5 |
| 03 | Task Monitoring API | ⬜ Pending | 3 |
| 04 | API Docs Page (Angular) | ⬜ Pending | 3 |
| 05 | Testing & Documentation | ⬜ Pending | 4 |

**Total:** 19 tasks | Estimate: 2-3 sessions

## Quick Commands
- Start Phase 1: `/code phase-01`
- Check progress: `/next`
- Save context: `/save-brain`
