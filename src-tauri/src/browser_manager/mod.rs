//! Ungoogled-Chromium browser manager.
//!
//! Handles downloading, extracting, and managing the ungoogled-chromium browser
//! for antidetect fingerprint spoofing. Uses native C++ level Bromite patches
//! instead of JS extensions for undetectable spoofing.

pub mod download;
pub mod platform;

use directories::BaseDirs;
use std::path::PathBuf;

/// Get the browser install directory: ~/.angulogin/browsers/ungoogled-chromium/
pub fn get_install_dir() -> Result<PathBuf, String> {
    let base_dirs = BaseDirs::new().ok_or("Failed to get base directories")?;
    let mut path = base_dirs.data_local_dir().to_path_buf();
    path.push(if cfg!(debug_assertions) {
        "AnguLoginDev"
    } else {
        "AnguLogin"
    });
    path.push("browsers");
    path.push("ungoogled-chromium");
    Ok(path)
}

/// Check if ungoogled-chromium is installed
pub fn is_installed() -> Result<bool, String> {
    let install_dir = get_install_dir()?;
    let binary = platform::get_binary_path(&install_dir);
    Ok(binary.exists())
}

/// Get the path to the ungoogled-chromium executable
pub fn get_executable_path() -> Result<PathBuf, String> {
    let install_dir = get_install_dir()?;
    let binary = platform::get_binary_path(&install_dir);
    if binary.exists() {
        Ok(binary)
    } else {
        Err(format!(
            "ungoogled-chromium not found at {}",
            binary.display()
        ))
    }
}

/// Get installed version info
pub fn get_version_info() -> Result<BrowserVersionInfo, String> {
    let install_dir = get_install_dir()?;
    let installed = is_installed()?;
    let version_file = install_dir.join("version.json");

    let version = if version_file.exists() {
        let content = std::fs::read_to_string(&version_file)
            .map_err(|e| format!("Failed to read version file: {e}"))?;
        let info: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse version file: {e}"))?;
        info["version"].as_str().unwrap_or("unknown").to_string()
    } else {
        "unknown".to_string()
    };

    Ok(BrowserVersionInfo {
        browser: "ungoogled-chromium".to_string(),
        version,
        installed,
        install_path: install_dir.to_string_lossy().to_string(),
        executable_path: if installed {
            get_executable_path()
                .ok()
                .map(|p| p.to_string_lossy().to_string())
        } else {
            None
        },
    })
}

/// Build the native antidetect flags for ungoogled-chromium.
/// These flags activate Bromite fingerprint patches at the C++ level.
pub fn get_native_antidetect_flags(
    webgl_renderer: Option<&str>,
    webgl_vendor: Option<&str>,
) -> Vec<String> {
    let mut flags = vec![
        // Bromite canvas fingerprint deception (C++ level, undetectable by JS)
        "--fingerprinting-canvas-image-data-noise".to_string(),
        // Bromite measureText noise
        "--fingerprinting-canvas-measuretext-noise".to_string(),
        // Bromite clientRects noise (±0.0003%)
        "--fingerprinting-client-rects-noise".to_string(),
    ];

    // Build feature flags
    let mut features: Vec<String> = vec![
        "ReducedSystemInfo".to_string(),      // hardwareConcurrency = 2
        "RemoveClientHints".to_string(),       // Remove Client Hints headers
        "NoCrossOriginReferrers".to_string(),  // Strip cross-origin referrers
    ];

    // WebGL spoof with profile-specific renderer/vendor
    let renderer = webgl_renderer.unwrap_or("ANGLE (Intel, Intel(R) HD Graphics, OpenGL 4.1)");
    let vendor = webgl_vendor.unwrap_or("Google Inc. (Intel)");
    features.push(format!(
        "SpoofWebGLInfo:renderer/{}/vendor/{}",
        renderer, vendor
    ));

    flags.push(format!("--enable-features={}", features.join(",")));

    flags
}

/// Browser version information (serialized to frontend)
#[derive(serde::Serialize, Clone)]
pub struct BrowserVersionInfo {
    pub browser: String,
    pub version: String,
    pub installed: bool,
    pub install_path: String,
    pub executable_path: Option<String>,
}
