mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
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
            commands::rename_profile
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
