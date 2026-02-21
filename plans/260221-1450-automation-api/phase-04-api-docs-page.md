# Phase 04: API Docs Page (Angular)
Status: ⬜ Pending
Dependencies: Phase 01-03

## Objective
Create an interactive API documentation page in the Automation section
that shows all available endpoints with examples and a try-it-out feature.

## Implementation Steps

1. [ ] Create `api-docs` component in `views/pages/automation/api-docs/`
   - Grouped by category: Browser, Profile, Automation, Proxy
   - Each endpoint shows: method, path, params, response example
   - Copy-curl button for each endpoint

2. [ ] Add Puppeteer/Playwright connection guide section
   - Code examples for connecting to CDP via `browser/open` → `browser/cdp`
   - Examples in: JavaScript (Puppeteer), Python (Playwright), Node.js

3. [ ] Add "Test Endpoint" feature
   - Send request from UI to local API
   - Show response in JSON viewer

## Files to Create
- `src/app/views/pages/automation/api-docs/api-docs.ts`
- `src/app/views/pages/automation/api-docs/api-docs.html`
- `src/app/views/pages/automation/api-docs/api-docs.css`

## Test Criteria
- [ ] Page renders all endpoints correctly
- [ ] Copy curl button works
- [ ] Code examples are syntactically correct

---
Next Phase: phase-05-testing.md
