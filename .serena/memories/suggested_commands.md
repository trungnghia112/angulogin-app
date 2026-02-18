# Suggested Commands

## Development
| Command | Description |
|---------|------------|
| `npm run start` | Start Angular dev server (`ng serve`) |
| `npm run build` | Production build (`ng build`) |
| `npm run watch` | Dev build with watch mode |
| `npm run tauri:dev` | Start Tauri desktop app in dev mode |
| `npm run tauri:build` | Build Tauri desktop app for release |

## Firebase
| Command | Description |
|---------|------------|
| `firebase emulators:start` | Start Firebase emulators (Auth, Firestore, Functions, Storage) |
| `firebase deploy` | Deploy all Firebase services |
| `firebase deploy --only functions` | Deploy Cloud Functions only |
| `firebase deploy --only firestore:rules` | Deploy Firestore rules only |
| `firebase deploy --only storage` | Deploy Storage rules only |

## Git
| Command | Description |
|---------|------------|
| `git add -A && git commit -m "type: message"` | Standard commit (feat/fix/refactor/chore) |
| `git push` | Push to remote |
| `git log -n 10 --oneline` | View recent commits |

## System Utilities (macOS/Darwin)
| Command | Description |
|---------|------------|
| `grep -r "pattern" src/` | Search in source files |
| `find src -name "*.ts"` | Find TypeScript files |
| `ls -la` | List directory contents |
