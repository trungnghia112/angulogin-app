# Phase 02: Storage Dashboard
Status: ⬜ Pending
Dependencies: Phase 01 (optional - có thể dùng usage stats)

## Objective
Visual dashboard hiển thị dung lượng storage của các profiles với charts và cleanup suggestions.

## Requirements

### Functional
- [ ] Pie chart: tỷ lệ dung lượng các profile
- [ ] Bar chart: top 10 profiles lớn nhất
- [ ] Summary cards: total size, average size, count
- [ ] Cleanup suggestions: profiles lớn, không dùng lâu
- [ ] Quick actions: delete, backup từ dashboard

### Non-Functional
- [ ] Charts load nhanh (< 1s)
- [ ] Responsive trên các màn hình
- [ ] Dark mode compatible

## Implementation Steps

### 1. Setup PrimeNG Charts
```typescript
// app.config.ts or component
import { ChartModule } from 'primeng/chart';

// Đã có Chart.js bundled với PrimeNG
```

### 2. Create Storage Dashboard Page
```
src/app/views/pages/storage-dashboard/
├── storage-dashboard.ts
├── storage-dashboard.html
└── storage-dashboard.css
```

### 3. Chart Configurations
```typescript
// Pie Chart - Distribution
pieData = computed(() => ({
  labels: this.profiles().map(p => p.name),
  datasets: [{
    data: this.profiles().map(p => p.size || 0),
    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', ...]
  }]
}));

// Bar Chart - Top 10
barData = computed(() => {
  const sorted = [...this.profiles()].sort((a, b) => (b.size || 0) - (a.size || 0));
  const top10 = sorted.slice(0, 10);
  return {
    labels: top10.map(p => p.name),
    datasets: [{
      label: 'Size (MB)',
      data: top10.map(p => (p.size || 0) / 1024 / 1024),
      backgroundColor: '#36A2EB'
    }]
  };
});
```

### 4. Summary Cards
```html
<div class="grid grid-cols-4 gap-4">
  <div class="card">
    <h3>Total Storage</h3>
    <p class="text-2xl">{{ totalSize() | formatSize }}</p>
  </div>
  <div class="card">
    <h3>Profiles</h3>
    <p class="text-2xl">{{ profileCount() }}</p>
  </div>
  <div class="card">
    <h3>Average Size</h3>
    <p class="text-2xl">{{ avgSize() | formatSize }}</p>
  </div>
  <div class="card">
    <h3>Largest</h3>
    <p class="text-2xl">{{ largestProfile()?.name }}</p>
  </div>
</div>
```

### 5. Cleanup Suggestions
```typescript
cleanupSuggestions = computed(() => {
  const suggestions: CleanupSuggestion[] = [];
  
  // Profiles > 1GB
  const large = this.profiles().filter(p => (p.size || 0) > 1024 * 1024 * 1024);
  large.forEach(p => suggestions.push({
    type: 'large',
    profile: p,
    reason: `${formatSize(p.size)} - Consider cleaning cache`
  }));
  
  // Not used in 30 days
  const unused = this.profiles().filter(p => {
    const lastUsed = p.metadata?.lastOpened;
    if (!lastUsed) return true;
    const daysSince = (Date.now() - new Date(lastUsed).getTime()) / 86400000;
    return daysSince > 30;
  });
  unused.forEach(p => suggestions.push({
    type: 'unused',
    profile: p,
    reason: 'Not used in 30+ days'
  }));
  
  return suggestions;
});
```

### 6. Add Route
```typescript
// app.routes.ts
{ path: 'storage', loadComponent: () => import('./views/pages/storage-dashboard/storage-dashboard').then(m => m.StorageDashboard) }
```

## Files to Create/Modify
- `src/app/views/pages/storage-dashboard/storage-dashboard.ts` - NEW
- `src/app/views/pages/storage-dashboard/storage-dashboard.html` - NEW
- `src/app/views/pages/storage-dashboard/storage-dashboard.css` - NEW
- `src/app/app.routes.ts` - Add route
- `src/app/views/components/main-nav/main-nav.html` - Add nav link

## Test Criteria
- [ ] Pie chart renders với profile data
- [ ] Bar chart shows top 10 correctly
- [ ] Summary cards show accurate stats
- [ ] Cleanup suggestions logic works
- [ ] Dark mode looks good
- [ ] Empty state khi no profiles

## Notes
- PrimeNG Charts uses Chart.js internally
- Consider: Export chart as image?
- Consider: Compare với previous month?

---
Next Phase: [Phase 03 - Profile Restore](./phase-03-profile-restore.md)
