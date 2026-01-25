# Phase 02: UI Integration
Status: ⬜ Pending
Dependencies: Phase 01 (Service Method)

## Objective
Add "Backup" action to profile UI in Home page - both Table view and Grid view.

## Requirements

### Functional
- [ ] Backup button in Table view actions column
- [ ] Backup button in Grid view hover actions
- [ ] Toast notification on success with file path
- [ ] Toast notification on error with message
- [ ] Activity log entry for backup action

### Non-Functional
- [ ] Consistent UI with existing actions (Duplicate, Delete, etc.)
- [ ] Use `pi pi-download` or `pi pi-file-export` icon
- [ ] Tooltip: "Backup to ZIP"

## Implementation Steps

### Step 1: Add backupProfile method to Home component

In `src/app/views/pages/home/home.ts`, add:

```typescript
async backupProfile(profile: Profile, event: Event): Promise<void> {
    event.stopPropagation();
    try {
        const backupPath = await this.profileService.backupProfile(profile.path);
        
        // Log activity
        this.activityLogService.logBackup?.(profile.name, profile.path, backupPath);
        
        this.messageService.add({
            severity: 'success',
            summary: 'Backup Successful',
            detail: `Saved to: ${backupPath.split('/').pop()}`,
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg !== 'Backup cancelled') {
            this.messageService.add({
                severity: 'error',
                summary: 'Backup Failed',
                detail: msg,
            });
        }
    }
}
```

### Step 2: Add Backup button to Table view

In `src/app/views/pages/home/home.html`, find the Actions column (around line 220-237).

Add backup button before Incognito button:

```html
<!-- Backup -->
<p-button [id]="'home-profile-' + i + '-backup-btn'"
    (click)="backupProfile(profile, $event)" 
    icon="pi pi-download"
    [rounded]="true" 
    [text]="true" 
    severity="secondary" 
    size="small"
    pTooltip="Backup to ZIP" />
```

### Step 3: Add Backup button to Grid view

In the Grid view card (around line 310-320), add backup button:

```html
<button (click)="backupProfile(profile, $event)"
    class="p-1.5 text-muted-color hover:text-primary transition-colors" 
    title="Backup">
    <i class="pi pi-download text-sm"></i>
</button>
```

### Step 4: Add backup type to Activity Log (Optional)

In `src/app/services/activity-log.service.ts`, add if not exists:

```typescript
logBackup(profileName: string, profilePath: string, backupPath: string): void {
    this.addEntry({
        type: 'backup' as any,
        profileName,
        profilePath,
        details: `Saved to ${backupPath.split('/').pop()}`,
    });
}

// Update getTypeIcon to handle 'backup'
getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
        launch: 'pi-play',
        create: 'pi-plus',
        delete: 'pi-trash',
        duplicate: 'pi-copy',
        edit: 'pi-pencil',
        backup: 'pi-download',  // ADD THIS
    };
    return icons[type] || 'pi-circle';
}

// Update getTypeLabel
getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
        launch: 'Launched',
        create: 'Created',
        delete: 'Deleted',
        duplicate: 'Duplicated',
        edit: 'Edited',
        backup: 'Backed up',  // ADD THIS
    };
    return labels[type] || type;
}
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/app/views/pages/home/home.ts` | Modify | Add `backupProfile()` method |
| `src/app/views/pages/home/home.html` | Modify | Add Backup buttons to Table + Grid |
| `src/app/services/activity-log.service.ts` | Modify | Add `logBackup()` method (optional) |

## Test Criteria
- [ ] Backup button visible in Table view actions
- [ ] Backup button visible in Grid view hover
- [ ] Clicking backup opens native save dialog
- [ ] Selecting location creates ZIP file
- [ ] Success toast shows filename
- [ ] Cancel dialog does NOT show error toast
- [ ] Activity log shows backup entry (if implemented)

## Visual Reference

### Table View:
```
| Name | Status | ... | Actions                    |
|------|--------|-----|----------------------------|
| Work |  ...   | ... | [📥][👁️][📋][👁️][🗑️]  |
                         ↑ NEW Backup button
```

### Grid View:
```
┌─────────────────────┐
│     💼              │
│    Work             │
├─────────────────────┤
│ [Start] [📥][📋][🗑️]│
│          ↑ NEW      │
└─────────────────────┘
```

---
Next Phase: [phase-03-testing.md](./phase-03-testing.md)
