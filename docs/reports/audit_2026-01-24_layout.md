# Audit Report - 2026-01-24 - Layout & Style

## Summary
- 🔴 Critical Issues: 1 (Hardcoded Zinc Colors)
- 🟡 Warnings: 1 (Heavy usage of raw HTML Buttons)
- 🟢 Suggestions: 1 (Component Standardization)

## 🔴 Critical Issues
1. **Hardcoded Zinc Colors in Extensions View**
   - File: `src/app/views/pages/extensions/extensions.html`
   - Problem: Uses `bg-zinc-200`, `bg-zinc-300`.
   - Danger: These colors **DO NOT** adapt to the new Slate-based, Inverted Dark Mode scheme. They will look out of place (too dark or too light) and inconsistent with the rest of the app.
   - Fix: Replace with `bg-surface-200`, `bg-surface-300`.

## 🟡 Warnings
1. **Inconsistent Button Implementation**
   - Files: `home.html`, `sidebar.html`, `extensions.html`.
   - Problem: Mixing `<p-button>` (PrimeNG) with raw `<button class="...">` (Tailwind).
   - Impact: Inconsistent hover states, focus rings, and touch targets.
   - Recommendation: Convert "Action" buttons to `<p-button>` where possible. For "List Items" (like Sidebar folders), ensure they use standard `hover:bg-surface-100` classes.

## 🟢 Suggestions
1. **Semantic Layer**
   - Consider defining semantic classes like `.btn-list-item` if raw buttons are needed, to avoid repeating Tailwind classes.

## Next Steps
- [ ] Fix `extensions.html` immediately.
- [ ] Review `home.html` grid card buttons.
