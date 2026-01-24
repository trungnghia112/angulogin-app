# Phase 04: Drag & Drop
Status: ⬜ Pending
Dependencies: None

## Objective
Cho phép kéo thả để sắp xếp thứ tự profiles theo ý muốn.

## Requirements

### Functional
- [ ] Drag & drop trong table view
- [ ] Drag & drop trong grid view
- [ ] Persist order sau khi drop
- [ ] Visual feedback khi dragging

### Non-Functional
- [ ] Smooth animations
- [ ] Touch-friendly (nếu có touchscreen)
- [ ] Không conflict với row click

## Implementation Steps

### 1. Choose Approach

**Option A: Angular CDK DragDrop**
- Pros: Full control, Angular native
- Cons: More setup

**Option B: PrimeNG Table rowReorder**
- Pros: Built-in, easy
- Cons: Limited to table

**Recommended:** CDK DragDrop for both views

### 2. Add sortIndex to Metadata
```typescript
// profile.model.ts
interface ProfileMetadata {
  // ... existing
  sortIndex?: number;  // Custom sort order
}
```

### 3. Install/Import CDK
```typescript
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

@Component({
  imports: [DragDropModule, ...]
})
```

### 4. Table View Implementation
```html
<!-- home.html - Table -->
<p-table [value]="filteredProfiles()" 
  cdkDropList 
  (cdkDropListDropped)="onTableDrop($event)">
  
  <ng-template pTemplate="body" let-profile let-i="rowIndex">
    <tr cdkDrag [cdkDragData]="profile">
      <!-- Drag handle -->
      <td class="drag-handle" cdkDragHandle>
        <i class="pi pi-bars text-muted-color cursor-grab"></i>
      </td>
      
      <!-- Rest of columns -->
    </tr>
    
    <!-- Drag placeholder -->
    <tr *cdkDragPlaceholder class="bg-primary/10 border-2 border-dashed border-primary">
      <td colspan="8">&nbsp;</td>
    </tr>
  </ng-template>
</p-table>
```

### 5. Grid View Implementation
```html
<!-- home.html - Grid -->
<div id="home-profiles-grid" 
  class="grid grid-cols-5 gap-4"
  cdkDropList
  cdkDropListOrientation="mixed"
  (cdkDropListDropped)="onGridDrop($event)">
  
  @for (profile of filteredProfiles(); track profile.path) {
    <div cdkDrag [cdkDragData]="profile" class="profile-card">
      <!-- Drag preview -->
      <div *cdkDragPreview class="w-48 h-32 bg-surface-100 rounded-xl shadow-lg p-4">
        {{ profile.name }}
      </div>
      
      <!-- Placeholder slot -->
      <div *cdkDragPlaceholder class="w-full h-full bg-primary/10 rounded-xl border-2 border-dashed border-primary"></div>
      
      <!-- Actual content -->
      ...
    </div>
  }
</div>
```

### 6. Drop Handler
```typescript
onTableDrop(event: CdkDragDrop<Profile[]>): void {
  const profiles = [...this.filteredProfiles()];
  moveItemInArray(profiles, event.previousIndex, event.currentIndex);
  
  // Update sortIndex for all affected profiles
  profiles.forEach((p, index) => {
    if (p.metadata) {
      p.metadata.sortIndex = index;
    } else {
      p.metadata = { sortIndex: index };
    }
  });
  
  // Persist to storage
  this.saveProfileOrder(profiles);
}

onGridDrop(event: CdkDragDrop<Profile[]>): void {
  // Same logic as table
  this.onTableDrop(event);
}

private async saveProfileOrder(profiles: Profile[]): Promise<void> {
  // Update metadata for each profile
  for (const profile of profiles) {
    await this.profileService.updateProfileMetadata(profile.path, profile.metadata!);
  }
  
  this.messageService.add({
    severity: 'info',
    summary: 'Reordered',
    detail: 'Profile order saved',
    life: 2000
  });
}
```

### 7. Apply sortIndex in Sorting
```typescript
// Update sortedProfiles computed
sortedProfiles = computed(() => {
  let profiles = [...this.filteredByFilters()];
  
  // If custom sort selected
  if (this.sortBy() === 'custom') {
    return profiles.sort((a, b) => 
      (a.metadata?.sortIndex ?? 999) - (b.metadata?.sortIndex ?? 999)
    );
  }
  
  // Other sort options...
});
```

### 8. CSS for Drag
```css
/* home.css */
.cdk-drag-preview {
  box-shadow: 0 5px 20px rgba(0,0,0,0.2);
  opacity: 0.9;
}

.cdk-drag-animating {
  transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
}

.drag-handle {
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.cdk-drop-list-dragging .cdk-drag {
  transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
}
```

## Files to Create/Modify
- `src/app/views/pages/home/home.ts` - Import CDK, add handlers
- `src/app/views/pages/home/home.html` - Add drag directives
- `src/app/views/pages/home/home.css` - Drag styles
- `src/app/models/profile.model.ts` - Add sortIndex

## Test Criteria
- [ ] Can drag row in table
- [ ] Can drag card in grid
- [ ] Order persists after refresh
- [ ] Visual placeholder during drag
- [ ] Animations smooth
- [ ] Drag handle prevents accidental drags
- [ ] Works with filtered/searched lists

## Notes
- Consider: disable drag khi đang trong custom sort mode only?
- Consider: drag between folders/groups?
- CDK DragDrop works with signals từ Angular 17+

---
Previous Phase: [Phase 03 - Profile Restore](./phase-03-profile-restore.md)
