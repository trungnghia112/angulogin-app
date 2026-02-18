# Operational Rules

1. **Communication**: Mirror user's language (Vietnamese <-> Vietnamese)
2. **Execution Flow**: Sequential steps. NO asking "continue?". Auto-retry on errors
3. **Mandatory Build**: ALWAYS run `npm run build` after coding steps
4. **Commit Policy**: Commit after every step. English messages. Semantic format
5. **Memory Trigger**: If prompt starts with "Hay ghi nho:", update memories + AGENTS.md + .gemini/GEMINI.md
6. **Smart Versioning**: Check package.json versions. Apply syntax for detected versions
7. **Global UI**: `<p-toast>` and `<p-confirmDialog>` in app.html only. Use `key: 'confirmDialog'`
8. **Seed Data Sync**: Update `tools/seed.ts` for new permissions
9. **API Docs Sync**: Update `http/api.http` and `http/postman_collection.json` for API changes
10. **UI Consistency**: Clone existing Master Template for new features
11. **Performance**:
    - setInterval/setTimeout >= 30s for background tasks, cleanup in ngOnDestroy
    - Pause intervals when tab hidden (visibility API)
    - No new objects/arrays if data unchanged
    - Use signal/computed instead of getter methods in templates
