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
