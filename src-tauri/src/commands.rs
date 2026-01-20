use std::fs;
use std::process::Command;

#[tauri::command]
pub fn scan_profiles(path: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(&path).map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut profiles: Vec<String> = Vec::new();

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name() {
                    if let Some(name_str) = name.to_str() {
                        // Skip hidden folders
                        if !name_str.starts_with('.') {
                            profiles.push(name_str.to_string());
                        }
                    }
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

#[derive(serde::Serialize, serde::Deserialize, Default)]
pub struct ProfileMetadata {
    pub emoji: Option<String>,
    pub notes: Option<String>,
    pub group: Option<String>,
    pub shortcut: Option<u8>,
    pub browser: Option<String>,
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
) -> Result<(), String> {
    let meta_file = format!("{}/.profile-meta.json", profile_path);
    
    let metadata = ProfileMetadata { emoji, notes, group, shortcut, browser };
    
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
pub fn launch_browser(profile_path: String, browser: String) -> Result<(), String> {
    let user_data_arg = format!("--user-data-dir={}", profile_path);
    
    let app_name = match browser.as_str() {
        "chrome" => "Google Chrome",
        "brave" => "Brave Browser",
        "edge" => "Microsoft Edge",
        "arc" => "Arc",
        _ => return Err(format!("Unknown browser: {}", browser)),
    };
    
    Command::new("open")
        .args(["-n", "-a", app_name, "--args", &user_data_arg])
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
