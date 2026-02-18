# Style Guide & Conventions

## Component Naming
- Files: `[name].ts`, `[name].html`, `[name].css` (NO `.component.ts`)
- Classes: `export class [Name]` (NO `Component` suffix)
- Each component in its own subfolder: `src/app/views/pages/[feature]/[component-name]/`
- Use `templateUrl` and `styleUrl` (separate files, NEVER inline)

## Angular Patterns
- Standalone components (default in Angular 21, do NOT set `standalone: true`)
- `changeDetection: ChangeDetectionStrategy.OnPush` on all components
- Page components MUST have `host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' }`
- Use `input()` / `output()` functions instead of decorators
- Use `inject()` instead of constructor injection
- Use `computed()` for derived state
- Native control flow: `@if`, `@for`, `@switch`
- Reactive forms preferred over template-driven

## State Management
- Angular Signals for local state
- `computed()` for derived state
- NO `mutate()` on signals; use `update()` or `set()`
- Check `hasChanges` before `.set()` / `.update()`

## Styling
- **Tailwind CSS ONLY** (no custom CSS for layout/styling)
- PrimeIcons for icons: `<i class="pi pi-home"></i>`
- Dark mode: ALL components MUST support `dark:` prefix
- PrimeNG: use `class` NOT `styleClass`
- Surface colors NOT inverted in dark mode; always add `dark:` variants

## Code Quality
- Strict TypeScript checking; avoid `any`
- NO emojis in code/comments
- HTML IDs: `[feature]-[section]-[index]`
- `async/await` + `firstValueFrom` + `try/catch/finally` for user actions
- Observables MUST use `takeUntilDestroyed()` or explicit unsubscribe
- Firestore: never pass `undefined`, use `null` instead
