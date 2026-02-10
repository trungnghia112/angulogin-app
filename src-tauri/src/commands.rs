use serde::Serialize;
use std::fs;
use std::process::Command;

/// Validate a profile name to prevent path traversal and injection attacks.
/// Returns Ok(trimmed_name) if valid, Err(message) if invalid.
fn sanitize_profile_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim().to_string();
    
    if trimmed.is_empty() {
        return Err("Profile name cannot be empty".to_string());
    }
    
    if trimmed.len() > 255 {
        return Err("Profile name is too long (max 255 characters)".to_string());
    }
    
    // Reject path traversal attempts
    if trimmed.contains("..") || trimmed.contains('/') || trimmed.contains('\\') {
        return Err("Profile name contains invalid characters (..  / \\)".to_string());
    }
    
    // Reject filesystem-unsafe characters
    if trimmed.contains('<') || trimmed.contains('>') || trimmed.contains(':')
        || trimmed.contains('"') || trimmed.contains('|')
        || trimmed.contains('?') || trimmed.contains('*')
    {
        return Err("Profile name contains invalid characters (< > : \" | ? *)".to_string());
    }
    
    // Reject null bytes
    if trimmed.contains('\0') {
        return Err("Profile name contains invalid characters".to_string());
    }
    
    // Reject hidden files (starting with .)
    if trimmed.starts_with('.') {
        return Err("Profile name cannot start with a dot".to_string());
    }
    
    Ok(trimmed)
}

/// Check if a folder is a valid Chrome profile
/// In strict mode: requires Preferences file or Default/Profile X naming
/// In relaxed mode: accepts any directory (for managed profiles)
fn is_valid_profile(path: &std::path::Path, strict_mode: bool) -> bool {
    if !path.is_dir() {
        return false;
    }
    
    // In relaxed mode (managed profiles directory), accept any folder
    if !strict_mode {
        return true;
    }
    
    // Strict mode: Check for Preferences file (present in all Chrome profiles)
    let prefs_file = path.join("Preferences");
    if prefs_file.exists() {
        return true;
    }
    
    // Also accept folders named "Default" or "Profile X" (for Chrome's native structure)
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        if name == "Default" || name.starts_with("Profile ") {
            return true;
        }
    }
    
    // For newly created empty profiles (by our app), check for metadata file
    let meta_file = path.join(".profile-meta.json");
    if meta_file.exists() {
        return true;
    }
    
    false
}

/// Detect if this is a native Chrome User Data directory (has "Local State" file)
/// or a managed profiles directory (no "Local State" file)
fn is_native_chrome_directory(path: &std::path::Path) -> bool {
    let local_state = path.join("Local State");
    local_state.exists()
}

#[tauri::command]
pub fn scan_profiles(path: String) -> Result<Vec<String>, String> {
    let path_obj = std::path::Path::new(&path);
    
    // Detect if this is native Chrome directory or managed profiles directory
    let is_native = is_native_chrome_directory(path_obj);
    
    let entries = fs::read_dir(&path).map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut profiles: Vec<String> = Vec::new();

    for entry in entries {
        if let Ok(entry) = entry {
            let entry_path = entry.path();
            
            // Skip files (only process directories)
            if !entry_path.is_dir() {
                continue;
            }
            
            // Skip hidden folders
            if let Some(name) = entry_path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with('.') {
                    continue;
                }
                
                // For native Chrome directory, skip known non-profile folders
                if is_native {
                    let skip_folders = ["Crashpad", "GrShaderCache", "ShaderCache", 
                                        "FileTypePolicies", "Crowd Deny", "MEIPreload",
                                        "SafetyTips", "SSLErrorAssistant", "hyphen-data",
                                        "pnacl", "WidevineCdm", "ZxcvbnData"];
                    if skip_folders.contains(&name) {
                        continue;
                    }
                }
            }
            
            // Check if valid profile (strict mode for native, relaxed for managed)
            if is_valid_profile(&entry_path, is_native) {
                if let Some(name) = entry_path.file_name().and_then(|n| n.to_str()) {
                    profiles.push(name.to_string());
                }
            }
        }
    }
    
    profiles.sort();
    Ok(profiles)
}

#[tauri::command]
pub fn launch_chrome(profile_path: String) -> Result<(), String> {
    let user_data_arg = format!("--user-data-dir={}", profile_path);

    Command::new("open")
        .args(["-n", "-a", "Google Chrome", "--args", &user_data_arg])
        .spawn()
        .map_err(|e| format!("Failed to launch Chrome: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn check_path_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

/// Ensure the profiles directory exists, create if not
#[tauri::command]
pub fn ensure_profiles_directory(path: String) -> Result<(), String> {
    let path_obj = std::path::Path::new(&path);
    
    if path_obj.exists() {
        return Ok(());
    }
    
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create profiles directory: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub fn create_profile(base_path: String, name: String) -> Result<String, String> {
    let safe_name = sanitize_profile_name(&name)?;
    let profile_path = format!("{}/{}", base_path, safe_name);
    
    if std::path::Path::new(&profile_path).exists() {
        return Err(format!("Profile '{}' already exists", safe_name));
    }
    
    fs::create_dir_all(&profile_path)
        .map_err(|e| format!("Failed to create profile: {}", e))?;
    
    Ok(profile_path)
}

#[tauri::command]
pub fn delete_profile(profile_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&profile_path);
    
    if !path.exists() {
        return Err("Profile does not exist".to_string());
    }
    
    // Safety: must be a directory, not a file
    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    
    // Safety: reject symlinks to prevent following links to unintended locations
    if path.symlink_metadata()
        .map(|m| m.file_type().is_symlink())
        .unwrap_or(false)
    {
        return Err("Cannot delete symlinked directories".to_string());
    }
    
    // Safety: path must have at least 3 components (e.g. /Users/x/profiles/name)
    // to prevent accidental deletion of system directories
    if path.components().count() < 3 {
        return Err("Path is too shallow to be a profile directory".to_string());
    }
    
    // Safety: reject paths containing traversal
    if profile_path.contains("..") {
        return Err("Path contains invalid traversal".to_string());
    }
    
    fs::remove_dir_all(&profile_path)
        .map_err(|e| format!("Failed to delete profile: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub fn rename_profile(old_path: String, new_name: String) -> Result<String, String> {
    let safe_name = sanitize_profile_name(&new_name)?;
    let old_path_obj = std::path::Path::new(&old_path);
    
    if !old_path_obj.exists() {
        return Err("Profile does not exist".to_string());
    }
    
    let parent = old_path_obj.parent()
        .ok_or("Cannot get parent directory")?;
    
    let new_path = parent.join(&safe_name);
    
    if new_path.exists() {
        return Err(format!("Profile '{}' already exists", safe_name));
    }
    
    fs::rename(&old_path, &new_path)
        .map_err(|e| format!("Failed to rename profile: {}", e))?;
    
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn duplicate_profile(source_path: String, new_name: String) -> Result<String, String> {
    let safe_name = sanitize_profile_name(&new_name)?;
    let source = std::path::Path::new(&source_path);
    
    if !source.exists() {
        return Err("Source profile does not exist".to_string());
    }
    
    let parent = source.parent()
        .ok_or("Cannot get parent directory")?;
    
    let dest_path = parent.join(&safe_name);
    
    if dest_path.exists() {
        return Err(format!("Profile '{}' already exists", safe_name));
    }
    
    // Create destination directory first
    fs::create_dir_all(&dest_path)
        .map_err(|e| format!("Failed to create destination: {}", e))?;
    
    // Copy contents directly into destination (not the whole directory)
    let mut options = fs_extra::dir::CopyOptions::new();
    options.content_only = true;
    
    if let Err(e) = fs_extra::dir::copy(&source_path, &dest_path, &options) {
        // Cleanup on failure
        let _ = fs::remove_dir_all(&dest_path);
        return Err(format!("Failed to copy profile: {}", e));
    }
    
    Ok(dest_path.to_string_lossy().to_string())
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
pub struct ProfileMetadata {
    pub emoji: Option<String>,
    pub notes: Option<String>,
    pub group: Option<String>,
    pub shortcut: Option<u8>,
    pub browser: Option<String>,
    pub tags: Option<Vec<String>>,
    pub launch_url: Option<String>,
    pub is_pinned: Option<bool>,
    pub last_opened: Option<String>,
    // Phase 1: Color Coding
    pub color: Option<String>,
    // Phase 2: Hidden Profiles
    pub is_hidden: Option<bool>,
    // Usage Statistics
    pub launch_count: Option<u32>,
    pub total_usage_minutes: Option<u32>,
    pub last_session_duration: Option<u32>,
    // Favorites feature (2.4)
    pub is_favorite: Option<bool>,
    // Custom Chrome Flags (3.6)
    pub custom_flags: Option<String>,
    // Phase 0: Proxy Manager
    pub proxy: Option<String>,
}

#[tauri::command]
pub fn get_profile_metadata(profile_path: String) -> Result<ProfileMetadata, String> {
    let meta_file = format!("{}/.profile-meta.json", profile_path);
    
    if !std::path::Path::new(&meta_file).exists() {
        return Ok(ProfileMetadata::default());
    }
    
    let content = fs::read_to_string(&meta_file)
        .map_err(|e| format!("Failed to read metadata: {}", e))?;
    
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse metadata: {}", e))
}

#[tauri::command]
pub fn save_profile_metadata(
    profile_path: String, 
    emoji: Option<String>, 
    notes: Option<String>,
    group: Option<String>,
    shortcut: Option<u8>,
    browser: Option<String>,
    tags: Option<Vec<String>>,
    launch_url: Option<String>,
    is_pinned: Option<bool>,
    last_opened: Option<String>,
    color: Option<String>,
    is_hidden: Option<bool>,
    launch_count: Option<u32>,
    total_usage_minutes: Option<u32>,
    last_session_duration: Option<u32>,
    is_favorite: Option<bool>,
    custom_flags: Option<String>,
    proxy: Option<String>,
) -> Result<(), String> {
    let meta_file = format!("{}/.profile-meta.json", profile_path);
    
    let metadata = ProfileMetadata { 
        emoji, notes, group, shortcut, browser, tags, launch_url, is_pinned, last_opened, 
        color, is_hidden, launch_count, total_usage_minutes, last_session_duration, is_favorite, custom_flags, proxy
    };
    
    let content = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
    
    fs::write(&meta_file, content)
        .map_err(|e| format!("Failed to write metadata: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub fn is_chrome_running_for_profile(profile_path: String) -> bool {
    let output = Command::new("pgrep")
        .args(["-f", &format!("--user-data-dir={}", profile_path)])
        .output();
    
    match output {
        Ok(out) => !out.stdout.is_empty(),
        Err(_) => false,
    }
}

#[tauri::command]
pub fn launch_browser(profile_path: String, browser: String, url: Option<String>, incognito: Option<bool>, proxy_server: Option<String>, custom_flags: Option<String>) -> Result<(), String> {
    let path = std::path::Path::new(&profile_path);
    
    // Detect if this is a native Chrome profile (parent has "Local State" file)
    // or a managed/isolated profile (standalone user-data-dir)
    let (user_data_dir, profile_directory) = if let Some(parent) = path.parent() {
        let local_state = parent.join("Local State");
        if local_state.exists() {
            // Native Chrome profile: use parent as user-data-dir and folder name as profile-directory
            let folder_name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Default");
            (parent.to_string_lossy().to_string(), Some(folder_name.to_string()))
        } else {
            // Managed profile: use the profile path directly as user-data-dir
            (profile_path.clone(), None)
        }
    } else {
        // No parent, use as-is
        (profile_path.clone(), None)
    };
    
    let user_data_arg = format!("--user-data-dir={}", user_data_dir);
    
    let app_name = match browser.as_str() {
        "chrome" => "Google Chrome",
        "brave" => "Brave Browser",
        "edge" => "Microsoft Edge",
        "arc" => "Arc",
        _ => return Err(format!("Unknown browser: {}", browser)),
    };
    
    // Determine incognito flag based on browser
    let incognito_flag = if incognito.unwrap_or(false) {
        match browser.as_str() {
            "brave" => Some("--incognito"),
            "edge" => Some("--inprivate"),
            "arc" => None,
            _ => Some("--incognito"),
        }
    } else {
        None
    };
    
    let mut args = vec!["-n", "-a", app_name, "--args", &user_data_arg];
    
    // Add profile-directory flag for native Chrome profiles
    let profile_dir_arg: String;
    if let Some(dir) = profile_directory {
        profile_dir_arg = format!("--profile-directory={}", dir);
        args.push(&profile_dir_arg);
    }
    
    // Add incognito flag if applicable
    let incognito_owned: String;
    if let Some(flag) = incognito_flag {
        incognito_owned = flag.to_string();
        args.push(&incognito_owned);
    }
    
    // Add proxy server if provided
    let proxy_owned: String;
    if let Some(proxy) = proxy_server {
        proxy_owned = format!("--proxy-server={}", proxy);
        args.push(&proxy_owned);
    }
    
    // Feature 3.6: Add custom flags if provided
    // Parse space-separated flags and add each one
    let custom_flags_vec: Vec<String>;
    if let Some(flags) = custom_flags {
        custom_flags_vec = flags.split_whitespace()
            .map(|s| s.to_string())
            .collect();
    } else {
        custom_flags_vec = Vec::new();
    }
    let custom_flags_refs: Vec<&str> = custom_flags_vec.iter().map(|s| s.as_str()).collect();
    for flag in &custom_flags_refs {
        args.push(flag);
    }
    
    // Add URL if provided
    let url_owned: String;
    if let Some(u) = url {
        url_owned = u;
        args.push(&url_owned);
    }
    
    Command::new("open")
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to launch {}: {}", app_name, e))?;
    
    Ok(())
}

#[tauri::command]
pub fn get_profile_size(profile_path: String) -> Result<u64, String> {
    let path = std::path::Path::new(&profile_path);
    if !path.exists() {
        return Err("Profile does not exist".to_string());
    }
    
    Ok(calculate_dir_size(path))
}

#[tauri::command]
pub fn list_available_browsers() -> Vec<String> {
    let browsers = vec![
        ("chrome", "/Applications/Google Chrome.app"),
        ("brave", "/Applications/Brave Browser.app"),
        ("edge", "/Applications/Microsoft Edge.app"),
        ("arc", "/Applications/Arc.app"),
    ];
    
    browsers
        .into_iter()
        .filter(|(_, path)| std::path::Path::new(path).exists())
        .map(|(name, _)| name.to_string())
        .collect()
}

/// Feature 4.2: Clear Profile Cookies and Cache
/// Deletes cookies, cache, session storage, and local storage from a Chrome profile
#[tauri::command]
pub fn clear_profile_cookies(profile_path: String) -> Result<ClearDataResult, String> {
    let path = std::path::Path::new(&profile_path);
    if !path.exists() {
        return Err("Profile does not exist".to_string());
    }
    
    // List of files/folders to delete for a complete cookie/cache clear
    let items_to_delete = vec![
        // Cookies
        "Cookies",
        "Cookies-journal",
        // Cache
        "Cache",
        "Code Cache",
        "GPUCache",
        "Service Worker/CacheStorage",
        // Session data
        "Session Storage",
        "Sessions",
        // Local Storage (optional, includes site data)
        "Local Storage",
        // IndexedDB
        "IndexedDB",
        // Web data
        "Web Data",
        "Web Data-journal",
        // Network state
        "Network Action Predictor",
        "Network Persistent State",
    ];
    
    let mut deleted_count = 0;
    let mut failed_items: Vec<String> = Vec::new();
    let mut freed_bytes: u64 = 0;
    
    for item in items_to_delete {
        let item_path = path.join(item);
        if item_path.exists() {
            // Calculate size before deleting
            let item_size = if item_path.is_dir() {
                calculate_dir_size(&item_path)
            } else {
                item_path.metadata().map(|m| m.len()).unwrap_or(0)
            };
            
            let result = if item_path.is_dir() {
                fs::remove_dir_all(&item_path)
            } else {
                fs::remove_file(&item_path)
            };
            
            match result {
                Ok(_) => {
                    deleted_count += 1;
                    freed_bytes += item_size;
                }
                Err(e) => {
                    failed_items.push(format!("{}: {}", item, e));
                }
            }
        }
    }
    
    Ok(ClearDataResult {
        deleted_count,
        freed_bytes,
        failed_items,
    })
}

fn calculate_dir_size(path: &std::path::Path) -> u64 {
    let mut size: u64 = 0;
    if path.is_dir() {
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                if entry_path.is_dir() {
                    size += calculate_dir_size(&entry_path);
                } else if let Ok(meta) = entry_path.metadata() {
                    size += meta.len();
                }
            }
        }
    }
    size
}

#[derive(serde::Serialize)]
pub struct ClearDataResult {
    pub deleted_count: u32,
    pub freed_bytes: u64,
    pub failed_items: Vec<String>,
}

#[tauri::command]
pub fn backup_profile(profile_path: String, backup_path: String) -> Result<String, String> {
    use std::io::{Read, Write};
    use zip::write::FileOptions;
    
    let source = std::path::Path::new(&profile_path);
    if !source.exists() {
        return Err("Profile does not exist".to_string());
    }
    
    let file = fs::File::create(&backup_path)
        .map_err(|e| format!("Failed to create backup file: {}", e))?;
    
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    
    fn add_dir_to_zip<W: Write + std::io::Seek>(
        zip: &mut zip::ZipWriter<W>,
        path: &std::path::Path,
        base_path: &std::path::Path,
        options: FileOptions,
    ) -> Result<(), String> {
        if path.is_dir() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    let entry_path = entry.path();
                    add_dir_to_zip(zip, &entry_path, base_path, options)?;
                }
            }
        } else {
            let relative_path = path.strip_prefix(base_path)
                .map_err(|_| "Failed to get relative path")?;
            
            zip.start_file(relative_path.to_string_lossy(), options)
                .map_err(|e| format!("Failed to start file in zip: {}", e))?;
            
            let mut file = fs::File::open(path)
                .map_err(|e| format!("Failed to open file: {}", e))?;
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)
                .map_err(|e| format!("Failed to read file: {}", e))?;
            zip.write_all(&buffer)
                .map_err(|e| format!("Failed to write to zip: {}", e))?;
        }
        Ok(())
    }
    
    add_dir_to_zip(&mut zip, source, source, options)?;
    zip.finish().map_err(|e| format!("Failed to finish zip: {}", e))?;
    
    Ok(backup_path)
}

#[derive(Serialize)]
pub struct RestoreResult {
    pub success: bool,
    pub restored_path: String,
    pub profile_name: String,
    pub was_renamed: bool,
}

#[tauri::command]
pub fn restore_from_backup(
    backup_path: String,
    target_base_path: String,
    conflict_action: String,  // "overwrite" | "rename" | "skip"
) -> Result<RestoreResult, String> {
    use std::io::Read;
    
    let backup_file = std::path::Path::new(&backup_path);
    if !backup_file.exists() {
        return Err("Backup file does not exist".to_string());
    }
    
    // Open zip file
    let file = fs::File::open(&backup_path)
        .map_err(|e| format!("Failed to open backup file: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read zip archive: {}", e))?;
    
    // Get profile name from backup filename (e.g., "ProfileName_backup_2024.zip" -> "ProfileName")
    let backup_filename = backup_file.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("RestoreProfile");
    let profile_name = backup_filename.split("_backup_").next().unwrap_or(backup_filename);
    
    // Determine target path
    let base = std::path::Path::new(&target_base_path);
    let mut target_path = base.join(profile_name);
    let mut was_renamed = false;
    
    if target_path.exists() {
        match conflict_action.as_str() {
            "overwrite" => {
                fs::remove_dir_all(&target_path)
                    .map_err(|e| format!("Failed to remove existing profile: {}", e))?;
            },
            "rename" => {
                let mut counter = 1;
                loop {
                    let new_name = format!("{} (Restored {})", profile_name, counter);
                    let new_path = base.join(&new_name);
                    if !new_path.exists() {
                        target_path = new_path;
                        was_renamed = true;
                        break;
                    }
                    counter += 1;
                    if counter > 100 {
                        return Err("Could not find unique name for restored profile".to_string());
                    }
                }
            },
            "skip" => {
                return Err("Profile already exists and skip was selected".to_string());
            },
            _ => {
                return Err("Invalid conflict action".to_string());
            }
        }
    }
    
    // Create target directory
    fs::create_dir_all(&target_path)
        .map_err(|e| format!("Failed to create target directory: {}", e))?;
    
    // Extract all files
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;
        
        let file_path = match file.enclosed_name() {
            Some(path) => target_path.join(path),
            None => continue,
        };
        
        if file.is_dir() {
            fs::create_dir_all(&file_path)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            if let Some(parent) = file_path.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                }
            }
            
            let mut outfile = fs::File::create(&file_path)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)
                .map_err(|e| format!("Failed to read from zip: {}", e))?;
            
            std::io::Write::write_all(&mut outfile, &buffer)
                .map_err(|e| format!("Failed to write file: {}", e))?;
        }
    }
    
    let final_name = target_path.file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(profile_name)
        .to_string();
    
    Ok(RestoreResult {
        success: true,
        restored_path: target_path.to_string_lossy().to_string(),
        profile_name: final_name,
        was_renamed,
    })
}

#[derive(Serialize)]
pub struct BulkExportResult {
    pub successful: Vec<String>,
    pub failed: Vec<String>,
    pub total_size: u64,
}

/// Feature 4.1: Bulk Export Profiles
/// Exports multiple profiles to ZIP files in the specified destination folder
#[tauri::command]
pub fn bulk_export_profiles(
    profile_paths: Vec<String>,
    destination_folder: String,
) -> Result<BulkExportResult, String> {
    let dest = std::path::Path::new(&destination_folder);
    
    // Ensure destination folder exists
    if !dest.exists() {
        fs::create_dir_all(dest)
            .map_err(|e| format!("Failed to create destination folder: {}", e))?;
    }
    
    let mut successful: Vec<String> = Vec::new();
    let mut failed: Vec<String> = Vec::new();
    let mut total_size: u64 = 0;
    
    let timestamp = chrono::Local::now().format("%Y-%m-%d").to_string();
    
    for profile_path in profile_paths {
        let source = std::path::Path::new(&profile_path);
        if !source.exists() {
            failed.push(format!("{}: Profile does not exist", profile_path));
            continue;
        }
        
        let profile_name = source.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("profile");
        
        let backup_filename = format!("{}_backup_{}.zip", profile_name, timestamp);
        let backup_path = dest.join(&backup_filename);
        
        match backup_profile(profile_path.clone(), backup_path.to_string_lossy().to_string()) {
            Ok(path) => {
                // Get the size of the created backup
                if let Ok(metadata) = fs::metadata(&path) {
                    total_size += metadata.len();
                }
                successful.push(profile_name.to_string());
            }
            Err(e) => {
                failed.push(format!("{}: {}", profile_name, e));
            }
        }
    }
    
    Ok(BulkExportResult {
        successful,
        failed,
        total_size,
    })
}

/// Feature 4.3: Proxy Health Check
/// Test if a proxy server is reachable via TCP connection
#[derive(Serialize)]
pub struct ProxyHealthResult {
    pub is_alive: bool,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn check_proxy_health(host: String, port: u16) -> ProxyHealthResult {
    use std::net::{TcpStream, ToSocketAddrs};
    use std::time::{Duration, Instant};
    
    let address = format!("{}:{}", host, port);
    
    // Resolve the address
    let socket_addrs: Vec<_> = match address.to_socket_addrs() {
        Ok(addrs) => addrs.collect(),
        Err(e) => {
            return ProxyHealthResult {
                is_alive: false,
                latency_ms: None,
                error: Some(format!("Failed to resolve address: {}", e)),
            };
        }
    };
    
    if socket_addrs.is_empty() {
        return ProxyHealthResult {
            is_alive: false,
            latency_ms: None,
            error: Some("No addresses found for host".to_string()),
        };
    }
    
    // Try to connect with 5 second timeout
    let start = Instant::now();
    let timeout = Duration::from_secs(5);
    
    match TcpStream::connect_timeout(&socket_addrs[0], timeout) {
        Ok(_stream) => {
            let latency = start.elapsed().as_millis() as u64;
            ProxyHealthResult {
                is_alive: true,
                latency_ms: Some(latency),
                error: None,
            }
        }
        Err(e) => {
            ProxyHealthResult {
                is_alive: false,
                latency_ms: None,
                error: Some(format!("Connection failed: {}", e)),
            }
        }
    }
}

/// Feature 5.4: Auto Backup All Profiles
/// Backs up all profiles in a source directory to a destination folder
#[derive(Serialize)]
pub struct AutoBackupResult {
    pub backed_up: Vec<String>,
    pub failed: Vec<String>,
    pub total_size: u64,
}

#[tauri::command]
pub fn auto_backup_all_profiles(
    source_dir: String,
    destination_dir: String,
) -> Result<AutoBackupResult, String> {
    
    let source = std::path::Path::new(&source_dir);
    let dest = std::path::Path::new(&destination_dir);
    
    if !source.exists() {
        return Err("Source directory does not exist".to_string());
    }
    
    // Create destination directory if it doesn't exist
    if !dest.exists() {
        fs::create_dir_all(dest)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    }
    
    let mut backed_up = Vec::new();
    let mut failed = Vec::new();
    let mut total_size: u64 = 0;
    
    // Get timestamp for backup filenames
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    
    // Scan for profiles
    let entries = fs::read_dir(source)
        .map_err(|e| format!("Failed to read source directory: {}", e))?;
    
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n,
            None => continue,
        };
        
        // Skip non-profile directories
        if !name.starts_with("Profile") && name != "Default" {
            continue;
        }
        
        // Create backup filename
        let backup_name = format!("{}_{}.zip", name, timestamp);
        let backup_path = dest.join(&backup_name);
        
        // Create ZIP
        match create_profile_backup(&path, &backup_path) {
            Ok(size) => {
                backed_up.push(name.to_string());
                total_size += size;
            }
            Err(e) => {
                failed.push(format!("{}: {}", name, e));
            }
        }
    }
    
    Ok(AutoBackupResult {
        backed_up,
        failed,
        total_size,
    })
}

fn create_profile_backup(profile_path: &std::path::Path, backup_path: &std::path::Path) -> Result<u64, String> {
    use std::io::{Read, Write};
    use zip::write::FileOptions;
    
    let file = fs::File::create(backup_path)
        .map_err(|e| format!("Failed to create backup file: {}", e))?;
    
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    
    fn add_to_zip<W: Write + std::io::Seek>(
        zip: &mut zip::ZipWriter<W>,
        path: &std::path::Path,
        base: &std::path::Path,
        opts: FileOptions,
    ) -> Result<u64, String> {
        let mut size = 0u64;
        if path.is_dir() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    size += add_to_zip(zip, &entry.path(), base, opts)?;
                }
            }
        } else {
            let rel = path.strip_prefix(base).map_err(|_| "Path error")?;
            zip.start_file(rel.to_string_lossy(), opts)
                .map_err(|e| format!("Zip error: {}", e))?;
            let mut f = fs::File::open(path).map_err(|e| format!("File error: {}", e))?;
            let mut buf = Vec::new();
            f.read_to_end(&mut buf).map_err(|e| format!("Read error: {}", e))?;
            size = buf.len() as u64;
            zip.write_all(&buf).map_err(|e| format!("Write error: {}", e))?;
        }
        Ok(size)
    }
    
    let size = add_to_zip(&mut zip, profile_path, profile_path, options)?;
    zip.finish().map_err(|e| format!("Finish error: {}", e))?;
    Ok(size)
}

/// Feature 9.3: Profile Health Check
/// Validates Chrome profile integrity by checking critical files
#[derive(Serialize)]
pub struct ProfileHealthResult {
    pub is_healthy: bool,
    pub issues: Vec<String>,
    pub warnings: Vec<String>,
    pub checked_files: u32,
}

#[tauri::command]
pub fn check_profile_health(profile_path: String) -> ProfileHealthResult {
    let path = std::path::Path::new(&profile_path);
    let mut issues: Vec<String> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    let mut checked_files: u32 = 0;
    
    // Check if profile directory exists
    if !path.exists() {
        return ProfileHealthResult {
            is_healthy: false,
            issues: vec!["Profile directory does not exist".to_string()],
            warnings: vec![],
            checked_files: 0,
        };
    }
    
    // Check if directory is writable
    let test_file = path.join(".health-check-test");
    match fs::write(&test_file, "test") {
        Ok(_) => {
            let _ = fs::remove_file(&test_file);
            checked_files += 1;
        }
        Err(_) => {
            issues.push("Profile directory is not writable".to_string());
        }
    }
    
    // Check Preferences file (critical for Chrome profiles)
    let prefs_file = path.join("Preferences");
    if prefs_file.exists() {
        checked_files += 1;
        match fs::read_to_string(&prefs_file) {
            Ok(content) => {
                // Validate JSON format
                if serde_json::from_str::<serde_json::Value>(&content).is_err() {
                    issues.push("Preferences file is corrupted (invalid JSON)".to_string());
                }
            }
            Err(_) => {
                issues.push("Cannot read Preferences file".to_string());
            }
        }
    } else {
        // Not an error for managed profiles created by our app
        let meta_file = path.join(".profile-meta.json");
        if !meta_file.exists() {
            warnings.push("No Preferences file (may be a new or empty profile)".to_string());
        }
    }
    
    // Check History file (SQLite database)
    let history_file = path.join("History");
    if history_file.exists() {
        checked_files += 1;
        // Check if file is readable and has valid SQLite header
        match fs::read(&history_file) {
            Ok(content) => {
                // SQLite files start with "SQLite format 3\0"
                if content.len() >= 16 {
                    let header = String::from_utf8_lossy(&content[0..15]);
                    if !header.starts_with("SQLite format 3") {
                        issues.push("History file is corrupted (invalid SQLite header)".to_string());
                    }
                }
            }
            Err(_) => {
                warnings.push("Cannot read History file (may be in use)".to_string());
            }
        }
    }
    
    // Check Bookmarks file
    let bookmarks_file = path.join("Bookmarks");
    if bookmarks_file.exists() {
        checked_files += 1;
        match fs::read_to_string(&bookmarks_file) {
            Ok(content) => {
                if serde_json::from_str::<serde_json::Value>(&content).is_err() {
                    issues.push("Bookmarks file is corrupted (invalid JSON)".to_string());
                }
            }
            Err(_) => {
                warnings.push("Cannot read Bookmarks file".to_string());
            }
        }
    }
    
    // Check our custom metadata file
    let meta_file = path.join(".profile-meta.json");
    if meta_file.exists() {
        checked_files += 1;
        match fs::read_to_string(&meta_file) {
            Ok(content) => {
                if serde_json::from_str::<serde_json::Value>(&content).is_err() {
                    warnings.push("Metadata file is corrupted (will be recreated)".to_string());
                }
            }
            Err(_) => {
                warnings.push("Cannot read metadata file".to_string());
            }
        }
    }
    
    // Check for unusually small profile size (might indicate corruption)
    let profile_size = get_profile_size(profile_path.clone()).unwrap_or(0);
    if profile_size > 0 && profile_size < 1024 {
        warnings.push("Profile size is unusually small (< 1KB)".to_string());
    }
    
    ProfileHealthResult {
        is_healthy: issues.is_empty(),
        issues,
        warnings,
        checked_files,
    }
}
