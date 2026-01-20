# Project Overview

## Purpose
Chrome Profile Manager - Angular web application for managing Chrome browser profiles.

## Tech Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Angular | v21.1.0 |
| Language | TypeScript | v5.9.2 |
| UI Library | PrimeNG | v21.0.4 |
| Styling | Tailwind CSS | v4.1.12 |
| State | Angular Signals | Built-in |
| Backend | Firebase | v12.8.0 |
| AI | Genkit | Latest |

## Firebase Services
- Authentication
- Firestore Database
- Cloud Functions
- Cloud Storage
- Hosting

## Key Features
- Firebase Emulator support
- Dark mode ready
- PrimeNG Aura theme
- Tailwind CSS integration

## Project Structure
```
src/
├── app/
│   ├── views/pages/      # Feature pages
│   ├── shared/           # Shared components
│   ├── services/         # Business logic
│   ├── app.ts            # Root component
│   ├── app.config.ts     # Providers
│   └── app.routes.ts     # Routing
├── environments/         # Env configs
└── styles.css            # Global styles
functions/                # Cloud Functions + Genkit
```
