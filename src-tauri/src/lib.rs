mod commands;
mod cookies;
mod camoufox_downloader;
mod camoufox_env;
mod camoufox_manager;
mod fingerprint;
mod browser_manager;
mod proxy_relay;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
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
            commands::scan_profiles_with_metadata,
            commands::check_path_exists,
            commands::ensure_profiles_directory,
            commands::create_profile,
            commands::delete_profile,
            commands::rename_profile,
            commands::get_profile_metadata,
            commands::save_profile_metadata,
            commands::is_chrome_running_for_profile,
            commands::batch_check_running,
            commands::launch_browser,
            commands::get_profile_size,
            commands::list_available_browsers,
            commands::duplicate_profile,
            commands::backup_profile,
            commands::restore_from_backup,
            commands::clear_profile_cookies,
            commands::bulk_export_profiles,
            commands::check_proxy_health,
            commands::auto_backup_all_profiles,
            commands::check_profile_health,
            commands::stop_proxy_relay,
            // Camoufox
            commands::download_camoufox,
            commands::check_camoufox_installed,
            commands::get_camoufox_version,
            commands::generate_fingerprint,
            commands::generate_fingerprint_preview,
            commands::launch_camoufox,
            commands::stop_camoufox,
            // Cookie Import/Export
            commands::export_profile_cookies,
            commands::import_profile_cookies,
            // Profile Templates
            commands::copy_profile_to,
            // Backup encryption
            commands::check_backup_encrypted,
            // Traffic stats
            commands::get_traffic_stats,
            commands::reset_traffic_stats,
            // Local proxy server (13.1)
            commands::start_local_proxy,
            commands::list_active_relays,
            // Ungoogled-Chromium Browser Manager
            commands::check_antidetect_browser,
            commands::download_antidetect_browser,
            commands::get_antidetect_flags
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
