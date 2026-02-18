# Codebase Structure

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
│   ├── profile.model.ts
│   ├── column-config.model.ts
│   ├── folder.model.ts
│   └── navigation.model.ts
├── services/
│   ├── profile.service.ts          # Profile state/logic
│   ├── profile.backend.ts          # Profile persistence (Tauri/Firebase)
│   ├── profile.backend.interface.ts # Backend abstraction
│   ├── folder.service.ts           # Folder management
│   ├── proxy.service.ts            # Proxy management
│   ├── camoufox.service.ts         # Camoufox browser integration
│   ├── schedule.service.ts         # Scheduling
│   ├── activity-log.service.ts     # Activity logging
│   ├── geoip.service.ts            # GeoIP lookup
│   └── navigation.service.ts       # App navigation state
├── mocks/                  # Mock data
└── views/
    ├── components/         # Shared components
    │   ├── main-nav/               # Main navigation sidebar
    │   ├── command-palette/        # Ctrl+K command palette
    │   └── column-settings-panel/  # Table column customization
    └── pages/
        ├── pages.ts / pages.html   # Layout wrapper
        ├── home/                   # Main profiles page (/browsers)
        │   ├── home.ts/.html/.css
        │   ├── profile-table/      # Profile data table
        │   ├── profile-toolbar/    # Toolbar actions
        │   ├── profile-edit-dialog/ # Edit profile dialog
        │   └── home-sidebar/       # Folder sidebar
        ├── automation/     # Automation page
        ├── teams/          # Teams page
        ├── extensions/     # Extensions page
        ├── settings/       # Settings page
        ├── storage-dashboard/   # Storage dashboard
        └── usage-dashboard/     # Usage dashboard
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

## Tauri Backend (`src-tauri/src/`)
```
src-tauri/src/
├── main.rs                 # Entry point
├── lib.rs                  # Library root
├── commands.rs             # Tauri IPC commands
├── camoufox_manager.rs     # Camoufox browser lifecycle
├── camoufox_downloader.rs  # Download Camoufox binary
├── camoufox_env.rs         # Camoufox environment setup
├── cookies.rs              # Cookie management
├── proxy_relay.rs          # Proxy relay server
└── fingerprint/            # Browser fingerprint module
```

## Firebase Functions (`functions/src/`)
```
functions/src/
└── index.ts                # Cloud Functions entry point
```
