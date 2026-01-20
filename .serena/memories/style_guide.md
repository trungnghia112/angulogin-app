# Style Guide - Angular v21 Standards

## Naming Convention (STRICT)

### Files
- Use: `[name].ts`, `[name].html`, `[name].css`
- **FORBIDDEN**: `.component.ts`, `.component.html`

### Classes
- Use: `export class [Name]`
- **FORBIDDEN**: `Component` suffix (e.g., use `Pages`, NOT `PagesComponent`)

### Folder Structure
- Each component in its own subfolder
- Pages: `src/app/views/pages/[feature]/[component-name]/`
- Shared: `src/app/shared/components/[component-name]/`

---

## Angular Modern Standards (v21+)

### Components
- **Standalone**: Always (default in v21, do NOT set `standalone: true`)
- **Templates**: MUST use `templateUrl` and `styleUrl` (separate files)
- **Change Detection**: `changeDetection: ChangeDetectionStrategy.OnPush`

### State Management (100% Signals)
```typescript
// Local state
protected readonly items = signal<Item[]>([]);

// Derived state
protected readonly count = computed(() => this.items().length);

// Inputs/Outputs (readonly modifier)
readonly id = input.required<string>();
readonly itemSelected = output<Item>();
```

### Templates
- Control Flow: `@if`, `@for`, `@switch` (NOT `*ngIf`, `*ngFor`)
- Class binding: `[class.active]="isActive()"` (NOT `ngClass`)
- Style binding: `[style.color]="color()"` (NOT `ngStyle`)

### Dependency Injection
```typescript
private readonly firestore = inject(Firestore);
private readonly router = inject(Router);
```

---

## Firebase / Firestore Patterns

### One-time Fetch
```typescript
fetchData(): Observable<Item[]> {
  const colRef = collection(this.firestore, 'items');
  return from(getDocs(colRef)).pipe(
    map(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
  );
}
```

### Real-time Stream (for toSignal)
```typescript
getStream(): Observable<Item[]> {
  const colRef = collection(this.firestore, 'items');
  return new Observable(subscriber => {
    const unsubscribe = onSnapshot(colRef, {
      next: snap => subscriber.next(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      error: err => subscriber.error(err)
    });
    return () => unsubscribe();
  });
}
```

### Safety Rules
- **NEVER** save `undefined` to Firestore
- Use `null` for empty optional fields
- Sanitize objects before saving

---

## UI Stack

### PrimeNG + Tailwind v4
- Theme: Aura with dark mode (`darkModeSelector: '.dark'`)
- CSS Layer order: `theme, base, primeng`
- Icons: PrimeIcons (`<i class="pi pi-home"></i>`)
- Integration: `tailwindcss-primeui`

### Dark Mode
```css
@custom-variant dark (&:where(.dark, .dark *));
```

### Component Styling
- **Tailwind ONLY** for layout
- Use `class` attribute (NOT `styleClass`)
- All components MUST support dark mode (`dark:` classes)

---

## HTML ID Naming
- **Format**: `[feature]-[section]-[index]`
- **Examples**: `profile-header-0`, `profile-btn-save`
