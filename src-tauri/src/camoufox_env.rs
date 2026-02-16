//! Camoufox environment variable converter.
//!
//! Converts fingerprint config to Camoufox-compatible environment variables.
//! Camoufox reads its config via CAMOU_CONFIG_N chunked environment variables.

use std::collections::HashMap;

/// Maximum size per env var chunk (Camoufox limitation)
const MAX_ENV_VAR_SIZE: usize = 30000;

/// Convert a fingerprint config (HashMap) to Camoufox environment variables.
/// The config is serialized to JSON, then split into chunks under CAMOU_CONFIG_0,
/// CAMOU_CONFIG_1, etc. since single env vars have size limits.
pub fn config_to_env_vars(
    config: &HashMap<String, serde_json::Value>,
) -> Result<HashMap<String, String>, String> {
    let config_json = serde_json::to_string(config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;

    let mut env_vars = HashMap::new();

    // Split config into chunks
    let chunks: Vec<&str> = config_json
        .as_bytes()
        .chunks(MAX_ENV_VAR_SIZE)
        .map(|chunk| std::str::from_utf8(chunk).unwrap_or(""))
        .collect();

    for (i, chunk) in chunks.iter().enumerate() {
        env_vars.insert(format!("CAMOU_CONFIG_{}", i), chunk.to_string());
    }

    Ok(env_vars)
}

/// Convert a JSON string config to environment variables
pub fn json_config_to_env_vars(
    config_json: &str,
) -> Result<HashMap<String, String>, String> {
    let config: HashMap<String, serde_json::Value> =
        serde_json::from_str(config_json)
            .map_err(|e| format!("Failed to parse fingerprint config JSON: {e}"))?;
    config_to_env_vars(&config)
}

/// Get fontconfig env var for Linux font spoofing
#[cfg(target_os = "linux")]
pub fn get_fontconfig_env(target_os: &str, executable_path: &std::path::Path) -> Option<String> {
    if target_os == "linux" {
        return None; // Native Linux, dont need fontconfig override
    }

    // For non-Linux OS spoofing on Linux, point to bundled fontconfig
    let fontconfig_dir = executable_path
        .parent()?
        .join("fontconfig");

    if fontconfig_dir.exists() {
        Some(fontconfig_dir.to_string_lossy().to_string())
    } else {
        None
    }
}

#[cfg(not(target_os = "linux"))]
pub fn get_fontconfig_env(_target_os: &str, _executable_path: &std::path::Path) -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_to_env_vars() {
        let mut config = HashMap::new();
        config.insert("screen.width".to_string(), serde_json::json!(1920));
        config.insert("screen.height".to_string(), serde_json::json!(1080));
        config.insert(
            "navigator.userAgent".to_string(),
            serde_json::json!("Mozilla/5.0"),
        );

        let env_vars = config_to_env_vars(&config).unwrap();
        assert!(env_vars.contains_key("CAMOU_CONFIG_0"));

        let chunk = &env_vars["CAMOU_CONFIG_0"];
        assert!(chunk.contains("screen.width"));
        assert!(chunk.contains("1920"));
    }

    #[test]
    fn test_json_config_to_env_vars() {
        let json = r#"{"screen.width": 1920, "navigator.userAgent": "Test"}"#;
        let env_vars = json_config_to_env_vars(json).unwrap();
        assert!(!env_vars.is_empty());
    }
}
