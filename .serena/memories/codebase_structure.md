# Codebase Structure

```
chrome-profile-manager/
├── src/
│   ├── app/
│   │   ├── app.ts           # Root component (class App)
│   │   ├── app.html         # Root template (placeholder)
│   │   ├── app.css          # Root styles
│   │   ├── app.config.ts    # App configuration (providers)
│   │   └── app.routes.ts    # Routes (empty)
│   ├── index.html           # Entry HTML
│   ├── main.ts              # Bootstrap entry
│   └── styles.css           # Global styles
├── public/                  # Static assets
├── .agent/                  # AI workflow configs
├── .gemini/                 # Gemini AI configs
├── angular.json             # Angular workspace config
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
└── AGENTS.md                # AI agent instructions
```

## Key Symbols

| Symbol | Type | File | Purpose |
|--------|------|------|---------|
| `App` | Class | `src/app/app.ts` | Root component |
| `appConfig` | Constant | `src/app/app.config.ts` | Application providers |
| `routes` | Constant | `src/app/app.routes.ts` | Route definitions |
