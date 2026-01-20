# Design Specifications - Chrome Profile Manager

## 🎨 Design Direction
**Style:** Dark, Modern, Minimal (inspired by Raycast, Linear, Arc)
**Mood:** Professional utility app with premium feel

---

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Primary | `#6366F1` | Accent, buttons, focus |
| Primary Hover | `#818CF8` | Hover states |
| Secondary | `#22D3EE` | Success, launch button |
| Background | `#0F0F0F` | Main app background |
| Surface | `#1A1A1A` | Cards, inputs |
| Surface Hover | `#262626` | Card hover |
| Border | `#2E2E2E` | Subtle borders |
| Text | `#FAFAFA` | Primary text |
| Text Muted | `#71717A` | Secondary text |

---

## Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| App Title | Inter | 24px | 700 |
| Section Title | Inter | 14px | 600 |
| Profile Name | Inter | 16px | 600 |
| Path Text | Inter | 12px | 400 |
| Button | Inter | 14px | 500 |

---

## Spacing

| Name | Value |
|------|-------|
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 32px |

---

## Border Radius

| Element | Value |
|---------|-------|
| Cards | 12px |
| Buttons | 8px |
| Inputs | 8px |
| Avatars | 50% |

---

## Shadows

| Name | Value |
|------|-------|
| Card | `0 4px 12px rgba(0,0,0,0.4)` |
| Elevated | `0 8px 24px rgba(0,0,0,0.6)` |

---

## Component Specs

### Profile Card
- Background: `#1A1A1A`
- Border: `1px solid #2E2E2E`
- Hover: Scale 1.02 + border color `#6366F1`
- Avatar: 48px circle with gradient background
- Cursor: pointer

### Input Field
- Background: `#1A1A1A`
- Border: `1px solid #2E2E2E`
- Focus: Border `#6366F1` + ring

### Launch Button
- Background: Gradient `#22D3EE` → `#06B6D4`
- Hover: Brightness 1.1
- Icon: Play arrow

---

## Animations

| Action | Duration | Easing |
|--------|----------|--------|
| Hover | 200ms | ease-out |
| Focus | 150ms | ease-in-out |
| Card appear | 300ms | ease-out |
