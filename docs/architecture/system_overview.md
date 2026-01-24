# System Architecture: Chrome Profile Manager

## Overview
Chrome Profile Manager is a desktop application built with **Angular (v21)** and **Tauri (v2)** to manage multiple browser profiles across different vendors (Chrome, Brave, Edge, Arc).

## Tech Stack
- **Frontend**: Angular 21 (Signals, Standalone Components)
- **UI Architecture**: PrimeNG 21 + Tailwind CSS 4
- **Persistence Layer**: Firebase Console (Hosting) + Google Cloud (Authentication)
- **Database**: Cloud Firestore
- **Desktop Runtime**: Tauri (Rust backend core)

## Core Modules

### 1. Navigation Rail (`MainNav`)
- Global navigation icons
- Dark/Light mode toggle
- User profile & settings access
- Theme persistence via `localStorage`

### 2. Organizational Sidebar (`Sidebar`)
- Folder/Group management
- Profiles directory scanner
- Quick actions (Export, Trash)

### 3. Management Workspace (`Home`)
- Data Table & Grid views
- Search & Advanced filtering (Signal-based)
- Profile operations (Launch, Edit, Clone)

## Security Model
- **Client-side**: `.env` variables for sensitive tokens (Stitch, etc.) - *Ignored in Git*
- **Server-side**: Firestore Security Rules (RBAC) requiring authentication and user ID validation (`isAuthenticated()` & `isOwner()`).

## Rendering Patterns
- **Standard**: Semantic PrimeNG components
- **Styling**: Tailwind CSS v4 logic for Dark Mode (`dark:`)
- **Tone**: Professional SaaS Gray Palette
