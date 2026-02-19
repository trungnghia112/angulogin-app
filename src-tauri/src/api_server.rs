use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tower_http::cors::{Any, CorsLayer};

use crate::api_models::*;
use crate::commands;

// ---------------------------------------------------------------------------
// Shared application state
// ---------------------------------------------------------------------------

pub struct AppState {
    pub api_key: String,
    /// Map of profile_id -> (debug_port, ws_endpoint)
    pub active_browsers: Mutex<HashMap<String, (u16, String)>>,
    /// Next available debug port
    pub next_debug_port: Mutex<u16>,
}

/// Get the profiles path from global state (synced by frontend via set_api_profiles_path command)
fn get_profiles_path() -> Result<String, String> {
    let lock = API_PROFILES_PATH.lock().unwrap();
    lock.as_ref()
        .cloned()
        .ok_or_else(|| "Profiles path not configured. Open the app and set a profiles directory first.".to_string())
}

// ---------------------------------------------------------------------------
// API Key auth check
// ---------------------------------------------------------------------------

fn check_auth(headers: &HeaderMap, api_key: &str) -> Result<(), (StatusCode, Json<ApiResponse<()>>)> {
    // Status endpoint is public
    let auth = headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let token = auth.strip_prefix("Bearer ").unwrap_or("");

    if token != api_key {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse::error(-1, "Unauthorized: invalid or missing API key")),
        ));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn status_handler() -> Json<ApiResponse<StatusData>> {
    Json(ApiResponse::success(StatusData {
        version: env!("CARGO_PKG_VERSION").to_string(),
        api_version: "v1".to_string(),
        profiles_path: None,
    }))
}

async fn browser_open(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<BrowserOpenParams>,
) -> (StatusCode, Json<ApiResponse<BrowserOpenData>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let profile_id = match params.profile_id.or(params.serial_number) {
        Some(id) => id,
        None => return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, "profile_id is required"))),
    };

    let profiles_path = match get_profiles_path() {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, e))),
    };

    let profile_path = format!("{}/{}", profiles_path, profile_id);

    // Allocate debug port
    let debug_port = {
        let mut port = state.next_debug_port.lock().unwrap();
        let p = *port;
        *port += 1;
        if *port > 59999 {
            *port = 51000; // wrap around
        }
        p
    };

    // Build custom flags with --remote-debugging-port
    let debug_flag = format!("--remote-debugging-port={}", debug_port);
    let browser = params.browser.unwrap_or_else(|| "chrome".to_string());

    // Load profile metadata to get proxy settings
    let meta = commands::get_profile_metadata(profile_path.clone()).unwrap_or_default();
    let custom_flags = match &meta.custom_flags {
        Some(existing) => Some(format!("{} {}", existing, debug_flag)),
        None => Some(debug_flag),
    };

    // Launch browser via existing command
    let result = commands::launch_browser(
        profile_path.clone(),
        browser,
        params.open_url.or(meta.launch_url),
        None,       // incognito
        meta.proxy,
        custom_flags,
        meta.proxy_username,
        meta.proxy_password,
        meta.antidetect_enabled,
        meta.extensions_disabled,
    );

    match result {
        Ok(()) => {
            let ws_endpoint = format!("ws://127.0.0.1:{}", debug_port);

            // Track active browser
            {
                let mut browsers = state.active_browsers.lock().unwrap();
                browsers.insert(profile_id.clone(), (debug_port, ws_endpoint.clone()));
            }

            (StatusCode::OK, Json(ApiResponse::success(BrowserOpenData {
                profile_id,
                debug_port,
                ws_endpoint,
            })))
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse::error(-1, e))),
    }
}

async fn browser_close(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<BrowserCloseParams>,
) -> (StatusCode, Json<ApiResponse<serde_json::Value>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let profile_id = match params.profile_id {
        Some(id) => id,
        None => return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, "profile_id is required"))),
    };

    let profiles_path = match get_profiles_path() {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, e))),
    };

    let profile_path = format!("{}/{}", profiles_path, profile_id);

    // Kill browser process for this profile
    let search_pattern = format!("--user-data-dir={}", profile_path);
    let kill_result = std::process::Command::new("pkill")
        .args(["-f", &search_pattern])
        .output();

    // Also stop any proxy relay for this profile
    let _ = crate::proxy_relay::stop_relay(&profile_id);

    // Remove from active browsers tracking
    {
        let mut browsers = state.active_browsers.lock().unwrap();
        browsers.remove(&profile_id);
    }

    match kill_result {
        Ok(_) => (StatusCode::OK, Json(ApiResponse::success(serde_json::json!({
            "profile_id": profile_id,
            "msg": "Browser closed"
        })))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse::error(-1, format!("Failed to close browser: {}", e)))),
    }
}

async fn browser_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<BrowserStatusParams>,
) -> (StatusCode, Json<ApiResponse<BrowserStatusData>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let profile_id = match params.profile_id {
        Some(id) => id,
        None => return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, "profile_id is required"))),
    };

    let profiles_path = match get_profiles_path() {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, e))),
    };

    let profile_path = format!("{}/{}", profiles_path, profile_id);
    let is_running = commands::is_chrome_running_for_profile(profile_path);
    let status = if is_running { "running" } else { "stopped" };

    (StatusCode::OK, Json(ApiResponse::success(BrowserStatusData {
        profile_id,
        status: status.to_string(),
    })))
}

async fn browser_active(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> (StatusCode, Json<ApiResponse<Vec<ActiveBrowserEntry>>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let browsers = state.active_browsers.lock().unwrap();
    let list: Vec<ActiveBrowserEntry> = browsers
        .iter()
        .map(|(id, (port, ws))| ActiveBrowserEntry {
            profile_id: id.clone(),
            profile_path: String::new(),
            debug_port: *port,
            ws_endpoint: ws.clone(),
        })
        .collect();

    (StatusCode::OK, Json(ApiResponse::success(list)))
}

async fn profile_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<ProfileListParams>,
) -> (StatusCode, Json<ApiResponse<Vec<ProfileListEntry>>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let profiles_path = match get_profiles_path() {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, e))),
    };

    match commands::scan_profiles_with_metadata(profiles_path) {
        Ok(profiles) => {
            let mut entries: Vec<ProfileListEntry> = profiles
                .into_iter()
                .map(|p| ProfileListEntry {
                    profile_id: p.name.clone(),
                    name: p.name,
                    group: p.metadata.group,
                    browser: p.metadata.browser,
                    status: if p.is_running { "running".to_string() } else { "stopped".to_string() },
                    last_opened: p.metadata.last_opened,
                    tags: p.metadata.tags,
                })
                .collect();

            // Filter by group_id if provided
            if let Some(ref group_id) = params.group_id {
                entries.retain(|e| e.group.as_deref() == Some(group_id.as_str()));
            }

            (StatusCode::OK, Json(ApiResponse::success(entries)))
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse::error(-1, e))),
    }
}

async fn profile_detail(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<ProfileDetailParams>,
) -> (StatusCode, Json<ApiResponse<commands::ProfileInfo>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let profile_id = match params.profile_id {
        Some(id) => id,
        None => return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, "profile_id is required"))),
    };

    let profiles_path = match get_profiles_path() {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, e))),
    };

    let profile_path = format!("{}/{}", profiles_path, profile_id);

    if !std::path::Path::new(&profile_path).exists() {
        return (StatusCode::NOT_FOUND, Json(ApiResponse::error(-1, format!("Profile '{}' not found", profile_id))));
    }

    let metadata = commands::get_profile_metadata(profile_path.clone()).unwrap_or_default();
    let is_running = commands::is_chrome_running_for_profile(profile_path.clone());

    (StatusCode::OK, Json(ApiResponse::success(commands::ProfileInfo {
        name: profile_id,
        path: profile_path,
        metadata,
        is_running,
    })))
}

async fn profile_create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<CreateProfileRequest>,
) -> (StatusCode, Json<ApiResponse<CreateProfileData>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let profiles_path = match get_profiles_path() {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, e))),
    };

    match commands::create_profile(profiles_path, body.name.clone()) {
        Ok(path) => {
            // Save initial metadata if provided
            if body.group_id.is_some() || body.browser.is_some() || body.proxy.is_some() {
                let _ = commands::save_profile_metadata(
                    path.clone(),
                    None, None,
                    body.group_id,
                    None,
                    body.browser,
                    None, None, None, None, None, None, None, None, None, None, None,
                    body.proxy,
                    None, None, None, None, None, None, None, None, None, None, None,
                );
            }

            (StatusCode::OK, Json(ApiResponse::success(CreateProfileData {
                profile_id: body.name,
                profile_path: path,
            })))
        }
        Err(e) => (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, e))),
    }
}

async fn profile_update(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<UpdateProfileRequest>,
) -> (StatusCode, Json<ApiResponse<serde_json::Value>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let profiles_path = match get_profiles_path() {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, e))),
    };

    let profile_path = format!("{}/{}", profiles_path, body.profile_id);

    if !std::path::Path::new(&profile_path).exists() {
        return (StatusCode::NOT_FOUND, Json(ApiResponse::error(-1, "Profile not found")));
    }

    // Read existing metadata first, then merge updates
    let existing = commands::get_profile_metadata(profile_path.clone()).unwrap_or_default();

    let result = commands::save_profile_metadata(
        profile_path,
        existing.emoji,
        body.notes.or(existing.notes),
        body.group_id.or(existing.group),
        existing.shortcut,
        body.browser.or(existing.browser),
        body.tags.or(existing.tags),
        body.launch_url.or(existing.launch_url),
        existing.is_pinned,
        existing.last_opened,
        existing.color,
        existing.is_hidden,
        existing.launch_count,
        existing.total_usage_minutes,
        existing.last_session_duration,
        existing.is_favorite,
        existing.custom_flags,
        body.proxy.or(existing.proxy),
        existing.proxy_id,
        body.proxy_username.or(existing.proxy_username),
        body.proxy_password.or(existing.proxy_password),
        existing.antidetect_enabled,
        existing.extensions_disabled,
        existing.protection_level,
        existing.browser_engine,
        existing.fingerprint_config,
        existing.fingerprint_os,
        existing.fingerprint_webgl_renderer,
        existing.fingerprint_webgl_vendor,
    );

    match result {
        Ok(()) => (StatusCode::OK, Json(ApiResponse::success(serde_json::json!({
            "profile_id": body.profile_id,
            "msg": "Profile updated"
        })))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse::error(-1, e))),
    }
}

async fn profile_delete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<DeleteProfileRequest>,
) -> (StatusCode, Json<ApiResponse<serde_json::Value>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let profiles_path = match get_profiles_path() {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, e))),
    };

    let profile_path = format!("{}/{}", profiles_path, body.profile_id);

    match commands::delete_profile(profile_path) {
        Ok(()) => (StatusCode::OK, Json(ApiResponse::success(serde_json::json!({
            "profile_id": body.profile_id,
            "msg": "Profile deleted"
        })))),
        Err(e) => (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, e))),
    }
}

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

pub fn config_path() -> std::path::PathBuf {
    directories::BaseDirs::new()
        .expect("Failed to get base dirs")
        .data_dir()
        .join("AnguLogin")
        .join("api_config.json")
}

pub fn load_config() -> ApiConfig {
    let path = config_path();
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str::<ApiConfig>(&content) {
                return config;
            }
        }
    }
    // Generate new config with random API key
    let config = ApiConfig::default();
    save_config(&config);
    config
}

pub fn save_config(config: &ApiConfig) {
    let path = config_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(config) {
        let _ = std::fs::write(&path, json);
    }
}

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

pub async fn start(port: u16, api_key: String) {
    let state = Arc::new(AppState {
        api_key,
        active_browsers: Mutex::new(HashMap::new()),
        next_debug_port: Mutex::new(51000),
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // Public
        .route("/api/v1/status", get(status_handler))
        // Browser
        .route("/api/v1/browser/open", get(browser_open))
        .route("/api/v1/browser/close", get(browser_close))
        .route("/api/v1/browser/status", get(browser_status))
        .route("/api/v1/browser/active", get(browser_active))
        // Profile
        .route("/api/v1/profile/list", get(profile_list))
        .route("/api/v1/profile/detail", get(profile_detail))
        .route("/api/v1/profile/create", post(profile_create))
        .route("/api/v1/profile/update", post(profile_update))
        .route("/api/v1/profile/delete", post(profile_delete))
        .layer(cors)
        .with_state(state.clone());

    let addr = format!("127.0.0.1:{}", port);
    log::info!("[API] Local REST API starting on http://{}", addr);
    eprintln!("[API] Local REST API starting on http://{}", addr);

    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            log::error!("[API] Failed to bind to {}: {}", addr, e);
            eprintln!("[API] Failed to bind to {}: {}", addr, e);
            return;
        }
    };

    if let Err(e) = axum::serve(listener, app).await {
        log::error!("[API] Server error: {}", e);
        eprintln!("[API] Server error: {}", e);
    }
}

// ---------------------------------------------------------------------------
// Tauri commands for frontend to control API server
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_api_config() -> ApiConfig {
    load_config()
}

#[tauri::command]
pub fn save_api_config(config: ApiConfig) -> Result<(), String> {
    save_config(&config);
    Ok(())
}

#[tauri::command]
pub fn regenerate_api_key() -> String {
    let mut config = load_config();
    config.api_key = format!("angulogin_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));
    save_config(&config);
    config.api_key
}

/// Called by frontend when profile path changes, so API server knows where to find profiles
#[tauri::command]
pub fn set_api_profiles_path(path: String) {
    // Store in a global so the API server can access it
    // The API server reads this via its shared state
    API_PROFILES_PATH.lock().unwrap().replace(path);
}

lazy_static::lazy_static! {
    pub static ref API_PROFILES_PATH: Mutex<Option<String>> = Mutex::new(None);
}
