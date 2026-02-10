# Codebase Structure

## Top-Level Directory
```
chrome-profile-manager/
├── src/                    # Angular frontend source
├── src-tauri/              # Tauri/Rust desktop backend
├── functions/              # Firebase Cloud Functions + Genkit
├── scripts/                # Utility scripts (add-dark-mode.mjs)
├── public/                 # Static assets
├── docs/                   # Documentation
├── plans/                  # Feature planning docs
├── .agent/                 # AI workflow configs (AWF)
├── .gemini/                # Gemini AI configs
├── .brain/                 # AWF brain data
├── angular.json            # Angular workspace config
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── firebase.json           # Firebase project config
├── firestore.rules         # Firestore security rules
├── storage.rules           # Storage security rules
└── AGENTS.md               # AI agent instructions
```

## Frontend: src/app/

### Root
| File | Symbol | Purpose |
|------|--------|---------|
| `app.ts` | `App` (class) | Root component, hosts command palette, global keyboard handler |
| `app.html` | — | Root template |
| `app.config.ts` | `appConfig`, `MyPreset` | App providers, PrimeNG theme preset |
| `app.routes.ts` | `routes` | Route definitions with lazy-loaded pages |
| `main.ts` | — | Bootstrap entry point |
| `styles.css` | — | Global styles |

### Routes
| Path | Component | Description |
|------|-----------|-------------|
| `/browsers` (default) | `Home` | Main profile management page |
| `/automation` | `Automation` | Automation workflows (placeholder) |
| `/teams` | `Teams` | Team collaboration (placeholder) |
| `/extensions` | `Extensions` | Bulk extension installer |
| `/settings` | `Settings` | App settings & configuration |
| `/storage` | `StorageDashboard` | Profile storage analysis |
| `/usage` | `UsageDashboard` | Usage statistics & activity log |

All routes are children of `Pages` layout component.

### Models (src/app/models/)
| File | Symbols | Purpose |
|------|---------|---------|
| `profile.model.ts` | `Profile`, `ProfileMetadata`, `ProxyRotationConfig`, `WindowPosition`, `AppSettings`, `BrowserType` | Core profile data models |
| `folder.model.ts` | `Folder`, `ProfileNote`, `ProfileProxy`, `ProfileTag`, `ProfileStatus` | Folder, proxy, tag, note models |
| `navigation.model.ts` | `NavFeature`, `NAV_FEATURES` | Navigation feature definitions |

### Core (src/app/core/)
| File | Symbols | Purpose |
|------|---------|---------|
| `constants/themes.const.ts` | `APP_THEMES`, `APP_SURFACES` | Theme color definitions |
| `utils/platform.util.ts` | `isTauriAvailable()`, `isWebDevMode()` | Platform detection helpers |
| `utils/logger.util.ts` | `debugLog()` | Debug logging utility |
| `models/settings.model.ts` | `AppSettings`, `AppearanceSettings`, `BrowserSettings`, `GeneralSettings` | Settings model (old/duplicate?) |
| `services/settings.service.ts` | `SettingsService` | Settings management with 20+ methods for theme, backup, paths |

### Services (src/app/services/)
| File | Symbol | Key Methods |
|------|--------|-------------|
| `profile.service.ts` | `ProfileService` | scanProfiles, createProfile, deleteProfile, launchBrowser, duplicateProfile, backupProfile, etc. |
| `profile.backend.interface.ts` | `ProfileBackend` (interface) | Contract: scanProfiles, createProfile, launchBrowser, etc. |
| `profile.backend.ts` | `MockProfileBackend`, `TauriProfileBackend` | Two backend implementations |
| `folder.service.ts` | `FolderService` | CRUD for custom folders (localStorage) |
| `proxy.service.ts` | `ProxyService` | CRUD for proxies, health checks, import/export, rotation |
| `activity-log.service.ts` | `ActivityLogService` | Log profile actions, get recent/today entries |
| `navigation.service.ts` | `NavigationService` | Manage active nav feature, sidebar state |

### Components (src/app/views/components/)
| Component | Symbol | Purpose |
|-----------|--------|---------|
| `main-nav/` | `MainNav` | Left navigation bar with features, theme toggle |
| `command-palette/` | `CommandPalette` | Quick search & launch profiles |

### Pages (src/app/views/pages/)
| Page | Symbol | Key Functionality |
|------|--------|-------------------|
| `pages.ts` | `Pages` | Layout wrapper (nav + content) |
| `home/home.ts` | `Home` | **Main page** — profile table, toolbar, sidebar, dialogs (60+ methods) |
| `home/profile-toolbar/` | `ProfileToolbar` | Search, filter, sort, view mode, actions |
| `home/home-sidebar/` | `HomeSidebar` | Folder navigation sidebar |
| `home/profile-edit-dialog/` | `ProfileEditDialog` | Edit profile metadata (browser, proxy, color, etc.) |
| `settings/` | `Settings` | App settings (appearance, browser, backup, proxy) |
| `extensions/` | `Extensions` | Install extensions to multiple profiles |
| `automation/` | `Automation` | Placeholder |
| `teams/` | `Teams` | Placeholder |
| `storage-dashboard/` | `StorageDashboard` | Storage analysis, charts, health checks |
| `usage-dashboard/` | `UsageDashboard` | Usage stats, activity heatmap, CSV export |

## Backend: src-tauri/
```
src-tauri/
├── src/
│   ├── main.rs         # Tauri app entry
│   ├── lib.rs          # Tauri plugin setup, command registration
│   └── commands.rs     # All Rust commands (scan, create, delete, launch, backup, etc.)
├── Cargo.toml          # Rust dependencies
├── tauri.conf.json     # Tauri configuration
├── capabilities/       # Tauri v2 capability permissions
├── icons/              # App icons
└── gen/                # Auto-generated Tauri code
```

## Cloud Functions: functions/
```
functions/
├── src/
│   ├── index.ts            # Cloud Functions entry
│   └── genkit-sample.ts    # Genkit AI integration sample
├── package.json
└── tsconfig.json
```

## Environments
| File | Purpose |
|------|---------|
| `environment.ts` | Active environment (imports dev or prod) |
| `environment.dev.ts` | Development config (emulators, debug) |
| `environment.prod.ts` | Production config |
