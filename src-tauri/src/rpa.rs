//! RPA (Robotic Process Automation) Tauri commands.
//!
//! Provides the bridge between the Angular frontend and the CDP engine.
//! The flow is:
//!   1. `rpa_launch` — launch Chrome with CDP enabled, return WebSocket URL
//!   2. `rpa_connect` — establish CDP WebSocket session
//!   3. `rpa_execute` / `rpa_evaluate_js` — send commands
//!   4. `rpa_disconnect` — close session

use std::process::Command;

/// Launch a Chrome profile with `--remote-debugging-port=0` for CDP access.
/// Reads the actual assigned port from `DevToolsActivePort` file.
/// Returns `{ "cdpPort": u16, "wsUrl": "ws://..." }`.
#[tauri::command]
pub async fn rpa_launch(
    profile_path: String,
    browser: String,
    url: Option<String>,
) -> Result<serde_json::Value, String> {
    // Resolve browser binary
    let browser_binary = match browser.as_str() {
        "chrome" => "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "brave" => "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        "edge" => "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        _ => return Err(format!("Unsupported browser for RPA: {}", browser)),
    };

    if !std::path::Path::new(browser_binary).exists() {
        return Err(format!("{} not found at {}", browser, browser_binary));
    }

    let user_data_arg = format!("--user-data-dir={}", profile_path);

    let mut args = vec![
        user_data_arg,
        "--remote-debugging-port=0".to_string(),
        "--no-first-run".to_string(),
        "--disable-background-networking".to_string(),
    ];

    if let Some(u) = url {
        args.push(u);
    }

    // Launch Chrome
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    // CRITICAL: Delete stale DevToolsActivePort before launch (it may exist from previous sessions)
    let port_file = format!("{}/DevToolsActivePort", profile_path);
    let _ = std::fs::remove_file(&port_file);

    Command::new(browser_binary)
        .args(&arg_refs)
        .spawn()
        .map_err(|e| format!("Failed to launch browser: {}", e))?;

    // Wait for DevToolsActivePort file (Chrome writes it after startup)
    let port_path = std::path::Path::new(&port_file);

    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_secs(15);

    loop {
        if start.elapsed() > timeout {
            return Err("Timeout waiting for Chrome CDP port (15s)".to_string());
        }

        if port_path.exists() {
            if let Ok(content) = std::fs::read_to_string(port_path) {
                let lines: Vec<&str> = content.trim().lines().collect();
                if let Some(port_str) = lines.first() {
                    if let Ok(port) = port_str.trim().parse::<u16>() {
                        // Fetch the WebSocket debugger URL from /json/version
                        let version_url = format!("http://127.0.0.1:{}/json/version", port);
                        
                        // Give Chrome a moment to fully initialize the debugger
                        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

                        let client = reqwest::Client::new();
                        let resp = client
                            .get(&version_url)
                            .timeout(std::time::Duration::from_secs(5))
                            .send()
                            .await
                            .map_err(|e| format!("Failed to query CDP version: {}", e))?;

                        let version_info: serde_json::Value = resp
                            .json()
                            .await
                            .map_err(|e| format!("Failed to parse CDP version: {}", e))?;

                        let ws_url = version_info
                            .get("webSocketDebuggerUrl")
                            .and_then(|v| v.as_str())
                            .ok_or("webSocketDebuggerUrl not found")?
                            .to_string();

                        log::info!(
                            "[RPA] Chrome launched with CDP on port {} — {}",
                            port,
                            ws_url
                        );

                        return Ok(serde_json::json!({
                            "cdpPort": port,
                            "wsUrl": ws_url,
                            "sessionId": profile_path,
                        }));
                    }
                }
            }
        }

        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }
}

/// Establish a CDP WebSocket connection to an already-running Chrome instance.
#[tauri::command]
pub async fn rpa_connect(session_id: String, ws_url: String) -> Result<(), String> {
    crate::cdp::connect(&session_id, &ws_url).await
}

/// Send a raw CDP command. Returns the result JSON.
#[tauri::command]
pub async fn rpa_execute(
    session_id: String,
    method: String,
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    crate::cdp::send_command(&session_id, &method, params).await
}

/// Convenience: evaluate JavaScript in the page context.
/// Returns the evaluated result value.
#[tauri::command]
pub async fn rpa_evaluate_js(
    session_id: String,
    expression: String,
) -> Result<serde_json::Value, String> {
    let params = serde_json::json!({
        "expression": expression,
        "returnByValue": true,
        "awaitPromise": true,
    });
    let result = crate::cdp::send_command(&session_id, "Runtime.evaluate", params).await?;

    // Check for JS exceptions
    if let Some(exception) = result.get("exceptionDetails") {
        return Err(format!("JS exception: {}", exception));
    }

    Ok(result
        .get("result")
        .cloned()
        .unwrap_or(serde_json::json!(null)))
}

/// Disconnect a CDP session.
#[tauri::command]
pub async fn rpa_disconnect(session_id: String) -> Result<(), String> {
    crate::cdp::disconnect(&session_id).await
}
