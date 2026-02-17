//! Camoufox process manager.
//!
//! Manages the lifecycle of Camoufox browser instances:
//! launching, stopping, tracking, and cleaning up processes.

use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tokio::process::Command as TokioCommand;
use tokio::sync::Mutex as AsyncMutex;

/// Camoufox launch configuration per profile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CamoufoxConfig {
    /// Proxy URL (e.g. "socks5://user:pass@host:port")
    pub proxy: Option<String>,
    /// Block WebRTC (prevents IP leaks)
    pub block_webrtc: bool,
    /// Block WebGL (prevents GPU fingerprinting)
    pub block_webgl: bool,
    /// JSON string of the fingerprint config
    pub fingerprint: Option<String>,
    /// Generate new fingerprint on every launch
    pub randomize_on_launch: bool,
    /// Target OS for fingerprint generation: "windows" | "macos" | "linux"
    pub os: Option<String>,
}

impl Default for CamoufoxConfig {
    fn default() -> Self {
        Self {
            proxy: None,
            block_webrtc: true,
            block_webgl: false,
            fingerprint: None,
            randomize_on_launch: false,
            os: None,
        }
    }
}

/// Result of a Camoufox launch
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(non_snake_case)]
pub struct CamoufoxLaunchResult {
    pub id: String,
    #[serde(alias = "process_id")]
    pub processId: Option<u32>,
    #[serde(alias = "profile_path")]
    pub profilePath: Option<String>,
    pub url: Option<String>,
}

/// Internal instance tracking
#[derive(Debug)]
struct CamoufoxInstance {
    #[allow(dead_code)]
    id: String,
    process_id: Option<u32>,
    profile_path: Option<String>,
    url: Option<String>,
}

struct CamoufoxManagerInner {
    instances: HashMap<String, CamoufoxInstance>,
}

/// Manages Camoufox browser process lifecycle
pub struct CamoufoxManager {
    inner: Arc<AsyncMutex<CamoufoxManagerInner>>,
}

impl CamoufoxManager {
    fn new() -> Self {
        Self {
            inner: Arc::new(AsyncMutex::new(CamoufoxManagerInner {
                instances: HashMap::new(),
            })),
        }
    }

    /// Get the global singleton instance
    pub fn instance() -> &'static CamoufoxManager {
        &CAMOUFOX_MANAGER
    }

    /// Generate fingerprint config for a profile
    pub fn generate_fingerprint_config(
        &self,
        config: &CamoufoxConfig,
    ) -> Result<String, String> {
        let os = config.os.as_deref();
        let fingerprint = crate::fingerprint::generator::generate(os);
        crate::fingerprint::generator::to_camoufox_config(&fingerprint)
    }

    /// Launch Camoufox browser with the given config
    pub async fn launch(
        &self,
        profile_path: &str,
        config: &CamoufoxConfig,
        url: Option<&str>,
    ) -> Result<CamoufoxLaunchResult, String> {
        // Get executable path
        let executable_path = crate::camoufox_downloader::get_executable_path()?;

        // Get or generate fingerprint
        let fingerprint_json = if let Some(existing) = &config.fingerprint {
            existing.clone()
        } else {
            self.generate_fingerprint_config(config)?
        };

        // Inject debug flag into the config
        let fingerprint_json = {
            let mut config_map: serde_json::Map<String, serde_json::Value> =
                serde_json::from_str(&fingerprint_json)
                    .map_err(|e| format!("Failed to parse fingerprint JSON: {e}"))?;
            config_map.insert("debug".to_string(), serde_json::Value::Bool(true));
            serde_json::to_string(&config_map)
                .map_err(|e| format!("Failed to serialize config with debug flag: {e}"))?
        };

        // Convert fingerprint to env vars (single CAMOU_CONFIG)
        let env_vars = crate::camoufox_env::json_config_to_env_vars(&fingerprint_json)?;

        // Log the config for debugging
        if let Some(camou_config) = env_vars.get("CAMOU_CONFIG") {
            let truncated = if camou_config.len() > 500 {
                format!("{}... ({} bytes total)", &camou_config[..500], camou_config.len())
            } else {
                camou_config.clone()
            };
            log::info!("CAMOU_CONFIG: {}", truncated);
        }

        // Ensure profile directory exists
        let profile_dir = std::path::Path::new(profile_path);
        if !profile_dir.exists() {
            std::fs::create_dir_all(profile_dir)
                .map_err(|e| format!("Failed to create profile directory: {e}"))?;
        }

        // Build command args
        let canonical_path = profile_dir
            .canonicalize()
            .unwrap_or_else(|_| profile_dir.to_path_buf());
        let mut args = vec![
            "-profile".to_string(),
            canonical_path.to_string_lossy().to_string(),
        ];

        // Add URL if provided
        if let Some(url) = url {
            args.push("-new-tab".to_string());
            args.push(url.to_string());
        }

        // Add headless flag for tests
        if std::env::var("CAMOUFOX_HEADLESS").is_ok() {
            args.push("--headless".to_string());
        }

        log::info!(
            "Launching Camoufox: {:?} with args: {:?}",
            executable_path,
            args
        );

        // Spawn the process (capture stderr for diagnostics)
        let mut command = TokioCommand::new(&executable_path);
        command
            .args(&args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped());

        // Add fingerprint env vars
        for (key, value) in &env_vars {
            command.env(key, value);
        }

        // Handle fontconfig on Linux
        #[cfg(target_os = "linux")]
        {
            let target_os = config.os.as_deref().unwrap_or("linux");
            if let Some(fontconfig_path) =
                crate::camoufox_env::get_fontconfig_env(target_os, &executable_path)
            {
                command.env("FONTCONFIG_PATH", fontconfig_path);
            }
        }

        let mut child = command
            .spawn()
            .map_err(|e| format!("Failed to spawn Camoufox: {e}"))?;

        let process_id = child.id();
        let instance_id = format!("camoufox_{}", process_id.unwrap_or(0));

        log::info!("Camoufox launched with PID: {:?}", process_id);

        // Read stderr in background for diagnostics
        if let Some(stderr) = child.stderr.take() {
            let pid = process_id.unwrap_or(0);
            tokio::spawn(async move {
                use tokio::io::AsyncReadExt;
                let mut buf = vec![0u8; 2048];
                let mut reader = stderr;
                match reader.read(&mut buf).await {
                    Ok(n) if n > 0 => {
                        let output = String::from_utf8_lossy(&buf[..n]);
                        log::warn!("Camoufox stderr (PID {}): {}", pid, output);
                    }
                    _ => {}
                }
            });
        }

        // Store instance for tracking
        let instance = CamoufoxInstance {
            id: instance_id.clone(),
            process_id,
            profile_path: Some(profile_path.to_string()),
            url: url.map(String::from),
        };

        let result = CamoufoxLaunchResult {
            id: instance_id.clone(),
            processId: process_id,
            profilePath: Some(profile_path.to_string()),
            url: url.map(String::from),
        };

        {
            let mut inner = self.inner.lock().await;
            inner.instances.insert(instance_id, instance);
        }

        Ok(result)
    }

    /// Stop a Camoufox instance by ID
    pub async fn stop(&self, id: &str) -> Result<bool, String> {
        let process_id = {
            let inner = self.inner.lock().await;
            inner
                .instances
                .get(id)
                .and_then(|instance| instance.process_id)
        };

        if let Some(pid) = process_id {
            let success = kill_process(pid);
            if success {
                let mut inner = self.inner.lock().await;
                inner.instances.remove(id);
                log::info!("Stopped Camoufox instance {} (PID: {})", id, pid);
            }
            Ok(success)
        } else {
            let mut inner = self.inner.lock().await;
            inner.instances.remove(id);
            Ok(true)
        }
    }

    /// Find a running Camoufox instance by profile path
    pub async fn find_by_profile(
        &self,
        profile_path: &str,
    ) -> Option<CamoufoxLaunchResult> {
        // Clean up dead instances first
        let _ = self.cleanup_dead().await;

        let target_path = std::path::Path::new(profile_path)
            .canonicalize()
            .unwrap_or_else(|_| std::path::Path::new(profile_path).to_path_buf());

        let inner = self.inner.lock().await;
        for (id, instance) in inner.instances.iter() {
            if let Some(instance_profile_path) = &instance.profile_path {
                let instance_path = std::path::Path::new(instance_profile_path)
                    .canonicalize()
                    .unwrap_or_else(|_| {
                        std::path::Path::new(instance_profile_path).to_path_buf()
                    });

                if instance_path == target_path {
                    if let Some(pid) = instance.process_id {
                        if is_process_running(pid) {
                            return Some(CamoufoxLaunchResult {
                                id: id.clone(),
                                processId: instance.process_id,
                                profilePath: instance.profile_path.clone(),
                                url: instance.url.clone(),
                            });
                        }
                    }
                }
            }
        }

        None
    }

    /// Clean up dead instances
    pub async fn cleanup_dead(&self) -> Vec<String> {
        let mut dead = Vec::new();
        let mut to_remove = Vec::new();

        {
            let inner = self.inner.lock().await;
            for (id, instance) in inner.instances.iter() {
                if let Some(pid) = instance.process_id {
                    if !is_process_running(pid) {
                        dead.push(id.clone());
                        to_remove.push(id.clone());
                    }
                } else {
                    dead.push(id.clone());
                    to_remove.push(id.clone());
                }
            }
        }

        if !to_remove.is_empty() {
            let mut inner = self.inner.lock().await;
            for id in &to_remove {
                inner.instances.remove(id);
            }
        }

        dead
    }

    /// Get the Camoufox profile directory for a given profile name
    pub fn get_profile_dir(profile_name: &str) -> Result<PathBuf, String> {
        let profiles_dir = crate::camoufox_downloader::get_profiles_dir()?;
        Ok(profiles_dir.join(profile_name))
    }
}

/// Kill a process by PID
fn kill_process(pid: u32) -> bool {
    #[cfg(unix)]
    {
        let result = std::process::Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .status();

        match result {
            Ok(status) => status.success(),
            Err(e) => {
                log::warn!("Failed to kill process {}: {}", pid, e);
                false
            }
        }
    }

    #[cfg(windows)]
    {
        let result = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T"])
            .status();

        match result {
            Ok(status) => status.success(),
            Err(e) => {
                log::warn!("Failed to kill process {}: {}", pid, e);
                false
            }
        }
    }
}

/// Check if a process is still running
fn is_process_running(pid: u32) -> bool {
    use sysinfo::{Pid, System};
    let system = System::new_all();
    system.process(Pid::from(pid as usize)).is_some()
}

lazy_static! {
    static ref CAMOUFOX_MANAGER: CamoufoxManager = CamoufoxManager::new();
}
