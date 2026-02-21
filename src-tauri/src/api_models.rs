use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Standard API response wrapper (AdsPower-compatible format)
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub code: i32,
    pub msg: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            code: 0,
            msg: "success".to_string(),
            data: Some(data),
        }
    }

    pub fn error(code: i32, msg: impl Into<String>) -> Self {
        Self {
            code,
            msg: msg.into(),
            data: None,
        }
    }
}

// ---------------------------------------------------------------------------
// Browser endpoints
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct BrowserOpenParams {
    pub profile_id: Option<String>,
    pub serial_number: Option<String>,
    pub open_url: Option<String>,
    pub browser: Option<String>,
}

#[derive(Serialize)]
pub struct BrowserOpenData {
    pub profile_id: String,
    pub debug_port: u16,
    pub ws_endpoint: String,
}

#[derive(Deserialize)]
pub struct BrowserCloseParams {
    pub profile_id: Option<String>,
}

#[derive(Deserialize)]
pub struct BrowserStatusParams {
    pub profile_id: Option<String>,
}

#[derive(Serialize)]
pub struct BrowserStatusData {
    pub profile_id: String,
    pub status: String, // "running" | "stopped"
}

#[derive(Serialize)]
pub struct ActiveBrowserEntry {
    pub profile_id: String,
    pub profile_path: String,
    pub debug_port: u16,
    pub ws_endpoint: String,
}

#[derive(Deserialize)]
pub struct CdpInfoParams {
    pub profile_id: Option<String>,
}

#[derive(Serialize)]
pub struct CdpInfoData {
    pub profile_id: String,
    pub debug_port: u16,
    pub ws_endpoint: String,
    pub browser_version: String,
    pub pages: Vec<CdpPageEntry>,
}

#[derive(Serialize, Deserialize)]
pub struct CdpPageEntry {
    pub id: String,
    pub url: String,
    pub title: String,
    #[serde(rename = "type")]
    pub page_type: String,
    #[serde(rename = "webSocketDebuggerUrl")]
    pub ws_debugger_url: Option<String>,
}

// ---------------------------------------------------------------------------
// Profile endpoints
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct CreateProfileRequest {
    pub name: String,
    pub group_id: Option<String>,
    pub browser: Option<String>,
    pub proxy: Option<String>,
}

#[derive(Serialize)]
pub struct CreateProfileData {
    pub profile_id: String,
    pub profile_path: String,
}

#[derive(Deserialize)]
pub struct UpdateProfileRequest {
    pub profile_id: String,
    #[allow(dead_code)]
    pub name: Option<String>,
    pub group_id: Option<String>,
    pub browser: Option<String>,
    pub proxy: Option<String>,
    pub proxy_username: Option<String>,
    pub proxy_password: Option<String>,
    pub tags: Option<Vec<String>>,
    pub notes: Option<String>,
    pub launch_url: Option<String>,
}

#[derive(Deserialize)]
pub struct DeleteProfileRequest {
    pub profile_id: String,
}

#[derive(Deserialize)]
pub struct ProfileListParams {
    pub group_id: Option<String>,
}

#[derive(Serialize)]
pub struct ProfileListEntry {
    pub profile_id: String,
    pub name: String,
    pub group: Option<String>,
    pub browser: Option<String>,
    pub status: String, // "running" | "stopped"
    pub last_opened: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub struct ProfileDetailParams {
    pub profile_id: Option<String>,
}

// ---------------------------------------------------------------------------
// Status endpoint
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct StatusData {
    pub version: String,
    pub api_version: String,
    pub profiles_path: Option<String>,
}

// ---------------------------------------------------------------------------
// API config stored on disk
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone)]
pub struct ApiConfig {
    pub enabled: bool,
    pub port: u16,
    pub api_key: String,
    pub auto_start: bool,
}

impl Default for ApiConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            port: 50200,
            api_key: format!("angulogin_{}", uuid::Uuid::new_v4().to_string().replace("-", "")),
            auto_start: true,
        }
    }
}

// ---------------------------------------------------------------------------
// Proxy endpoints
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone)]
pub struct ProxyEntry {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    #[serde(rename = "type")]
    pub proxy_type: String, // "http" | "socks4" | "socks5"
    pub username: Option<String>,
    pub password: Option<String>,
    pub group: Option<String>,
    #[serde(rename = "lastChecked")]
    pub last_checked: Option<String>,
    #[serde(rename = "isAlive")]
    pub is_alive: Option<bool>,
    #[serde(rename = "latencyMs")]
    pub latency_ms: Option<u64>,
}

/// Proxy data stored on disk for API server access
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct ProxyData {
    pub proxies: Vec<ProxyEntry>,
}

#[derive(Deserialize)]
pub struct AddProxyRequest {
    pub name: Option<String>,
    pub host: String,
    pub port: u16,
    #[serde(rename = "type")]
    pub proxy_type: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub group: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateProxyRequest {
    pub id: String,
    pub name: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
    #[serde(rename = "type")]
    pub proxy_type: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub group: Option<String>,
}

#[derive(Deserialize)]
pub struct DeleteProxyRequest {
    pub id: String,
}

#[derive(Deserialize)]
pub struct ProxyCheckParams {
    pub id: Option<String>,
}

#[derive(Serialize)]
pub struct ProxyCheckResult {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub is_alive: bool,
    pub latency_ms: Option<u64>,
}

// ---------------------------------------------------------------------------
// Group endpoints
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct GroupEntry {
    pub group_id: String,
    pub group_name: String,
    pub profile_count: usize,
}

