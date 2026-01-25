# Phase 01: Frontend Service Method
Status: ⬜ Pending
Dependencies: None (Rust backend exists)

## Objective
Add `backupProfile()` method to `ProfileService` that calls the Rust `backup_profile` command.

## Requirements

### Functional
- [ ] Method accepts profile path
- [ ] Opens Save Dialog for user to choose destination
- [ ] Calls Rust `backup_profile` command
- [ ] Returns backup file path on success
- [ ] Throws meaningful error on failure

### Non-Functional
- [ ] Use `async/await` pattern
- [ ] Handle Tauri IPC errors gracefully
- [ ] Provide debug logging

## Implementation Steps

### Step 1: Add method signature
Add to `src/app/services/profile.service.ts`:

```typescript
/**
 * Backup a profile to a ZIP file
 * @param profilePath - Full path to the profile directory
 * @returns The path where the backup was saved
 */
async backupProfile(profilePath: string): Promise<string> {
    // Implementation
}
```

### Step 2: Implement with Tauri invoke
```typescript
async backupProfile(profilePath: string): Promise<string> {
    if (!isTauriAvailable()) {
        debugLog('Mock backupProfile:', profilePath);
        throw new Error('Backup is only available in desktop app');
    }

    // Extract profile name for default filename
    const profileName = profilePath.split('/').pop() || 'profile';
    const timestamp = new Date().toISOString().slice(0, 10);
    const defaultFileName = `${profileName}_backup_${timestamp}.zip`;

    // Open save dialog
    const filePath = await save({
        title: 'Save Profile Backup',
        defaultPath: defaultFileName,
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
    });

    if (!filePath) {
        throw new Error('Backup cancelled');
    }

    // Call Rust command
    const result = await invoke<string>('backup_profile', {
        profilePath,
        backupPath: filePath
    });

    return result;
}
```

### Step 3: Add required imports
Ensure these imports exist:
```typescript
import { save } from '@tauri-apps/plugin-dialog';
```

## Files to Create/Modify
| File | Action | Purpose |
|------|--------|---------|
| `src/app/services/profile.service.ts` | Modify | Add `backupProfile()` method |

## Test Criteria
- [ ] Method compiles without TypeScript errors
- [ ] Mock mode throws appropriate error
- [ ] Tauri mode opens save dialog
- [ ] Successful backup returns file path
- [ ] Cancelled dialog throws "Backup cancelled" error

## Notes
- The Rust command `backup_profile` already handles ZIP creation recursively
- We use `@tauri-apps/plugin-dialog` for native save dialog
- Filename format: `ProfileName_backup_YYYY-MM-DD.zip`

---
Next Phase: [phase-02-ui-integration.md](./phase-02-ui-integration.md)
