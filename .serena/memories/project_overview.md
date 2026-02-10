# Project Overview

## Purpose
**Chrome Profile Manager** - A cross-platform desktop application for managing Chrome browser profiles.
Allows users to create, organise, launch, and monitor multiple Chrome browser profiles with distinct settings,
proxies, extensions, and usage tracking.

## Tech Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Angular | v21.1.0 |
| Language | TypeScript | v5.9.2 |
| UI Library | PrimeNG | v21.0.4 |
| Styling | Tailwind CSS | v4.1.12 |
| State | Angular Signals | Built-in |
| Desktop Shell | Tauri (Rust) | v2 |
| Backend (Cloud) | Firebase | v12.8.0 |
| AI | Genkit | Latest |

## Firebase Services
- Authentication
- Firestore Database
- Cloud Functions
- Cloud Storage
- Hosting

## Key Features
- **Profile Management**: Create, rename, duplicate, delete, import/export browser profiles
- **Multi-Browser Support**: Chrome, Brave, Edge, Arc, Opera, Vivaldi, Chromium
- **Proxy Management**: Per-profile proxy config, proxy rotation, health checks
- **Folder Organisation**: Custom folders with color/icon, drag-and-drop profiles
- **Usage Tracking**: Launch count, session duration, daily/weekly activity heatmap
- **Storage Dashboard**: Profile size analysis, health checks, cleanup suggestions
- **Activity Log**: Track all profile actions (create, launch, delete, etc.)
- **Extensions Manager**: Install extensions across multiple profiles at once
- **Command Palette**: Quick-launch profiles via keyboard shortcut
- **Dark Mode**: Full PrimeNG + Tailwind dark mode support
- **Settings**: Appearance customisation (theme, scale, surface), auto-backup, browser paths
- **Tauri Desktop**: Native file system access, process management via Rust backend
- **Mock Backend**: Browser-based dev mode with localStorage mock data

## Desktop Architecture
The app runs as a Tauri v2 desktop application:
- **Frontend**: Angular SPA served inside a Tauri webview
- **Backend**: Rust commands in `src-tauri/src/commands.rs` provide native file system operations
- **Fallback**: `MockProfileBackend` allows development in browser without Tauri
- **Backend Interface**: `ProfileBackend` interface defines the contract between frontend and native layer

## Running Modes
- `ng serve` — browser dev mode (uses MockProfileBackend)
- `tauri dev` — desktop dev mode (uses TauriProfileBackend with real FS)
- `tauri build` — production desktop build
