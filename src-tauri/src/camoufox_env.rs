//! Camoufox environment variable converter.
//!
//! Converts fingerprint config to Camoufox-compatible environment variables.
//! Camoufox reads its config via the CAMOU_CONFIG environment variable.

use std::collections::HashMap;

/// Convert a fingerprint config (HashMap) to Camoufox environment variables.
/// Sets a single CAMOU_CONFIG env var with the entire JSON config.
pub fn config_to_env_vars(
    config: &HashMap<String, serde_json::Value>,
) -> Result<HashMap<String, String>, String> {
    let config_json = serde_json::to_string(config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;

    let mut env_vars = HashMap::new();
    env_vars.insert("CAMOU_CONFIG".to_string(), config_json);
    Ok(env_vars)
}

/// Convert a JSON string config to environment variables
pub fn json_config_to_env_vars(
    config_json: &str,
) -> Result<HashMap<String, String>, String> {
    // Validate the JSON is parseable
    let _: HashMap<String, serde_json::Value> =
        serde_json::from_str(config_json)
            .map_err(|e| format!("Failed to parse fingerprint config JSON: {e}"))?;

    let mut env_vars = HashMap::new();
    env_vars.insert("CAMOU_CONFIG".to_string(), config_json.to_string());
    Ok(env_vars)
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
        assert!(env_vars.contains_key("CAMOU_CONFIG"));
        assert_eq!(env_vars.len(), 1);

        let config_val = &env_vars["CAMOU_CONFIG"];
        assert!(config_val.contains("screen.width"));
        assert!(config_val.contains("1920"));
    }

    #[test]
    fn test_json_config_to_env_vars() {
        let json = r#"{"screen.width": 1920, "navigator.userAgent": "Test"}"#;
        let env_vars = json_config_to_env_vars(json).unwrap();
        assert_eq!(env_vars.len(), 1);
        assert!(env_vars.contains_key("CAMOU_CONFIG"));
        assert_eq!(env_vars["CAMOU_CONFIG"], json);
    }
}
