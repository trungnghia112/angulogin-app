//! Platform-specific logic for ungoogled-chromium.
//!
//! Handles GitHub API URLs, asset name matching, binary paths,
//! and extraction methods per OS/architecture.

use std::path::{Path, PathBuf};

/// GitHub repos per platform (each platform has its own repo)
const GITHUB_REPO_MACOS: &str = "ungoogled-software/ungoogled-chromium-macos";
const GITHUB_REPO_WINDOWS: &str = "ungoogled-software/ungoogled-chromium-windows";
const GITHUB_REPO_LINUX: &str = "ungoogled-software/ungoogled-chromium-portablelinux";

/// GitHub API base
const GITHUB_API: &str = "https://api.github.com/repos";

/// Platform info for the current OS/arch
pub struct PlatformInfo {
    /// GitHub repo (org/name)
    pub github_repo: &'static str,
    /// Substring to match in asset filename
    pub asset_match: &'static str,
    /// Expected archive extension
    pub archive_ext: &'static str,
    /// Archive format for extraction
    pub archive_format: ArchiveFormat,
}

/// Supported archive formats
pub enum ArchiveFormat {
    Dmg,
    Zip,
    TarXz,
}

impl PlatformInfo {
    /// Detect current platform and return matching info
    pub fn current() -> Result<Self, String> {
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        {
            Ok(PlatformInfo {
                github_repo: GITHUB_REPO_MACOS,
                asset_match: "arm64-macos.dmg",
                archive_ext: "dmg",
                archive_format: ArchiveFormat::Dmg,
            })
        }
        #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
        {
            Ok(PlatformInfo {
                github_repo: GITHUB_REPO_MACOS,
                asset_match: "x86_64-macos.dmg",
                archive_ext: "dmg",
                archive_format: ArchiveFormat::Dmg,
            })
        }
        #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
        {
            Ok(PlatformInfo {
                github_repo: GITHUB_REPO_WINDOWS,
                asset_match: "windows_x64.zip",
                archive_ext: "zip",
                archive_format: ArchiveFormat::Zip,
            })
        }
        #[cfg(all(target_os = "windows", target_arch = "aarch64"))]
        {
            Ok(PlatformInfo {
                github_repo: GITHUB_REPO_WINDOWS,
                asset_match: "windows_arm64.zip",
                archive_ext: "zip",
                archive_format: ArchiveFormat::Zip,
            })
        }
        #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
        {
            Ok(PlatformInfo {
                github_repo: GITHUB_REPO_LINUX,
                asset_match: "x86_64_linux.tar.xz",
                archive_ext: "tar.xz",
                archive_format: ArchiveFormat::TarXz,
            })
        }
        #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
        {
            Ok(PlatformInfo {
                github_repo: GITHUB_REPO_LINUX,
                asset_match: "arm64_linux.tar.xz",
                archive_ext: "tar.xz",
                archive_format: ArchiveFormat::TarXz,
            })
        }
        #[cfg(not(any(
            all(target_os = "macos", target_arch = "aarch64"),
            all(target_os = "macos", target_arch = "x86_64"),
            all(target_os = "windows", target_arch = "x86_64"),
            all(target_os = "windows", target_arch = "aarch64"),
            all(target_os = "linux", target_arch = "x86_64"),
            all(target_os = "linux", target_arch = "aarch64"),
        )))]
        {
            Err("Unsupported platform/architecture for ungoogled-chromium".to_string())
        }
    }
}

/// Get the GitHub API URL for latest release
pub fn get_latest_release_api_url() -> Result<String, String> {
    let info = PlatformInfo::current()?;
    Ok(format!("{}/{}/releases/latest", GITHUB_API, info.github_repo))
}

/// Get the binary path within the install directory (platform-specific)
pub fn get_binary_path(install_dir: &Path) -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        install_dir
            .join("Chromium.app")
            .join("Contents")
            .join("MacOS")
            .join("Chromium")
    }
    #[cfg(target_os = "windows")]
    {
        install_dir.join("chrome.exe")
    }
    #[cfg(target_os = "linux")]
    {
        install_dir.join("chrome")
    }
    #[cfg(not(any(
        target_os = "macos",
        target_os = "windows",
        target_os = "linux",
    )))]
    {
        install_dir.join("chrome")
    }
}

/// Find the chrome binary recursively (Windows zip extraction may nest dirs)
pub fn find_chrome_binary(dir: &Path) -> Option<PathBuf> {
    let direct = get_binary_path(dir);
    if direct.exists() {
        return Some(direct);
    }

    // Check one level nested (common with zip extraction)
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let nested = get_binary_path(&path);
                if nested.exists() {
                    return Some(nested);
                }

                // macOS: Check for .app bundle in subdirectory
                #[cfg(target_os = "macos")]
                {
                    if path.extension().map_or(false, |ext| ext == "app") {
                        let macos_exe = path.join("Contents").join("MacOS").join("Chromium");
                        if macos_exe.exists() {
                            return Some(macos_exe);
                        }
                    }
                }
            }
        }
    }

    None
}
