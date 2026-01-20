# Task Completion Checklist

## After Every Code Change
1. **Build Check**: Run `npm run build` - Fix ALL warnings
2. **Git Commit**: `git add -A && git commit -m "type: description"`
   - Types: `feat`, `fix`, `refactor`, `chore`
   - Language: English

## When Adding New Features
- [ ] Clone existing Master Template layout
- [ ] Support dark mode with `dark:` classes
- [ ] Add `id` attributes to all interactive elements
- [ ] Verify build has no warnings

## When Modifying API
- [ ] Update `http/api.http`
- [ ] Update `http/postman_collection.json`

## When Adding Permissions
- [ ] Update `tools/seed.ts`

## Testing Protocol
- **Localhost (4200)**: UI/Layout only
- **Chrome Extension**: End-to-end flows (user must verify)
