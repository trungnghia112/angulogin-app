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
