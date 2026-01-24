# Profile Architecture Refactor

## Objective
Refactor the profile management system to use a dedicated storage location (like GoLogin, MultiLogin) instead of pointing directly to Chrome's User Data directory.

## Current Problems
1. `scan_profiles` shows ALL folders in Chrome directory (including system folders)
2. `launch_browser` uses wrong Chrome flags, creating new profiles instead of using existing ones
3. Default path points to Chrome's directory which mixes managed profiles with Chrome's internal data

## Target Architecture

### New Default Paths
| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/ChromeProfileManager/Profiles` |
| Windows | `%APPDATA%/ChromeProfileManager/Profiles` |
| Linux | `~/.config/ChromeProfileManager/Profiles` |

### Profile Types
1. **Managed Profiles** (created by our app)
   - Stored in our default directory
   - Each profile is a complete User Data directory
   - Launch: `chrome --user-data-dir="/path/to/our/ProfileABC"`

2. **Native Chrome Profiles** (optional advanced feature)
   - Filter to show only `Default`, `Profile 1`, `Profile N`
   - Launch: `chrome --user-data-dir="/path/to/Chrome" --profile-directory="Profile 2"`

## Implementation Phases

### Phase 1: Update Default Path Constants ✅
- [ ] Update `MACOS_CHROME_PATH` → `Library/Application Support/ChromeProfileManager/Profiles`
- [ ] Update `WINDOWS_CHROME_PATH` → `AppData/Roaming/ChromeProfileManager/Profiles`
- [ ] Update `LINUX_CHROME_PATH` → `.config/ChromeProfileManager/Profiles`

### Phase 2: Fix scan_profiles (Rust)
- [ ] Add helper function `is_valid_chrome_profile(path)` 
- [ ] Check for `Preferences` file or folder named `Default`/`Profile X`
- [ ] Filter out system folders

### Phase 3: Fix launch_browser (Rust)
- [ ] Add parameter to detect profile type (managed vs native)
- [ ] For managed: use `--user-data-dir=<profile_path>`
- [ ] For native: use `--user-data-dir=<parent> --profile-directory=<folder_name>`

### Phase 4: Auto-create Default Directory
- [ ] On app start, create default directory if not exists
- [ ] Add Rust command `ensure_profiles_directory(path)`

### Phase 5: Settings UI Enhancement
- [ ] Show info about managed vs native profiles
- [ ] Add "Create Profile" button more prominently

## Files to Modify
- `src/app/core/services/settings.service.ts`
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`

## Success Criteria
- [ ] New profiles created in dedicated directory
- [ ] Chrome launches correctly with managed profiles
- [ ] No Chrome system folders shown in profile list
- [ ] Existing Chrome profiles can optionally be imported/used
