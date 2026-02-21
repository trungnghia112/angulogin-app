use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use std::net::TcpStream;
use std::time::{Duration, Instant};
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
// Proxy data persistence (JSON file on disk)
// ---------------------------------------------------------------------------

fn proxies_path() -> std::path::PathBuf {
    directories::BaseDirs::new()
        .expect("Failed to get base dirs")
        .data_dir()
        .join("AnguLogin")
        .join("proxies.json")
}

fn load_proxies() -> ProxyData {
    let path = proxies_path();
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(data) = serde_json::from_str(&content) {
                return data;
            }
        }
    }
    ProxyData::default()
}

fn save_proxies(data: &ProxyData) {
    let path = proxies_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(data) {
        let _ = std::fs::write(&path, json);
    }
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

    // Use launch_browser_inner with trusted debug_port (bypasses custom_flags security filter)
    let browser = params.browser.unwrap_or_else(|| "chrome".to_string());

    // Load profile metadata to get proxy settings
    let meta = commands::get_profile_metadata(profile_path.clone()).unwrap_or_default();

    // Launch browser via inner command with trusted debug_port
    let result = commands::launch_browser_inner(
        profile_path.clone(),
        browser,
        params.open_url.or(meta.launch_url),
        None,       // incognito
        meta.proxy,
        meta.custom_flags,
        meta.proxy_username,
        meta.proxy_password,
        meta.antidetect_enabled,
        meta.extensions_disabled,
        Some(debug_port),
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

async fn browser_cdp(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<CdpInfoParams>,
) -> (StatusCode, Json<ApiResponse<CdpInfoData>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let profile_id = match params.profile_id {
        Some(id) => id,
        None => return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, "profile_id is required"))),
    };

    // Look up active browser
    let (debug_port, _) = {
        let browsers = state.active_browsers.lock().unwrap();
        match browsers.get(&profile_id) {
            Some(entry) => entry.clone(),
            None => return (StatusCode::NOT_FOUND, Json(ApiResponse::error(-1, format!(
                "No active browser for profile '{}'. Launch it first via /api/v1/browser/open",
                profile_id
            )))),
        }
    };

    // Fetch real WebSocket URL from Chrome's /json/version endpoint
    let version_url = format!("http://127.0.0.1:{}/json/version", debug_port);
    let ws_endpoint;
    let browser_version;

    match reqwest::get(&version_url).await {
        Ok(resp) => {
            match resp.json::<serde_json::Value>().await {
                Ok(json) => {
                    ws_endpoint = json.get("webSocketDebuggerUrl")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    browser_version = json.get("Browser")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string();
                }
                Err(_) => {
                    ws_endpoint = format!("ws://127.0.0.1:{}", debug_port);
                    browser_version = "unknown".to_string();
                }
            }
        }
        Err(_) => {
            return (StatusCode::SERVICE_UNAVAILABLE, Json(ApiResponse::error(-1, format!(
                "Browser CDP not reachable on port {}. It may still be starting up — retry in 1-2 seconds.",
                debug_port
            ))));
        }
    }

    // Update tracked ws_endpoint with the real one
    {
        let mut browsers = state.active_browsers.lock().unwrap();
        if let Some(entry) = browsers.get_mut(&profile_id) {
            entry.1 = ws_endpoint.clone();
        }
    }

    // Fetch open pages via /json/list
    let pages_url = format!("http://127.0.0.1:{}/json/list", debug_port);
    let pages: Vec<CdpPageEntry> = match reqwest::get(&pages_url).await {
        Ok(resp) => resp.json().await.unwrap_or_default(),
        Err(_) => Vec::new(),
    };

    (StatusCode::OK, Json(ApiResponse::success(CdpInfoData {
        profile_id,
        debug_port,
        ws_endpoint,
        browser_version,
        pages,
    })))
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
// Proxy handlers
// ---------------------------------------------------------------------------

async fn proxy_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> (StatusCode, Json<ApiResponse<Vec<ProxyEntry>>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }
    let data = load_proxies();
    (StatusCode::OK, Json(ApiResponse::success(data.proxies)))
}

async fn proxy_add(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<AddProxyRequest>,
) -> (StatusCode, Json<ApiResponse<ProxyEntry>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let new_proxy = ProxyEntry {
        id: format!("proxy-{}", uuid::Uuid::new_v4().to_string().replace("-", "")),
        name: body.name.unwrap_or_else(|| format!("{}:{}", body.host, body.port)),
        host: body.host,
        port: body.port,
        proxy_type: body.proxy_type.unwrap_or_else(|| "http".to_string()),
        username: body.username,
        password: body.password,
        group: body.group,
        last_checked: None,
        is_alive: None,
        latency_ms: None,
    };

    let mut data = load_proxies();
    data.proxies.push(new_proxy.clone());
    save_proxies(&data);

    (StatusCode::OK, Json(ApiResponse::success(new_proxy)))
}

async fn proxy_update(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<UpdateProxyRequest>,
) -> (StatusCode, Json<ApiResponse<serde_json::Value>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let mut data = load_proxies();
    let found = data.proxies.iter_mut().find(|p| p.id == body.id);

    match found {
        Some(proxy) => {
            if let Some(name) = body.name { proxy.name = name; }
            if let Some(host) = body.host { proxy.host = host; }
            if let Some(port) = body.port { proxy.port = port; }
            if let Some(t) = body.proxy_type { proxy.proxy_type = t; }
            if let Some(u) = body.username { proxy.username = Some(u); }
            if let Some(p) = body.password { proxy.password = Some(p); }
            if let Some(g) = body.group { proxy.group = Some(g); }
            save_proxies(&data);
            (StatusCode::OK, Json(ApiResponse::success(serde_json::json!({ "msg": "Proxy updated" }))))
        }
        None => (StatusCode::NOT_FOUND, Json(ApiResponse::error(-1, "Proxy not found"))),
    }
}

async fn proxy_delete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<DeleteProxyRequest>,
) -> (StatusCode, Json<ApiResponse<serde_json::Value>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let mut data = load_proxies();
    let before_len = data.proxies.len();
    data.proxies.retain(|p| p.id != body.id);

    if data.proxies.len() == before_len {
        return (StatusCode::NOT_FOUND, Json(ApiResponse::error(-1, "Proxy not found")));
    }

    save_proxies(&data);
    (StatusCode::OK, Json(ApiResponse::success(serde_json::json!({
        "msg": "Proxy deleted",
        "id": body.id
    }))))
}

async fn proxy_check(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<ProxyCheckParams>,
) -> (StatusCode, Json<ApiResponse<Vec<ProxyCheckResult>>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let mut data = load_proxies();
    let targets: Vec<&mut ProxyEntry> = if let Some(ref id) = params.id {
        data.proxies.iter_mut().filter(|p| &p.id == id).collect()
    } else {
        data.proxies.iter_mut().collect()
    };

    let mut results = Vec::new();
    for proxy in targets {
        let addr = format!("{}:{}", proxy.host, proxy.port);
        let start = Instant::now();
        let is_alive = TcpStream::connect_timeout(
            &addr.parse().unwrap_or_else(|_| "0.0.0.0:0".parse().unwrap()),
            Duration::from_secs(5),
        ).is_ok();
        let latency = if is_alive { Some(start.elapsed().as_millis() as u64) } else { None };

        // Update proxy health data
        proxy.is_alive = Some(is_alive);
        proxy.latency_ms = latency;
        proxy.last_checked = Some(chrono::Utc::now().to_rfc3339());

        results.push(ProxyCheckResult {
            id: proxy.id.clone(),
            host: proxy.host.clone(),
            port: proxy.port,
            is_alive,
            latency_ms: latency,
        });
    }

    save_proxies(&data);
    (StatusCode::OK, Json(ApiResponse::success(results)))
}

// ---------------------------------------------------------------------------
// Group handlers
// ---------------------------------------------------------------------------

async fn group_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> (StatusCode, Json<ApiResponse<Vec<GroupEntry>>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let profiles_path = match get_profiles_path() {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, e))),
    };

    // Scan profiles to extract groups
    let mut group_counts: HashMap<String, usize> = HashMap::new();
    match commands::scan_profiles_with_metadata(profiles_path) {
        Ok(profiles) => {
            for profile in &profiles {
                if let Some(ref group) = profile.metadata.group {
                    if !group.is_empty() {
                        *group_counts.entry(group.clone()).or_insert(0) += 1;
                    }
                }
            }
        }
        Err(_) => {}
    }

    let groups: Vec<GroupEntry> = group_counts.into_iter()
        .map(|(name, count)| GroupEntry {
            group_id: name.clone(),
            group_name: name,
            profile_count: count,
        })
        .collect();

    (StatusCode::OK, Json(ApiResponse::success(groups)))
}

// ---------------------------------------------------------------------------
// Automation handlers
// ---------------------------------------------------------------------------

async fn automation_execute(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<crate::rpa_api::ExecuteRequest>,
) -> (StatusCode, Json<ApiResponse<crate::rpa_api::ExecuteResponseData>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    if body.steps.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, "steps array is required and must not be empty")));
    }

    // Check if browser is running for this profile
    let (debug_port, ws_endpoint) = {
        let browsers = state.active_browsers.lock().unwrap();
        match browsers.get(&body.profile_id) {
            Some(entry) => entry.clone(),
            None => return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, format!(
                "No active browser for profile '{}'. Launch it first via /api/v1/browser/open",
                body.profile_id
            )))),
        }
    };

    let total_steps = body.steps.len();
    let task_id = crate::rpa_api::spawn_task(
        body.profile_id.clone(),
        body.steps,
        body.variables,
        debug_port,
        ws_endpoint,
    );

    (StatusCode::OK, Json(ApiResponse::success(crate::rpa_api::ExecuteResponseData {
        task_id,
        status: "running".to_string(),
        profile_id: body.profile_id,
        total_steps,
    })))
}

async fn automation_tasks(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<crate::rpa_api::TaskListParam>,
) -> (StatusCode, Json<ApiResponse<Vec<crate::rpa_api::AutoTask>>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let tasks = crate::rpa_api::TASKS.lock().await;
    let mut list: Vec<crate::rpa_api::AutoTask> = tasks.values().cloned().collect();

    // Filter by status if provided
    if let Some(ref status) = params.status {
        list.retain(|t| t.status == *status);
    }

    // Sort by started_at descending
    list.sort_by(|a, b| b.started_at.cmp(&a.started_at));

    (StatusCode::OK, Json(ApiResponse::success(list)))
}

async fn automation_task_detail(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<crate::rpa_api::TaskIdParam>,
) -> (StatusCode, Json<ApiResponse<crate::rpa_api::AutoTask>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    let task_id = match params.task_id {
        Some(id) => id,
        None => return (StatusCode::BAD_REQUEST, Json(ApiResponse::error(-1, "task_id is required"))),
    };

    let tasks = crate::rpa_api::TASKS.lock().await;
    match tasks.get(&task_id) {
        Some(task) => (StatusCode::OK, Json(ApiResponse::success(task.clone()))),
        None => (StatusCode::NOT_FOUND, Json(ApiResponse::error(-1, format!("Task '{}' not found", task_id)))),
    }
}

async fn automation_cancel(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<crate::rpa_api::CancelRequest>,
) -> (StatusCode, Json<ApiResponse<serde_json::Value>>) {
    if let Err(e) = check_auth(&headers, &state.api_key) {
        return (e.0, Json(ApiResponse::error(-1, "Unauthorized")));
    }

    match crate::rpa_api::cancel_task(&body.task_id).await {
        Ok(()) => (StatusCode::OK, Json(ApiResponse::success(serde_json::json!({
            "task_id": body.task_id,
            "msg": "Cancellation requested"
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
        .route("/api/v1/browser/cdp", get(browser_cdp))
        // Profile
        .route("/api/v1/profile/list", get(profile_list))
        .route("/api/v1/profile/detail", get(profile_detail))
        .route("/api/v1/profile/create", post(profile_create))
        .route("/api/v1/profile/update", post(profile_update))
        .route("/api/v1/profile/delete", post(profile_delete))
        // Proxy
        .route("/api/v1/proxy/list", get(proxy_list))
        .route("/api/v1/proxy/add", post(proxy_add))
        .route("/api/v1/proxy/update", post(proxy_update))
        .route("/api/v1/proxy/delete", post(proxy_delete))
        .route("/api/v1/proxy/check", get(proxy_check))
        // Group
        .route("/api/v1/group/list", get(group_list))
        // Automation
        .route("/api/v1/automation/execute", post(automation_execute))
        .route("/api/v1/automation/tasks", get(automation_tasks))
        .route("/api/v1/automation/task", get(automation_task_detail))
        .route("/api/v1/automation/cancel", post(automation_cancel))
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
    API_PROFILES_PATH.lock().unwrap().replace(path);
}

/// Called by frontend to sync proxy data to disk for API server access
#[tauri::command]
pub fn sync_api_proxies(proxies_json: String) -> Result<(), String> {
    let data: ProxyData = serde_json::from_str(&proxies_json)
        .map_err(|e| format!("Invalid proxy data: {}", e))?;
    save_proxies(&data);
    Ok(())
}

lazy_static::lazy_static! {
    pub static ref API_PROFILES_PATH: Mutex<Option<String>> = Mutex::new(None);
}
