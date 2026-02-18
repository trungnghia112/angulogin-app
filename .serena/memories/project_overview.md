# Chrome Profile Manager - Project Overview

## Purpose
A desktop application for managing and organizing Chrome/Camoufox browser profiles with advanced anti-detect features. Built as a Tauri desktop app with Angular frontend and Firebase backend.

## Tech Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | Angular | 21.1.1 |
| Desktop Runtime | Tauri | 2.x (Rust backend) |
| UI Components | PrimeNG | 21.0.4 |
| CSS Framework | Tailwind CSS | 4.1.18 |
| Theme System | PrimeUIX Themes (Aura preset, Fuchsia primary) | 2.0.3 |
| Icons | PrimeIcons | 7.0.0 |
| Backend/BaaS | Firebase (Auth, Firestore, Functions, Storage) | 12.8.0 |
| Language (Frontend) | TypeScript | 5.9.3 |
| Language (Backend) | Rust (Tauri), TypeScript (Functions) | - |
| State Management | Angular Signals | - |
| Change Detection | Zoneless (provideZonelessChangeDetection) | - |
| Charts | Chart.js | 4.5.1 |

## Key Features
- Browser profile management (create, edit, organize with folders)
- Anti-detect browser support via Camoufox integration
- Proxy management and relay
- Browser fingerprint management
- Cookie import/export
- Extension management
- Team collaboration
- Automation workflows
- Schedule management
- Activity logging
- Storage & usage dashboards
- Command palette (Ctrl+K style)
- Dark mode support (.dark class toggle)

## Architecture
- **Zoneless Angular**: No Zone.js, uses `provideZonelessChangeDetection()`
- **Standalone Components**: All components are standalone (Angular 21 default)
- **Lazy Loading**: All page routes use `loadComponent()` 
- **Firebase Emulator Support**: Full emulator support for Auth, Firestore, Functions, Storage
- **PrimeNG Dark Mode**: Uses `.dark` CSS class selector (not system preference)
- **Global Error Handler**: Custom `GlobalErrorHandler` class
