
You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

**Naming Convention (STRICT):**
- Files: Use simple names: `[name].ts`, `[name].html`, `[name].css`. **DO NOT** use `.component.ts`.
- Class: Use simple names: `export class [Name]`. **DO NOT** append `Component` (e.g., `class Pages`, not `class PagesComponent`).

**Folder Structure (STRICT):** Each component MUST be in its own subfolder.
- Example for a page: `src/app/views/pages/[feature]/[component-name]/`.
- Example: `src/app/views/pages/collections/collections-list/`.

**MANDATORY**: Use `templateUrl` and `styleUrl` (separate files) for ALL components. **DO NOT** use inline `template: \`...\`` or `styles: [...]`.

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

### Page Components (CRITICAL)

**Host Class Rule**: ALL page components in `src/app/views/pages/` MUST have a `host` property with flexbox classes to ensure full-height layout:

```typescript
@Component({
    selector: 'app-[page-name]',
    templateUrl: './[page-name].html',
    styleUrl: './[page-name].css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' }, // REQUIRED
    imports: [...],
})
```

**Why**: Angular creates a host element (`<app-xxx>`) that wraps the template. Without this class, the host element has `display: inline` by default and breaks the flexbox chain from the parent layout, causing height issues.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.
- Do not write arrow functions in templates (they are not supported).

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

---

## PrimeNG Component Reference (CRITICAL)

**MUST READ before using ANY PrimeNG component.** Do NOT rely on old patterns from training data.

- **LLMs Docs:** `https://primeng.org/llms/llms.txt` (index) or `https://primeng.org/llms/llms-full.txt` (full)
- **Per-component docs:** Add `.md` to any page URL, e.g. `https://primeng.org/llms/components/button.md`
- **Always fetch the latest docs** using `read_url_content` for the specific component before writing code.

### Deprecated Patterns (DO NOT USE)

| Deprecated (old) | Correct (v21+) |
|---|---|
| `<span class="p-input-icon-left">` | `<p-iconfield>` + `<p-inputicon>` |
| `<span class="p-input-icon-right">` | `<p-iconfield iconPosition="right">` + `<p-inputicon>` |
| `styleClass="..."` | `class="..."` |

### Form Controls Consistency Rule

When multiple form controls (`p-select`, `pInputText`, `p-iconfield`, etc.) are on the **same row**:
- **ALL must have the same `size`** (or none at all). Never set `size="small"` on one but not others.
- Always visually verify height/padding alignment between adjacent controls.

---

## Dark Mode Architecture (CRITICAL)

This project uses **PrimeNG + Tailwind CSS** with a unified dark mode system based on the `.dark` class.

### Configuration

**app.config.ts:**
```typescript
providePrimeNG({
  theme: {
    preset: MyPreset,
    options: {
      darkModeSelector: '.dark',  // CRITICAL: Must match Tailwind
      cssLayer: false             // Avoid conflicts with Tailwind
    }
  }
})
```

**styles.css:**
```css
@custom-variant dark (&:where(.dark, .dark *));
```

### Key Insight: PrimeNG Surface Scale is NOT Inverted!

| Surface | Light Mode | Dark Mode | Usage in Dark Mode |
|---------|------------|-----------|-------------------|
| `surface.0` | White | **Still White** | Text/Foreground |
| `surface.950` | Dark | **Still Dark** | Background |

This means `bg-surface-0` will ALWAYS be white, even in dark mode!

### Template Pattern (MANDATORY)

When using surface backgrounds, ALWAYS add dark variants:

```html
<!-- Backgrounds -->
<div class="bg-surface-0 dark:bg-surface-900">...</div>
<div class="bg-surface-50 dark:bg-surface-950">...</div>
<div class="bg-surface-100 dark:bg-surface-800">...</div>

<!-- Borders -->
<div class="border-surface-200 dark:border-surface-700">...</div>
```

### Toggle Mechanism

Use direct DOM manipulation (NOT Angular effect):

```typescript
// In component
toggleTheme() {
  const html = document.documentElement;
  if (this.isDarkMode()) {
    html.classList.remove('dark');
    localStorage.setItem('app-theme', 'light');
  } else {
    html.classList.add('dark');
    localStorage.setItem('app-theme', 'dark');
  }
  this.isDarkMode.set(!this.isDarkMode());
}
```

### Common Gotchas

- **PrimeNG default `darkModeSelector` is `'system'`** (uses @media prefers-color-scheme) - NOT `.dark` class!
- **`tailwindcss-primeui` does NOT auto-invert** `bg-surface-X` - must add `dark:` variants manually
- **Angular `effect()` is unreliable** for DOM manipulation in zoneless mode - use direct DOM APIs

---

## Firestore Best Practices

### Data Fetching Patterns

Use these patterns for fetching data to ensure consistency and optimization for signals.

#### One-time Fetch (Promise to Observable)

```typescript
fetchDataOnce(path: string): Observable<any[]> {
  const colRef = collection(this.firestore, path);
  const q = query(colRef, where('isActive', '==', true));
  return from(getDocs(q)).pipe(
    map(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
  );
}
```

#### Real-time Stream (Optimized for toSignal)

```typescript
getDataStream(path: string): Observable<any[]> {
  const colRef = collection(this.firestore, path);
  const q = query(colRef, where('isActive', '==', true));

  return new Observable(subscriber => {
    const unsubscribe = onSnapshot(q, {
      next: (snap) => {
        const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        subscriber.next(items);
      },
      error: (err) => subscriber.error(err)
    });
    
    // Cleanup: This runs when the component is destroyed
    return () => unsubscribe();
  });
}
```

### Common Pitfalls

#### Unsupported Field Value: undefined

Firestore does not support `undefined` as a field value. Passing `undefined` will throw a `FirebaseError`.

**Solution:**
- Always default optional fields to `null` if they might be empty.
- Or, sanitize the object to remove keys with `undefined` values before saving.

```typescript
// Incorrect
const data = { description: form.value.description }; // if undefined

// Correct
const data = { description: form.value.description || null };
```

---

## Serena MCP Usage Guidelines

1. **Intelligent Navigation**:
   - Avoid reading entire files immediately.
   - Use `get_symbols_overview` to understand file structure.
   - Use `find_symbol` to locate specific classes/methods.
   - Use `search_for_pattern` for flexible text/regex searching.

2. **Symbolic Editing (Preferred)**:
   - Refrain from rewriting entire files.
   - Use `replace_symbol_body` to modify functions/classes.
   - Use `insert_before_symbol` or `insert_after_symbol` to add new code.

3. **Regex Editing**:
   - Use `replace_content` with "regex" mode for targeted changes.
   - Use wildcards (`.*?`) effectively.

4. **Context Awareness**:
   - Check for project memories using `list_memories` and `read_memory`.

---

## User-Defined Operational Rules

1. **Memory Trigger**: If prompt starts with "Hãy ghi nhớ:", update memories, `AGENTS.md`, and `.gemini/GEMINI.md`.
2. **Mandatory Build**: ALWAYS run `npm run build` after coding steps.
3. **Commit Policy**: Commit after every step. English messages. Semantic format (feat, fix, refactor, chore).
4. **Communication**: Mirror user's language (Vietnamese <-> Vietnamese).
5. **Execution Flow**: Sequential steps. NO asking "continue?". Auto-retry on errors.
6. **Smart Versioning**: Check `package.json` versions. Apply syntax rules for detected versions.
7. **Restrictions**:
   - NO Unit Tests unless requested.
   - NO Markdown docs unless requested.
   - NO emojis in code/comments.
   - **NO `styleClass` on PrimeNG. Use `class` instead.**
   - **PrimeNG components: ALWAYS check `https://primeng.org/llms/components/<name>.md` before using.** Never rely on old patterns.
8. **UI Styling**:
   - **Tailwind CSS ONLY**: No custom CSS for layout/styling.
   - **Icons**: Use `PrimeIcons` (e.g., `<i class="pi pi-home"></i>`).
   - **Dark Mode**: ALL components MUST support dark mode (`dark:` prefix).
9. **Build Integrity**: MUST fix all `[WARNING]` logs during build.
10. **Global UI**: `<p-toast>` and `<p-confirmDialog>` in `app.html` only. Use `key: 'confirmDialog'`.
11. **Seed Data Sync**: Update `tools/seed.ts` for new permissions.
12. **API Docs Sync**: Update `http/api.http` and `http/postman_collection.json` for API changes.
13. **Async/Await**: Use `async/await` + `firstValueFrom` + `try/catch/finally` for user actions.
14. **Testing Protocol**:
    - Localhost: UI/Layout only.
    - Chrome Extension: Must test in actual loaded extension.
15. **UI Consistency**: Clone existing Master Template for new features. No reinventing patterns.
16. **HTML ID Naming**: ALWAYS add `id` attributes. Format: `[feature]-[section]-[index]`.
17. **Tauri IPC Sync (CRITICAL)**: When adding new enum values, types, or string literals that cross the Tauri IPC boundary (Angular `invoke()` → Rust `#[tauri::command]`), MUST update BOTH sides simultaneously. Checklist:
    - Frontend sends new value via `invoke()` → Rust `match` statement MUST handle it.
    - Rust command adds new param → Frontend `LaunchBrowserOptions` (or equivalent interface) MUST include it.
    - New `BrowserType` or similar union type → Rust `launch_browser` match + `list_available_browsers` MUST be updated.
    - **Never assume the backend already handles a new value just because the TypeScript type allows it.**
18. **Mandatory Self-Audit (CRITICAL)**: After completing any feature/code task, ALWAYS perform a self-audit (following `/audit` workflow principles) before marking the task as done. Only conclude a task when:
    - Build passes with ZERO warnings
    - Code follows ALL conventions in this file (dark mode, naming, host class, signals, etc.)
    - No dead code, unused imports, or `console.log` left behind
    - Security best practices applied (input validation, sanitization, error handling)
    - Performance rules followed (no unnecessary re-renders, proper cleanup)
    - Refactor and optimize code BEFORE finishing — never ship sloppy code
    - Always read `.gemini/GEMINI.md` BEFORE writing any code
19. **No Fabrication — Verify Before Describing (CRITICAL)**:
    - NEVER describe UI flows, button behaviors, or feature capabilities **without first reading the actual source code** (`.html` for template, `.ts` for handlers).
    - Seeing a button labeled "Play" does NOT mean it works. **Check for `(click)` or `(onClick)` handler in the template.** No handler = dead button = do not describe as functional.
    - When writing documentation, user guides, or feature descriptions: **every claim must be traceable to a specific line of code**. If you cannot point to the handler/logic, do not write it.
    - Clearly distinguish between **"what exists"** vs **"what should exist"**. If a feature is not implemented, write "chưa hoạt động" — never describe it as if it works.
    - When in doubt, **ask the user** rather than assume. Wrong documentation is worse than no documentation.

## ⚡ Performance Rules (MANDATORY)

**Khi dùng setInterval/setTimeout:**
- Interval >= 30 giây cho background tasks
- PHẢI cleanup ở `ngOnDestroy()`
- PHẢI pause khi tab hidden (visibility API)
- Callback KHÔNG được tạo objects mới nếu data không đổi

**Khi update signal/state:**
- KHÔNG tạo array/object mới nếu data giống nhau
- Check `hasChanges` trước khi `.set()` hoặc `.update()`
- Giữ nguyên reference nếu item không thay đổi

**Template:**
- KHÔNG dùng getter methods → Dùng signal/computed
- Computed signals đã có caching tự động

**Subscription:**
- Observable PHẢI dùng `takeUntilDestroyed()` hoặc unsubscribe
- Event listener PHẢI có `removeEventListener` ở destroy
