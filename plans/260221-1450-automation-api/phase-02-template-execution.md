# Phase 02: Template Execution API
Status: ✅ Complete
Dependencies: Phase 01

## Objective
Allow external tools to execute RPA templates on profiles via REST API,
without needing the Angular UI open.

## Implementation Steps

1. [ ] Port RPA execution logic from Angular to Rust
   - Mirror `RpaExecutorService.executeStep()` logic in Rust
   - Reuse existing `rpa.rs` CDP functions (connect, evaluate, disconnect)
   - New file: `src-tauri/src/rpa_api.rs`

2. [ ] Add `POST /api/v1/automation/execute` endpoint
   - Input: `{ profile, browser, templateId, variables }`
   - Launches browser, loads template from local catalog, executes steps
   - Returns: `{ taskId, status: "running" }`

3. [ ] Add `POST /api/v1/automation/execute-steps` endpoint (raw mode)
   - Input: `{ profile, browser, steps: [...], variables }`
   - Accepts raw step array (no template lookup needed)
   - For power users who write their own automation

4. [ ] Add task state management in Rust
   - In-memory HashMap<taskId, TaskState> in AppState
   - Track status: queued → running → completed/failed/cancelled

5. [ ] Add `POST /api/v1/automation/cancel` endpoint
   - Input: `{ taskId }`
   - Sets cancellation flag, executor checks between steps

## API Contract

```
POST /api/v1/automation/execute
Authorization: Bearer <key>
Content-Type: application/json

{
  "profile": "Profile 1",
  "browser": "chrome",
  "templateId": "tiktok-search-like",
  "variables": {
    "searchText": "funny cats",
    "viewVideoCount": 3
  }
}

Response:
{
  "success": true,
  "data": {
    "taskId": "task_abc123",
    "status": "running",
    "template": "TikTok Search & Comment Like",
    "profile": "Profile 1"
  }
}
```

## Test Criteria
- [ ] Execute endpoint starts task and returns taskId
- [ ] Execute-steps endpoint works with raw steps
- [ ] Cancel endpoint stops running task
- [ ] Invalid template ID returns 404
- [ ] Missing variables returns validation error

---
Next Phase: phase-03-task-monitoring.md
