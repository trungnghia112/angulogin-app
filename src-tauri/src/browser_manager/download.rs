//! Download and extraction logic for ungoogled-chromium.
//!
//! Fetches latest release from GitHub API, downloads the platform-specific
//! archive, verifies SHA256, and extracts the browser binary.

use crate::browser_manager::platform::{self, ArchiveFormat, PlatformInfo};
use crate::browser_manager::{self};
use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::io::Write;
use std::path::Path;
use std::time::Duration;
use tauri::{Emitter, Window};

/// Event names for frontend communication
const DOWNLOAD_PROGRESS_EVENT: &str = "uc-download-progress";
const DOWNLOAD_STATUS_EVENT: &str = "uc-download-status";

/// Download timeout: 10 minutes for large binary (~150MB)
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(600);
/// API request timeout: 30 seconds
const API_TIMEOUT: Duration = Duration::from_secs(30);

/// Download progress payload
#[derive(serde::Serialize, Clone)]
pub struct DownloadProgress {
    pub percent: u32,
    pub downloaded: u64,
    pub total: u64,
}

/// Download status payload
#[derive(serde::Serialize, Clone)]
pub struct DownloadStatus {
    pub status: String,
    pub message: String,
}

/// Release asset info parsed from GitHub API
#[derive(Debug)]
struct ReleaseAsset {
    download_url: String,
    sha256: String,
    size: u64,
    version: String,
}

/// Create a reqwest client with timeout and user-agent
fn create_http_client(timeout: Duration) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("AnguLogin/1.0")
        .timeout(timeout)
        .connect_timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))
}

/// Fetch the latest release info from GitHub API
async fn fetch_latest_release() -> Result<ReleaseAsset, String> {
    let api_url = platform::get_latest_release_api_url()?;
    let platform_info = PlatformInfo::current()?;

    log::info!("[UC] Fetching release from: {}", api_url);

    let client = create_http_client(API_TIMEOUT)?;

    let response = client
        .get(&api_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch release info: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub API returned status {}: {}",
            response.status(),
            api_url
        ));
    }

    let release: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse release JSON: {e}"))?;

    let version = release["tag_name"]
        .as_str()
        .unwrap_or("unknown")
        .to_string();

    // Find the matching asset for our platform
    let assets = release["assets"]
        .as_array()
        .ok_or("No assets found in release")?;

    // Also look for a .sha256 checksum file
    let mut sha256_from_file = String::new();
    for asset in assets {
        let name = asset["name"].as_str().unwrap_or("");
        if name.contains(platform_info.asset_match) && name.ends_with(".sha256") {
            // Found a .sha256 checksum companion file
            if let Some(url) = asset["browser_download_url"].as_str() {
                sha256_from_file = fetch_sha256_file(url).await.unwrap_or_default();
            }
        }
    }

    for asset in assets {
        let name = asset["name"].as_str().unwrap_or("");
        if name.contains(platform_info.asset_match) && !name.ends_with(".sha256") {
            let download_url = asset["browser_download_url"]
                .as_str()
                .ok_or("Missing download URL")?
                .to_string();

            // SHA256: try digest field first, then .sha256 file, then empty
            let sha256 = {
                let digest = asset["digest"]
                    .as_str()
                    .unwrap_or("")
                    .replace("sha256:", "")
                    .trim()
                    .to_string();
                if !digest.is_empty() {
                    digest
                } else if !sha256_from_file.is_empty() {
                    log::info!("[UC] Using SHA256 from companion checksum file");
                    sha256_from_file.clone()
                } else {
                    log::warn!("[UC] No SHA256 checksum available — download will not be verified");
                    String::new()
                }
            };

            let size = asset["size"].as_u64().unwrap_or(0);

            log::info!("[UC] Found asset: {} ({}MB)", name, size / 1024 / 1024);

            return Ok(ReleaseAsset {
                download_url,
                sha256,
                size,
                version,
            });
        }
    }

    Err(format!(
        "No matching asset found for platform pattern '{}'",
        platform_info.asset_match
    ))
}

/// Fetch SHA256 hash from a companion .sha256 checksum file
async fn fetch_sha256_file(url: &str) -> Result<String, String> {
    let client = create_http_client(API_TIMEOUT)?;
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch SHA256 file: {e}"))?;

    if !response.status().is_success() {
        return Err("SHA256 file not available".to_string());
    }

    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read SHA256 file: {e}"))?;

    // Format is usually: "hash  filename" or just "hash"
    let hash = text.split_whitespace().next().unwrap_or("").to_string();
    if hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit()) {
        Ok(hash)
    } else {
        Err("Invalid SHA256 hash format".to_string())
    }
}

/// Download and install ungoogled-chromium.
/// Emits progress events to the Tauri window.
pub async fn download_and_install(window: Option<&Window>) -> Result<String, String> {
    let install_dir = browser_manager::get_install_dir()?;
    let platform_info = PlatformInfo::current()?;

    // Step 1: Fetch latest release
    emit_status(window, "checking", "Checking for latest version...");
    let release = fetch_latest_release().await?;

    log::info!("[UC] Download URL: {}", release.download_url);
    log::info!("[UC] Version: {}", release.version);
    log::info!("[UC] Size: {}MB", release.size / 1024 / 1024);

    // Step 2: Create install directory
    std::fs::create_dir_all(&install_dir)
        .map_err(|e| format!("Failed to create install directory: {e}"))?;

    // Step 3: Download archive
    emit_status(
        window,
        "downloading",
        &format!(
            "Downloading ungoogled-chromium v{} ({}MB)...",
            release.version,
            release.size / 1024 / 1024
        ),
    );

    let archive_name = format!("ungoogled-chromium.{}", platform_info.archive_ext);
    let archive_path = install_dir.join(&archive_name);
    download_file(&release.download_url, &archive_path, window).await?;

    // Step 4: Verify SHA256
    if !release.sha256.is_empty() {
        emit_status(window, "verifying", "Verifying download integrity...");
        verify_sha256(&archive_path, &release.sha256)?;
        log::info!("[UC] SHA256 verification passed");
    } else {
        log::warn!("[UC] Skipping SHA256 verification — no checksum available");
    }

    // Step 5: Extract
    emit_status(window, "extracting", "Extracting browser...");
    match platform_info.archive_format {
        ArchiveFormat::Zip => extract_zip(&archive_path, &install_dir)?,
        ArchiveFormat::TarXz => extract_tar_xz(&archive_path, &install_dir)?,
        ArchiveFormat::Dmg => extract_dmg(&archive_path, &install_dir)?,
    }

    // Step 6: Cleanup archive
    let _ = std::fs::remove_file(&archive_path);

    // Step 7: macOS quarantine removal
    #[cfg(target_os = "macos")]
    {
        log::debug!("[UC] Removing macOS quarantine attribute...");
        let _ = std::process::Command::new("xattr")
            .args([
                "-r",
                "-d",
                "com.apple.quarantine",
                &install_dir.to_string_lossy(),
            ])
            .status();
    }

    // Step 8: Set executable permissions on Unix
    #[cfg(unix)]
    {
        if let Some(exe_path) = platform::find_chrome_binary(&install_dir) {
            set_executable_permissions(&exe_path)?;
        }
    }

    // Step 9: Save version info
    let version_info = serde_json::json!({
        "version": release.version,
        "installed_at": chrono::Utc::now().to_rfc3339(),
        "sha256": release.sha256,
    });
    let version_file = install_dir.join("version.json");
    std::fs::write(&version_file, serde_json::to_string_pretty(&version_info).unwrap())
        .map_err(|e| format!("Failed to write version file: {e}"))?;

    // Step 10: Verify installation
    let exe_path = platform::find_chrome_binary(&install_dir)
        .ok_or("ungoogled-chromium binary not found after extraction")?;

    log::info!("[UC] Installed successfully at: {}", exe_path.display());

    emit_status(
        window,
        "complete",
        "ungoogled-chromium installed successfully!",
    );

    Ok(exe_path.to_string_lossy().to_string())
}

/// Download a file with progress tracking and timeout
async fn download_file(url: &str, dest: &Path, window: Option<&Window>) -> Result<(), String> {
    let client = create_http_client(DOWNLOAD_TIMEOUT)?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to start download: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    let mut file =
        std::fs::File::create(dest).map_err(|e| format!("Failed to create download file: {e}"))?;

    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download stream error: {e}"))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write download data: {e}"))?;

        downloaded += chunk.len() as u64;

        // Emit progress every ~500KB
        if total_size > 0 && downloaded % (500 * 1024) < chunk.len() as u64 {
            let progress = (downloaded as f64 / total_size as f64 * 100.0) as u32;
            emit_progress(window, progress, downloaded, total_size);
        }
    }

    emit_progress(window, 100, downloaded, total_size);
    Ok(())
}

/// Verify SHA256 hash of downloaded file
fn verify_sha256(file_path: &Path, expected: &str) -> Result<(), String> {
    let mut file =
        std::fs::File::open(file_path).map_err(|e| format!("Failed to open file for hash: {e}"))?;

    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher)
        .map_err(|e| format!("Failed to compute hash: {e}"))?;

    let result = format!("{:x}", hasher.finalize());

    if result != expected {
        return Err(format!(
            "SHA256 mismatch!\nExpected: {}\nGot: {}",
            expected, result
        ));
    }

    Ok(())
}

/// Extract a ZIP archive (Windows)
fn extract_zip(archive_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let file =
        std::fs::File::open(archive_path).map_err(|e| format!("Failed to open archive: {e}"))?;

    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {e}"))?;

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

/// Extract a tar.xz archive (Linux)
fn extract_tar_xz(archive_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let file = std::fs::File::open(archive_path)
        .map_err(|e| format!("Failed to open archive: {e}"))?;

    // Decompress xz
    let decompressor = xz2::read::XzDecoder::new(file);

    // Untar
    let mut archive = tar::Archive::new(decompressor);
    archive
        .unpack(dest_dir)
        .map_err(|e| format!("Failed to extract tar.xz: {e}"))?;

    Ok(())
}

/// Extract from macOS .dmg file
fn extract_dmg(dmg_path: &Path, dest_dir: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        let mount_point = dest_dir.join("_dmg_mount");
        std::fs::create_dir_all(&mount_point)
            .map_err(|e| format!("Failed to create mount point: {e}"))?;

        // Mount DMG
        let mount_output = Command::new("hdiutil")
            .args([
                "attach",
                &dmg_path.to_string_lossy(),
                "-nobrowse",
                "-noautoopen",
                "-mountpoint",
                &mount_point.to_string_lossy(),
            ])
            .output()
            .map_err(|e| format!("Failed to mount DMG: {e}"))?;

        if !mount_output.status.success() {
            let stderr = String::from_utf8_lossy(&mount_output.stderr);
            return Err(format!("Failed to mount DMG: {}", stderr));
        }

        log::debug!("[UC] DMG mounted at: {}", mount_point.display());

        // Find Chromium.app in the mounted volume
        let app_src = mount_point.join("Chromium.app");
        let app_dest = dest_dir.join("Chromium.app");

        if !app_src.exists() {
            // Try to find .app in the mount point
            if let Ok(entries) = std::fs::read_dir(&mount_point) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().map_or(false, |ext| ext == "app") {
                        // Copy this .app bundle
                        let dest = dest_dir.join(path.file_name().unwrap());
                        copy_dir_recursive(&path, &dest)?;
                        break;
                    }
                }
            }
        } else {
            copy_dir_recursive(&app_src, &app_dest)?;
        }

        // Unmount DMG
        let _ = Command::new("hdiutil")
            .args(["detach", &mount_point.to_string_lossy(), "-force"])
            .output();

        // Remove mount point
        let _ = std::fs::remove_dir_all(&mount_point);

        log::debug!("[UC] DMG extracted successfully");
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (dmg_path, dest_dir);
        Err("DMG extraction is only supported on macOS".to_string())
    }
}

/// Recursively copy a directory
fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    if !src.is_dir() {
        std::fs::copy(src, dest).map_err(|e| format!("Failed to copy file: {e}"))?;
        return Ok(());
    }

    std::fs::create_dir_all(dest).map_err(|e| format!("Failed to create directory: {e}"))?;

    let entries =
        std::fs::read_dir(src).map_err(|e| format!("Failed to read directory: {e}"))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            std::fs::copy(&src_path, &dest_path)
                .map_err(|e| format!("Failed to copy {}: {e}", src_path.display()))?;
        }
    }

    Ok(())
}

/// Set executable permissions on Unix (only on the Chromium binary)
#[cfg(unix)]
fn set_executable_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let metadata =
        std::fs::metadata(path).map_err(|e| format!("Failed to read metadata: {e}"))?;
    let mut permissions = metadata.permissions();
    permissions.set_mode(0o755);
    std::fs::set_permissions(path, permissions)
        .map_err(|e| format!("Failed to set executable permission: {e}"))?;

    Ok(())
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
    log::debug!("[UC] Status: {} - {}", status, message);
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

/// Remove ungoogled-chromium installation
#[allow(dead_code)]
pub fn uninstall() -> Result<(), String> {
    let install_dir = browser_manager::get_install_dir()?;
    if install_dir.exists() {
        std::fs::remove_dir_all(&install_dir)
            .map_err(|e| format!("Failed to remove installation: {e}"))?;
        log::info!("[UC] Uninstalled from {}", install_dir.display());
    }
    Ok(())
}
