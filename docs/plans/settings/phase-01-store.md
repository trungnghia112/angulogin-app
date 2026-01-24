# Phase 01: Settings Store & Infrastructure
Status: ⬜ Pending

## Objective
Establish the `SettingsStore` to manage application configuration state and persist it to `localStorage`.

## Requirements
### Functional
- [ ] Define `AppSettings` strict interface.
- [ ] Create `SettingsService` (Injectable).
- [ ] Initialize `state` signal from `localStorage` (lazy init).
- [ ] Implement `updateSettings` and `resetSettings` methods.
- [ ] Auto-save via `effect()`.

### Data Structure
```typescript
interface AppSettings {
  general: {
    startAtLogin: boolean;
    minimizeToTray: boolean;
  };
  appearance: {
    primaryColor: string; // 'indigo', 'fuchsia', 'cyan', etc.
    scale: number; // 12px to 16px (default 14px)
  };
  browser: {
    customPaths: Record<string, string>; // 'chrome': '/path/to/bin'
  };
}
```

## Implementation Steps
1. [ ] Create `src/app/core/models/settings.model.ts`.
2. [ ] Create `src/app/core/services/settings.service.ts`.
3. [ ] Implement loading logic and persistence effect.

## Files to Create
- `src/app/core/models/settings.model.ts`
- `src/app/core/services/settings.service.ts`
