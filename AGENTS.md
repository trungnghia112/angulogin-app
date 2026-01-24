
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
