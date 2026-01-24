use std::fs;
use std::process::Command;

/// Check if a folder is a valid Chrome profile
/// A valid profile has a "Preferences" file inside
fn is_valid_profile(path: &std::path::Path) -> bool {
    if !path.is_dir() {
        return false;
    }
    
    // Check for Preferences file (present in all Chrome profiles)
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

#[tauri::command]
pub fn scan_profiles(path: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(&path).map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut profiles: Vec<String> = Vec::new();

    for entry in entries {
        if let Ok(entry) = entry {
            let entry_path = entry.path();
            
            // Skip hidden folders
            if let Some(name) = entry_path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with('.') {
                    continue;
                }
            }
            
            // Only include valid Chrome profiles
            if is_valid_profile(&entry_path) {
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
    let profile_path = format!("{}/{}", base_path, name);
    
    if std::path::Path::new(&profile_path).exists() {
        return Err(format!("Profile '{}' already exists", name));
    }
    
    fs::create_dir_all(&profile_path)
        .map_err(|e| format!("Failed to create profile: {}", e))?;
    
    Ok(profile_path)
}

#[tauri::command]
pub fn delete_profile(profile_path: String) -> Result<(), String> {
    if !std::path::Path::new(&profile_path).exists() {
        return Err("Profile does not exist".to_string());
    }
    
    fs::remove_dir_all(&profile_path)
        .map_err(|e| format!("Failed to delete profile: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub fn rename_profile(old_path: String, new_name: String) -> Result<String, String> {
    let old_path_obj = std::path::Path::new(&old_path);
    
    if !old_path_obj.exists() {
        return Err("Profile does not exist".to_string());
    }
    
    let parent = old_path_obj.parent()
        .ok_or("Cannot get parent directory")?;
    
    let new_path = parent.join(&new_name);
    
    if new_path.exists() {
        return Err(format!("Profile '{}' already exists", new_name));
    }
    
    fs::rename(&old_path, &new_path)
        .map_err(|e| format!("Failed to rename profile: {}", e))?;
    
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn duplicate_profile(source_path: String, new_name: String) -> Result<String, String> {
    let source = std::path::Path::new(&source_path);
    
    if !source.exists() {
        return Err("Source profile does not exist".to_string());
    }
    
    let parent = source.parent()
        .ok_or("Cannot get parent directory")?;
    
    let dest_path = parent.join(&new_name);
    
    if dest_path.exists() {
        return Err(format!("Profile '{}' already exists", new_name));
    }
    
    let options = fs_extra::dir::CopyOptions::new();
    fs_extra::dir::copy(&source_path, parent, &options)
        .map_err(|e| format!("Failed to copy profile: {}", e))?;
    
    // Rename the copied folder to the new name
    let copied_name = source.file_name()
        .ok_or("Cannot get source folder name")?;
    let copied_path = parent.join(copied_name);
    
    fs::rename(&copied_path, &dest_path)
        .map_err(|e| format!("Failed to rename copied profile: {}", e))?;
    
    Ok(dest_path.to_string_lossy().to_string())
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
pub struct ProfileMetadata {
    pub emoji: Option<String>,
    pub notes: Option<String>,
    pub group: Option<String>,
    pub shortcut: Option<u8>,
    pub browser: Option<String>,
    // New fields
    pub tags: Option<Vec<String>>,
    pub launch_url: Option<String>,
    pub is_pinned: Option<bool>,
    pub last_opened: Option<String>,
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
) -> Result<(), String> {
    let meta_file = format!("{}/.profile-meta.json", profile_path);
    
    let metadata = ProfileMetadata { emoji, notes, group, shortcut, browser, tags, launch_url, is_pinned, last_opened };
    
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
pub fn launch_browser(profile_path: String, browser: String, url: Option<String>, incognito: Option<bool>, proxy_server: Option<String>) -> Result<(), String> {
    let user_data_arg = format!("--user-data-dir={}", profile_path);
    
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
            "brave" => Some("--incognito"), // Brave uses same flag as Chrome
            "edge" => Some("--inprivate"),
            "arc" => None, // Arc doesn't support incognito via CLI
            _ => Some("--incognito"), // Chrome default
        }
    } else {
        None
    };
    
    let mut args = vec!["-n", "-a", app_name, "--args", &user_data_arg];
    
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
    fn dir_size(path: &std::path::Path) -> u64 {
        let mut size: u64 = 0;
        if path.is_dir() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        size += dir_size(&path);
                    } else if let Ok(meta) = path.metadata() {
                        size += meta.len();
                    }
                }
            }
        }
        size
    }
    
    let path = std::path::Path::new(&profile_path);
    if !path.exists() {
        return Err("Profile does not exist".to_string());
    }
    
    Ok(dir_size(path))
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
