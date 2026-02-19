# Codebase Structure (Updated 2026-02-19)

## Root Layout
```
chrome-profile-manager/
├── src/                    # Angular frontend source
├── src-tauri/              # Tauri/Rust backend
├── functions/              # Firebase Cloud Functions
├── public/                 # Static assets
├── docs/                   # Documentation & reports
├── scripts/                # Build/utility scripts
├── plans/                  # Feature planning docs
├── .brain/                 # Project memory/context
├── .agent/                 # AWF workflow definitions
├── .shared/                # Shared resources
├── .artifacts/             # Build/CI artifacts
├── firestore.rules         # Firestore security rules
├── storage.rules           # Storage security rules
├── firebase.json           # Firebase config
├── angular.json            # Angular CLI config
├── package.json            # Node dependencies
└── AGENTS.md               # AI agent instructions
```

## Frontend (`src/app/`)
```
src/app/
├── app.ts / app.html / app.css / app.config.ts / app.routes.ts
├── core/
│   ├── constants/          # themes.const.ts
│   ├── utils/              # platform.util.ts, logger.util.ts, validation.util.ts
│   ├── models/             # settings.model.ts
│   ├── handlers/           # global-error.handler.ts
│   └── services/           # settings.service.ts, column-config.service.ts
├── models/
│   ├── profile.model.ts    # Profile, ProfileMetadata, WindowPosition, ProxyRotationConfig, BrowserType
│   ├── column-config.model.ts
│   ├── folder.model.ts
│   └── navigation.model.ts
├── services/
│   ├── profile.service.ts          # Profile state/logic (33 methods)
│   ├── profile.backend.ts          # Profile persistence (Tauri/Firebase)
│   ├── profile.backend.interface.ts # Backend abstraction
│   ├── browser-manager.service.ts  # Browser download/install management
│   ├── camoufox.service.ts         # Camoufox antidetect browser integration
│   ├── folder.service.ts           # Folder CRUD + tree structure
│   ├── proxy.service.ts            # Proxy CRUD, import/export, health check, rotation
│   ├── schedule.service.ts         # Scheduling
│   ├── activity-log.service.ts     # Activity logging
│   ├── geoip.service.ts            # GeoIP lookup
│   └── navigation.service.ts       # App navigation state
├── mocks/                  # Mock data (profile.mock.ts)
└── views/
    ├── components/         # Shared components
    │   ├── main-nav/               # Main navigation sidebar
    │   ├── command-palette/        # Ctrl+K command palette
    │   ├── column-settings-panel/  # Table column customization
    │   └── onboarding-dialog/      # First-run onboarding wizard
    └── pages/
        ├── pages.ts / pages.html / pages.css   # Layout wrapper
        ├── home/                   # Main profiles page (/browsers)
        │   ├── home.ts/.html/.css
        │   ├── profile-table/      # Profile data table
        │   ├── profile-toolbar/    # Toolbar actions
        │   ├── profile-edit-dialog/ # Edit profile dialog
        │   ├── download-browser-dialog/ # Browser download dialog
        │   └── home-sidebar/       # Folder sidebar
        ├── automation/             # Automation page
        ├── teams/                  # Teams page
        ├── extensions/             # Extensions page
        ├── settings/               # Settings page
        ├── storage-dashboard/      # Storage dashboard
        ├── usage-dashboard/        # Usage dashboard
        └── fingerprint-checker/    # Fingerprint verification page
```

## Routes
| Path | Component | Description |
|------|-----------|------------|
| `/` | Redirects to `/browsers` | Default |
| `/browsers` | Home | Main profile management |
| `/automation` | Automation | Automation workflows |
| `/teams` | Teams | Team collaboration |
| `/extensions` | Extensions | Extension management |
| `/settings` | Settings | App settings |
| `/storage` | StorageDashboard | Storage overview |
| `/usage` | UsageDashboard | Usage analytics |
| `/fingerprint-checker` | FingerprintChecker | Browser fingerprint verification |

## Key Services
| Service | File | Responsibility |
|---------|------|---------------|
| ProfileService | profile.service.ts | Profile CRUD, launch browser, templates, cookies, backup/restore |
| BrowserManagerService | browser-manager.service.ts | Browser download, install status, antidetect flags |
| CamoufoxService | camoufox.service.ts | Camoufox browser lifecycle (launch/stop), fingerprint generation |
| ProxyService | proxy.service.ts | Proxy CRUD, import/export, health check, rotation groups |
| FolderService | folder.service.ts | Folder tree management, system vs custom folders |
| SettingsService | core/services/settings.service.ts | App settings persistence |
| ColumnConfigService | core/services/column-config.service.ts | Table column configuration |
| NavigationService | navigation.service.ts | App navigation state |
| ScheduleService | schedule.service.ts | Task scheduling |
| ActivityLogService | activity-log.service.ts | User activity logging |
| GeoIPService | geoip.service.ts | IP geolocation lookups |

## Key Models (profile.model.ts)
- **Profile**: id, name, path, size, isRunning, osIcon, metadata
- **ProfileMetadata**: browser, proxy settings, fingerprint config, launch settings, tags, folders, usage stats, window position, 35+ fields
- **ProxyRotationConfig**: enabled, mode, proxyGroupId, currentProxyIndex, lastRotatedAt
- **WindowPosition**: x, y, width, height, maximized
- **BrowserType**: Union type for supported browsers

## Tauri Backend (`src-tauri/src/`)
```
src-tauri/src/
├── main.rs                 # Entry point
├── lib.rs                  # Library root, Tauri command registration
├── commands.rs             # All Tauri IPC commands (~50+ commands)
├── camoufox_manager.rs     # Camoufox browser lifecycle
├── camoufox_downloader.rs  # Download Camoufox binary
├── camoufox_env.rs         # Camoufox environment setup
├── cookies.rs              # Cookie import/export with encryption
├── proxy_relay.rs          # Proxy relay server
├── browser_manager/        # Browser download & install module
│   ├── mod.rs              # Module root
│   ├── download.rs         # Download logic
│   └── platform.rs         # Platform-specific paths
└── fingerprint/            # Browser fingerprint module
    ├── mod.rs              # Module root
    ├── generator.rs        # Fingerprint generation (seeded)
    ├── types.rs            # Fingerprint data types
    └── data.rs             # Fingerprint data pools
```

### Key Rust Commands (commands.rs)
- Profile CRUD: scan_profiles, create_profile, rename_profile, delete_profile, duplicate_profile
- Browser Launch: launch_browser, list_available_browsers, get_native_antidetect_flags
- Cookies: import_cookies, export_cookies (with AES-GCM encryption)
- Camoufox: check_camoufox_installed, download_camoufox, get_camoufox_version_info
- Browser Manager: check_browser_installed, download_browser, get_browser_version_info
- Fingerprint: generate_fingerprint, to_camoufox_config
- Proxy: start_proxy_relay, stop_proxy_relay, get_active_relay_ports
- Profile Health: check_profile_health, get_profile_size
- Backup/Restore: backup_profile, restore_from_backup
- Templates: save_as_template, create_from_template, list_templates, delete_template
- Bulk Ops: bulk_create_profiles, bulk_export_profiles, scan_multiple_paths

## Firebase Functions (`functions/src/`)
```
functions/src/
└── index.ts                # Cloud Functions entry point
```
