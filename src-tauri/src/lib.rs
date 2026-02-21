mod commands;
mod cookies;
mod camoufox_downloader;
mod camoufox_env;
mod camoufox_manager;
mod fingerprint;
mod browser_manager;
mod proxy_relay;
mod api_server;
mod api_models;
mod cdp;
mod rpa;
mod rpa_api;
mod oauth;

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

            // Start Local REST API server if enabled
            let config = api_server::load_config();
            if config.enabled {
                let port = config.port;
                let api_key = config.api_key.clone();
                std::thread::spawn(move || {
                    let rt = tokio::runtime::Runtime::new()
                        .expect("Failed to create tokio runtime for API server");
                    rt.block_on(api_server::start(port, api_key));
                });
                log::info!("[API] Server thread spawned on port {}", port);
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
            commands::get_antidetect_flags,
            // Local REST API (7.1)
            api_server::get_api_config,
            api_server::save_api_config,
            api_server::regenerate_api_key,
            api_server::set_api_profiles_path,
            api_server::sync_api_proxies,
            // RPA CDP Engine
            rpa::rpa_launch,
            rpa::rpa_connect,
            rpa::rpa_execute,
            rpa::rpa_evaluate_js,
            rpa::rpa_disconnect,
            // OAuth (Google login via system browser)
            oauth::oauth_start_google
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
