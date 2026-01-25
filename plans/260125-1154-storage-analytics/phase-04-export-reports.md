# Phase 04: Export Reports
Status: ⬜ Pending
Dependencies: Phase 01, Phase 02 (có data để export)

## Objective
Cho phép users export storage và usage reports dưới dạng CSV và PDF.

## Requirements

### Functional
- [ ] Export Storage Report (CSV)
  - Profile name, size, path, last used
- [ ] Export Usage Report (CSV)
  - Profile name, launch count, total time, last used
- [ ] Export Summary Report (PDF - optional)
  - Overview with charts và statistics

### Non-Functional
- [ ] File tự động đặt tên theo ngày
- [ ] Save dialog để chọn vị trí lưu
- [ ] Handle large datasets (100+ profiles)

## Implementation Steps

### CSV Export (Priority)
1. [ ] Add "Export CSV" button trong Storage Dashboard
2. [ ] Create exportToCSV utility function
3. [ ] Use Tauri save dialog để chọn location
4. [ ] Generate CSV với proper encoding (UTF-8 BOM cho Excel)

### PDF Export (Optional/Future)
1. [ ] Evaluate PDF libraries (jsPDF, pdfmake)
2. [ ] Design PDF template với charts
3. [ ] Implement PDF generation

## Files to Create/Modify

### Create
- `src/app/utils/export.utils.ts` - Export utilities

### Modify
- `src/app/views/pages/storage-dashboard/storage-dashboard.ts` - Add export buttons

## CSV Format

### Storage Report (storage_report_YYYYMMDD.csv)
```csv
Profile Name,Size (MB),Size (Bytes),Path,Last Used,Days Since Used
Work Profile,1234.56,1293942784,/path/to/profile,2026-01-24T10:30:00,1
Personal,567.89,595461324,/path/to/profile2,2026-01-20T15:45:00,5
```

### Usage Report (usage_report_YYYYMMDD.csv)
```csv
Profile Name,Launch Count,Total Usage (hours),Avg Session (min),Last Opened
Work Profile,89,45.5,30.7,2026-01-24T10:30:00
Personal,56,28.2,30.2,2026-01-20T15:45:00
```

## Export Utility

```typescript
// src/app/utils/export.utils.ts

export function generateCSV(data: any[], columns: ColumnDef[]): string {
  // UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  
  // Header row
  const header = columns.map(c => `"${c.label}"`).join(',');
  
  // Data rows
  const rows = data.map(row => 
    columns.map(c => {
      const value = c.getValue(row);
      return typeof value === 'string' ? `"${value}"` : value;
    }).join(',')
  );
  
  return BOM + header + '\n' + rows.join('\n');
}

export async function exportToFile(content: string, defaultName: string): Promise<void> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  
  if (path) {
    await writeTextFile(path, content);
  }
}
```

## UI Design

```
┌─────────────────────────────────────────────────────────┐
│  Storage Dashboard                      [📥 Export ▼]   │
├─────────────────────────────────────────────────────────┤
│                                         ┌─────────────┐ │
│                                         │ Storage CSV │ │
│  (Dashboard content...)                 │ Usage CSV   │ │
│                                         │ Full Report │ │
│                                         └─────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Test Criteria
- [ ] CSV exports correctly
- [ ] File opens properly in Excel/Numbers
- [ ] Vietnamese characters display correctly (UTF-8)
- [ ] Save dialog works
- [ ] Large datasets (100+ rows) work

## Notes
- CSV đủ cho MVP, PDF là nice-to-have
- Excel cần UTF-8 BOM để hiển thị Unicode đúng
- Consider streaming for very large datasets

---
End of Sprint 5 Phases
