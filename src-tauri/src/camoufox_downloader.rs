//! Camoufox binary downloader and manager.
//!
//! Handles downloading, extracting, and managing the Camoufox browser binary.
//! Binary is auto-downloaded on first use from GitHub releases.

use directories::BaseDirs;
use futures_util::StreamExt;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Window};
use zip::ZipArchive;

/// Camoufox version to download
const CAMOUFOX_VERSION: &str = "135.0.1-beta.24";

/// GitHub release base URL
const GITHUB_RELEASE_BASE: &str = "https://github.com/daijro/camoufox/releases/download";

/// Download progress event name (emitted to frontend)
const DOWNLOAD_PROGRESS_EVENT: &str = "camoufox-download-progress";

/// Download status event name
const DOWNLOAD_STATUS_EVENT: &str = "camoufox-download-status";

/// Platform-specific binary info
struct PlatformBinary {
    archive_suffix: &'static str,
    executable_name: &'static str,
}

impl PlatformBinary {
    fn current() -> Result<Self, String> {
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        {
            Ok(PlatformBinary {
                archive_suffix: "mac.arm64.zip",
                executable_name: "camoufox-bin",
            })
        }
        #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
        {
            Ok(PlatformBinary {
                archive_suffix: "mac.x86_64.zip",
                executable_name: "camoufox-bin",
            })
        }
        #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
        {
            Ok(PlatformBinary {
                archive_suffix: "win.x86_64.zip",
                executable_name: "camoufox.exe",
            })
        }
        #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
        {
            Ok(PlatformBinary {
                archive_suffix: "lin.x86_64.zip",
                executable_name: "camoufox-bin",
            })
        }
        #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
        {
            Ok(PlatformBinary {
                archive_suffix: "lin.arm64.zip",
                executable_name: "camoufox-bin",
            })
        }
        #[cfg(not(any(
            all(target_os = "macos", target_arch = "aarch64"),
            all(target_os = "macos", target_arch = "x86_64"),
            all(target_os = "windows", target_arch = "x86_64"),
            all(target_os = "linux", target_arch = "x86_64"),
            all(target_os = "linux", target_arch = "aarch64"),
        )))]
        {
            Err("Unsupported platform/architecture for Camoufox".to_string())
        }
    }
}

/// Get the Camoufox install directory: ~/.angulogin/camoufox/{version}/
pub fn get_install_dir() -> Result<PathBuf, String> {
    let base_dirs = BaseDirs::new().ok_or("Failed to get base directories")?;
    let mut path = base_dirs.data_local_dir().to_path_buf();
    path.push(if cfg!(debug_assertions) {
        "AnguLoginDev"
    } else {
        "AnguLogin"
    });
    path.push("camoufox");
    path.push(CAMOUFOX_VERSION);
    Ok(path)
}

/// Get the Camoufox profiles directory: ~/.angulogin/camoufox-profiles/
pub fn get_profiles_dir() -> Result<PathBuf, String> {
    let base_dirs = BaseDirs::new().ok_or("Failed to get base directories")?;
    let mut path = base_dirs.data_local_dir().to_path_buf();
    path.push(if cfg!(debug_assertions) {
        "AnguLoginDev"
    } else {
        "AnguLogin"
    });
    path.push("camoufox-profiles");
    Ok(path)
}

/// Check if Camoufox binary is already installed
pub fn is_installed() -> Result<bool, String> {
    let install_dir = get_install_dir()?;
    let platform = PlatformBinary::current()?;
    let exe_path = find_executable(&install_dir, platform.executable_name);
    Ok(exe_path.is_some())
}

/// Get the path to the Camoufox executable
pub fn get_executable_path() -> Result<PathBuf, String> {
    let install_dir = get_install_dir()?;
    let platform = PlatformBinary::current()?;
    find_executable(&install_dir, platform.executable_name)
        .ok_or_else(|| format!("Camoufox executable not found in {}", install_dir.display()))
}

/// Find the executable within the install directory (may be nested)
fn find_executable(dir: &Path, exe_name: &str) -> Option<PathBuf> {
    if !dir.exists() {
        return None;
    }

    // Check direct path first
    let direct = dir.join(exe_name);
    if direct.exists() {
        return Some(direct);
    }

    // Check one level nested (common after zip extraction)
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let nested = path.join(exe_name);
                if nested.exists() {
                    return Some(nested);
                }
            }
        }
    }

    // macOS: Check inside .app bundle
    #[cfg(target_os = "macos")]
    {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map_or(false, |ext| ext == "app") {
                    let macos_exe = path.join("Contents").join("MacOS").join(exe_name);
                    if macos_exe.exists() {
                        return Some(macos_exe);
                    }
                    // Also check for camoufox (without -bin)
                    let alt_exe = path.join("Contents").join("MacOS").join("camoufox");
                    if alt_exe.exists() {
                        return Some(alt_exe);
                    }
                }
            }
        }
    }

    None
}

/// Build the download URL for the current platform
fn get_download_url() -> Result<String, String> {
    let platform = PlatformBinary::current()?;
    Ok(format!(
        "{}/v{}/camoufox-{}-{}",
        GITHUB_RELEASE_BASE, CAMOUFOX_VERSION, CAMOUFOX_VERSION, platform.archive_suffix
    ))
}

/// Download and extract Camoufox binary
/// Emits progress events to the Tauri window
pub async fn download_and_install(window: Option<&Window>) -> Result<PathBuf, String> {
    let install_dir = get_install_dir()?;
    let url = get_download_url()?;

    eprintln!("[Camoufox] Download URL: {}", url);
    eprintln!("[Camoufox] Install dir: {}", install_dir.display());

    // Emit status: starting
    emit_status(window, "downloading", &format!("Downloading Camoufox v{}...", CAMOUFOX_VERSION));

    // Create install directory
    std::fs::create_dir_all(&install_dir)
        .map_err(|e| format!("Failed to create install directory: {e}"))?;

    // Download to temp file
    let temp_path = install_dir.join("camoufox-download.zip");
    download_file(&url, &temp_path, window).await?;

    // Emit status: extracting
    emit_status(window, "extracting", "Extracting Camoufox...");

    // Extract
    extract_zip(&temp_path, &install_dir)?;

    // Clean up temp file
    let _ = std::fs::remove_file(&temp_path);

    // Set executable permissions on Unix
    #[cfg(unix)]
    {
        let platform = PlatformBinary::current()?;
        if let Some(exe_path) = find_executable(&install_dir, platform.executable_name) {
            set_executable_permission(&exe_path)?;
        }
    }

    // Verify installation
    let platform = PlatformBinary::current()?;
    let exe_path = find_executable(&install_dir, platform.executable_name)
        .ok_or("Camoufox executable not found after extraction")?;

    eprintln!("[Camoufox] Installed successfully at: {}", exe_path.display());

    // Emit status: complete
    emit_status(window, "complete", "Camoufox installed successfully");

    Ok(exe_path)
}

/// Download a file with progress tracking
async fn download_file(url: &str, dest: &Path, window: Option<&Window>) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("AnguLogin/1.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to download Camoufox: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status {}: {}",
            response.status(),
            url
        ));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    let mut file = std::fs::File::create(dest)
        .map_err(|e| format!("Failed to create download file: {e}"))?;

    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download stream error: {e}"))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write download data: {e}"))?;

        downloaded += chunk.len() as u64;

        // Emit progress every ~100KB to avoid flooding
        if total_size > 0 && downloaded % (100 * 1024) < chunk.len() as u64 {
            let progress = (downloaded as f64 / total_size as f64 * 100.0) as u32;
            emit_progress(window, progress, downloaded, total_size);
        }
    }

    // Final progress
    emit_progress(window, 100, downloaded, total_size);

    Ok(())
}

/// Extract a zip archive
fn extract_zip(archive_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let file = std::fs::File::open(archive_path)
        .map_err(|e| format!("Failed to open archive: {e}"))?;

    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read zip archive: {e}"))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry {i}: {e}"))?;

        let out_path = match entry.enclosed_name() {
            Some(path) => dest_dir.join(path),
            None => continue,
        };

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)
                .map_err(|e| format!("Failed to create directory: {e}"))?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent directory: {e}"))?;
            }
            let mut outfile = std::fs::File::create(&out_path)
                .map_err(|e| format!("Failed to create file: {e}"))?;
            std::io::copy(&mut entry, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {e}"))?;
        }
    }

    Ok(())
}

/// Set executable permission on Unix
#[cfg(unix)]
fn set_executable_permission(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let metadata = std::fs::metadata(path)
        .map_err(|e| format!("Failed to read metadata: {e}"))?;
    let mut permissions = metadata.permissions();
    permissions.set_mode(0o755);
    std::fs::set_permissions(path, permissions)
        .map_err(|e| format!("Failed to set executable permission: {e}"))?;

    // Also set permissions for all files in the same directory that might need it
    if let Some(parent) = path.parent() {
        if let Ok(entries) = std::fs::read_dir(parent) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() {
                    if let Ok(meta) = std::fs::metadata(&p) {
                        let mut perms = meta.permissions();
                        let current_mode = perms.mode();
                        // If file has any execute bit, ensure owner execute
                        if current_mode & 0o111 != 0 || p.extension().is_none() {
                            perms.set_mode(current_mode | 0o755);
                            let _ = std::fs::set_permissions(&p, perms);
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

/// Get installed Camoufox version info
pub fn get_version_info() -> Result<CamoufoxVersionInfo, String> {
    let installed = is_installed()?;
    let install_dir = get_install_dir()?;

    Ok(CamoufoxVersionInfo {
        version: CAMOUFOX_VERSION.to_string(),
        installed,
        install_path: install_dir.to_string_lossy().to_string(),
        executable_path: if installed {
            get_executable_path().ok().map(|p| p.to_string_lossy().to_string())
        } else {
            None
        },
    })
}

/// Camoufox version information (serialized to frontend)
#[derive(serde::Serialize, Clone)]
pub struct CamoufoxVersionInfo {
    pub version: String,
    pub installed: bool,
    pub install_path: String,
    pub executable_path: Option<String>,
}

/// Download progress payload (emitted as Tauri event)
#[derive(serde::Serialize, Clone)]
struct DownloadProgress {
    percent: u32,
    downloaded: u64,
    total: u64,
}

/// Download status payload
#[derive(serde::Serialize, Clone)]
struct DownloadStatus {
    status: String,
    message: String,
}

/// Emit download progress to frontend
fn emit_progress(window: Option<&Window>, percent: u32, downloaded: u64, total: u64) {
    if let Some(window) = window {
        let _ = window.emit(
            DOWNLOAD_PROGRESS_EVENT,
            DownloadProgress {
                percent,
                downloaded,
                total,
            },
        );
    }
}

/// Emit download status to frontend
fn emit_status(window: Option<&Window>, status: &str, message: &str) {
    eprintln!("[Camoufox] Status: {} - {}", status, message);
    if let Some(window) = window {
        let _ = window.emit(
            DOWNLOAD_STATUS_EVENT,
            DownloadStatus {
                status: status.to_string(),
                message: message.to_string(),
            },
        );
    }
}

/// Remove Camoufox installation
pub fn uninstall() -> Result<(), String> {
    let install_dir = get_install_dir()?;
    if install_dir.exists() {
        std::fs::remove_dir_all(&install_dir)
            .map_err(|e| format!("Failed to remove Camoufox installation: {e}"))?;
        eprintln!("[Camoufox] Uninstalled from {}", install_dir.display());
    }
    Ok(())
}
