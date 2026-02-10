# Suggested Commands

## Development
```bash
npm start              # Start Angular dev server at localhost:4200 (browser mode, mock backend)
npm run build          # Production build to dist/
npm run watch          # Build with watch mode
npm run tauri dev      # Start Tauri desktop dev (Angular + Rust backend)
npm run tauri build    # Build production desktop app
```

## Firebase
```bash
firebase emulators:start   # Start Firebase emulators (Firestore, Functions, Auth)
firebase deploy            # Deploy to Firebase Hosting + Functions
```

## Git Commands (Semantic Commits)
```bash
git add -A && git commit -m "feat: description"
git add -A && git commit -m "fix: description"
git add -A && git commit -m "refactor: description"
git add -A && git commit -m "chore: description"
git push origin main
```

## Angular CLI
```bash
ng generate component path/to/component-name  # Generate component
ng generate service services/service-name     # Generate service
ng serve --port 4201                          # Custom port
```

## Build Validation
```bash
npm run build    # MUST run after every code change (per project rules)
```
