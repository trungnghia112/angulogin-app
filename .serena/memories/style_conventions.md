# Code Style & Conventions

## Component Naming (STRICT)
- **Files**: `[name].ts`, `[name].html`, `[name].css` - NO `.component.ts`
- **Class**: `export class [Name]` - NO `Component` suffix
- **Folder**: Each component in its own subfolder at `src/app/views/pages/[feature]/[component-name]/`

## Component Requirements
- MANDATORY: Use `templateUrl` and `styleUrl` (separate files)
- FORBIDDEN: Inline `template:` or `styles: []`
- Set `changeDetection: ChangeDetectionStrategy.OnPush`
- Use `input()` and `output()` functions, not decorators
- Use `computed()` for derived state

## Templates
- Use native control flow: `@if`, `@for`, `@switch`
- NO: `*ngIf`, `*ngFor`, `*ngSwitch`
- Use `class` bindings, NOT `ngClass`
- Use `style` bindings, NOT `ngStyle`

## Services
- Use `providedIn: 'root'` for singletons
- Use `inject()` function, not constructor injection

## Styling
- **Tailwind CSS ONLY** - no custom CSS for layout
- **Dark Mode**: All components MUST support `dark:` classes
- **Icons**: Use PrimeIcons (`<i class="pi pi-home"></i>`)

## HTML IDs
- ALWAYS add `id` attributes
- Format: `[feature]-[section]-[index]`
