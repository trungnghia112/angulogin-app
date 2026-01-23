mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_profiles,
            commands::launch_chrome,
            commands::check_path_exists,
            commands::create_profile,
            commands::delete_profile,
            commands::rename_profile,
            commands::get_profile_metadata,
            commands::save_profile_metadata,
            commands::is_chrome_running_for_profile,
            commands::launch_browser,
            commands::get_profile_size,
            commands::list_available_browsers,
            commands::duplicate_profile
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
