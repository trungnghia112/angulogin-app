# Phase 03: Profile Restore
Status: ⬜ Pending
Dependencies: Existing backup feature (5.1 - done)

## Objective
Restore profile từ backup .zip file đã tạo trước đó.

## Requirements

### Functional
- [ ] Chọn backup file (.zip) để restore
- [ ] Extract vào profiles folder
- [ ] Handle naming conflicts
- [ ] Restore metadata từ backup
- [ ] Progress indicator

### Non-Functional
- [ ] Validate backup trước khi extract
- [ ] Rollback nếu restore fail
- [ ] Handle large backups (> 1GB)

## Implementation Steps

### 1. Add Rust Restore Command
```rust
// src-tauri/src/commands.rs

#[tauri::command]
pub async fn restore_from_backup(
    backup_path: String,
    target_base_path: String,
    conflict_action: String  // "overwrite" | "rename" | "skip"
) -> Result<RestoreResult, String> {
    // 1. Validate zip file
    // 2. Read metadata.json from zip
    // 3. Determine target folder name
    // 4. Handle conflicts
    // 5. Extract zip
    // 6. Return result
}

#[derive(Serialize)]
pub struct RestoreResult {
    success: bool,
    restored_path: String,
    profile_name: String,
    was_renamed: bool,
}
```

### 2. Backup Validation
```rust
fn validate_backup(zip_path: &Path) -> Result<BackupInfo, String> {
    let file = File::open(zip_path)?;
    let mut archive = ZipArchive::new(file)?;
    
    // Check for metadata.json
    let metadata = archive.by_name("metadata.json")?;
    let info: BackupInfo = serde_json::from_reader(metadata)?;
    
    // Check essential Chrome files exist
    let has_preferences = archive.by_name("Preferences").is_ok();
    
    Ok(info)
}
```

### 3. Conflict Handling
```rust
fn resolve_conflict(
    target_path: &Path,
    action: &str,
    original_name: &str
) -> Result<PathBuf, String> {
    if !target_path.exists() {
        return Ok(target_path.to_path_buf());
    }
    
    match action {
        "overwrite" => {
            fs::remove_dir_all(target_path)?;
            Ok(target_path.to_path_buf())
        },
        "rename" => {
            // Find unique name: "ProfileName (Restored 1)"
            let mut counter = 1;
            loop {
                let new_name = format!("{} (Restored {})", original_name, counter);
                let new_path = target_path.parent().unwrap().join(&new_name);
                if !new_path.exists() {
                    return Ok(new_path);
                }
                counter += 1;
            }
        },
        "skip" => Err("Skipped due to conflict".to_string()),
        _ => Err("Invalid conflict action".to_string())
    }
}
```

### 4. Frontend Service
```typescript
// profile.service.ts
async restoreFromBackup(
  backupPath: string,
  targetBasePath: string,
  conflictAction: 'overwrite' | 'rename' | 'skip'
): Promise<RestoreResult> {
  return invoke<RestoreResult>('restore_from_backup', {
    backupPath,
    targetBasePath,
    conflictAction
  });
}
```

### 5. UI in Settings
```html
<!-- settings.html -->
<div class="restore-section">
  <h3>Restore from Backup</h3>
  <p>Restore a profile from a previously created backup file.</p>
  
  <p-button label="Choose Backup File" icon="pi pi-upload" 
    (click)="openRestoreDialog()" />
</div>

<!-- Restore Dialog -->
<p-dialog header="Restore Profile" [(visible)]="showRestoreDialog">
  <div class="space-y-4">
    <div>
      <label>Backup File</label>
      <p-button label="Browse..." (click)="selectBackupFile()" />
      <span>{{ selectedBackupPath() }}</span>
    </div>
    
    <div>
      <label>If profile exists:</label>
      <p-selectButton [options]="conflictOptions" [(ngModel)]="conflictAction" />
    </div>
    
    @if (restoring()) {
      <p-progressBar mode="indeterminate" />
    }
  </div>
  
  <ng-template #footer>
    <p-button label="Cancel" (click)="showRestoreDialog.set(false)" />
    <p-button label="Restore" (click)="restoreBackup()" [loading]="restoring()" />
  </ng-template>
</p-dialog>
```

## Files to Create/Modify
- `src-tauri/src/commands.rs` - Add restore_from_backup command
- `src/app/services/profile.service.ts` - Add restoreFromBackup method
- `src/app/views/pages/settings/settings.ts` - Add restore logic
- `src/app/views/pages/settings/settings.html` - Add restore UI

## Test Criteria
- [ ] Can select .zip backup file
- [ ] Restore creates correct folder structure
- [ ] Metadata restored correctly
- [ ] Conflict: overwrite works
- [ ] Conflict: rename works
- [ ] Invalid backup shows error
- [ ] Large backup (1GB+) handles properly

## Notes
- Reuse existing zip crate from backup feature
- Consider: restore progress percentage for large files
- Consider: dry-run validation before actual restore

---
Next Phase: [Phase 04 - Drag & Drop](./phase-04-drag-and-drop.md)
