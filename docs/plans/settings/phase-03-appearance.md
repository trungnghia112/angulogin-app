# Phase 03: Appearance Tab (Dynamic Theme)
Status: ✅ Complete

## Objective
Implement users' ability to change the App's Primary Color and Scale dynamically.

## Requirements
### Functional
- [x] UI: Color Palette selection (Circle buttons).
- [x] UI: Scale Slider (Small/Normal/Large).
- [x] Logic: Injecting CSS Variable overrides to `document.documentElement`.
  - Override `--p-primary-50` to `--p-primary-950`.
  - Override `font-size` on root.

## Implementation Steps
1. [x] Define color palettes map (Hex codes for Indigo, Fuchsia, Cyan, Orange, etc.).
2. [x] Create `ThemeService` (or method in Store) to apply variables.
3. [x] Bind UI elements in `SettingsDialog` to Store.

## Technical Note
Since we use `definePreset`, changing the *definition* at runtime is hard.
We will use **CSS Variable Mapping** strategy:
`--p-primary-500` will be updated via JS to match the selected color.
