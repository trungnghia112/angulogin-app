# Phase 01: CDP Connection API
Status: ✅ Complete
Dependencies: None (builds on existing api_server.rs + rpa.rs)

## Objective
Expose CDP WebSocket URL via REST API so external tools (Puppeteer/Playwright) can
connect directly to launched browser profiles for full automation control.

## Key Insight
When a browser is launched with `--remote-debugging-port`, it exposes a CDP WebSocket endpoint.
External tools only need 2 things:
1. `GET /api/v1/browser/open` (already exists) — launch + get debug port
2. **NEW** `GET /api/v1/browser/cdp` — get CDP WebSocket URL for a running profile

## Implementation Steps

1. [ ] Add `cdp_port` tracking to `AppState.running_browsers` HashMap
   - When `browser_open` launches a browser, store the debug port alongside PID
   - File: `src-tauri/src/api_server.rs`

2. [ ] Add `GET /api/v1/browser/cdp` endpoint
   - Input: `profile` (profile name or path)
   - Output: `{ wsUrl: "ws://127.0.0.1:{port}/devtools/browser/{id}", cdpPort: port }`
   - Fetch browser WebSocket URL from `http://127.0.0.1:{port}/json/version`
   - File: `src-tauri/src/api_server.rs`

3. [ ] Update `browser_open` response to include `cdpPort` and `wsUrl`
   - Modify `BrowserOpenData` in `api_models.rs`
   - Return CDP info immediately when browser launches
   - Files: `src-tauri/src/api_models.rs`, `src-tauri/src/api_server.rs`

4. [ ] Add auto-assign debug port logic
   - Find unused port in range 9222-9322 for each profile
   - Inject `--remote-debugging-port={port}` flag automatically
   - File: `src-tauri/src/api_server.rs`

## API Contract

```
GET /api/v1/browser/open?profile=Profile+1&browser=chrome
Authorization: Bearer <key>

Response:
{
  "success": true,
  "data": {
    "profile": "Profile 1",
    "pid": 12345,
    "cdpPort": 9222,
    "wsUrl": "ws://127.0.0.1:9222/devtools/browser/abc123"
  }
}
```

```
GET /api/v1/browser/cdp?profile=Profile+1
Authorization: Bearer <key>

Response:
{
  "success": true,
  "data": {
    "profile": "Profile 1",
    "cdpPort": 9222,
    "wsUrl": "ws://127.0.0.1:9222/devtools/browser/abc123",
    "pages": [
      { "id": "page1", "url": "https://...", "title": "..." }
    ]
  }
}
```

## External Usage Example (Puppeteer)

```javascript
const res = await fetch('http://localhost:50200/api/v1/browser/open?profile=Profile+1', {
  headers: { 'Authorization': 'Bearer <key>' }
});
const { data } = await res.json();

// Connect Puppeteer to existing browser
const browser = await puppeteer.connect({ browserWSEndpoint: data.wsUrl });
const page = (await browser.pages())[0];
await page.goto('https://example.com');
```

## Test Criteria
- [ ] `browser/open` returns `cdpPort` and `wsUrl` in response
- [ ] `browser/cdp` returns WebSocket URL for running profile
- [ ] `browser/cdp` returns 404 if profile not running
- [ ] Port auto-assignment doesn't conflict with existing ports

## Notes
- This is the most valuable phase — gives users Puppeteer/Playwright integration immediately
- No need for our own RPA execution engine for external users if they have CDP access

---
Next Phase: phase-02-template-execution.md
