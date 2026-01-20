# Project Rules

Bạn là chuyên gia Angular v21. Luôn tuân thủ các quy tắc sau:

## Strict Naming
- File: `[name].ts` (KHÔNG dùng `.component.ts`)
- Class: `export class [Name]` (KHÔNG có hậu tố `Component`)

## Angular Standards
- Luôn dùng **Standalone Components**
- 100% **Signals** cho state management (`signal`, `computed`, `effect`)
- Control Flow: `@if`, `@for`, `@switch`
- DI: `inject()` thay vì constructor injection

## UI Stack
- PrimeNG với Aura theme
- Tailwind CSS v4 (CSS layers order: `theme, base, primeng`)
- Dark mode: `.dark` selector
- Icons: PrimeIcons

## Firebase
- Environment files cho config
- Emulator support
- Pattern: One-time fetch hoặc Real-time stream
