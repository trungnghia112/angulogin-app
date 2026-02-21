//! RPA API — REST API layer for automation execution.
//!
//! Provides endpoints to execute automation steps via the Local REST API,
//! without requiring the Angular frontend.
//!
//! Task lifecycle:
//!   1. POST /automation/execute — start task, returns taskId
//!   2. GET /automation/tasks — list all tasks
//!   3. GET /automation/task?task_id=X — get task detail + logs
//!   4. POST /automation/cancel — cancel running task

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::Mutex;

// ---------------------------------------------------------------------------
// Task state
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct AutoTask {
    pub task_id: String,
    pub profile_id: String,
    pub status: String, // "running" | "completed" | "failed" | "cancelled"
    pub current_step: usize,
    pub total_steps: usize,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub error: Option<String>,
    pub logs: Vec<AutoLog>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AutoLog {
    pub timestamp: String,
    pub step: usize,
    pub level: String, // "info" | "error" | "warn"
    pub message: String,
}

// ---------------------------------------------------------------------------
// Step definitions (API input)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct AutoStep {
    pub action: String, // "navigate" | "click" | "type" | "scroll" | "wait" | "evaluate"
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub selector: Option<String>,
    #[serde(rename = "fallbackSelectors", default)]
    pub fallback_selectors: Option<Vec<String>>,
    #[serde(default)]
    pub value: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "waitMs", default)]
    pub wait_ms: Option<u64>,
    #[serde(rename = "jsExpression", default)]
    pub js_expression: Option<String>,
    #[serde(default)]
    pub iterations: Option<u32>,
    #[serde(rename = "humanDelay", default)]
    pub human_delay: Option<[u64; 2]>,
    #[serde(rename = "waitForSelector", default)]
    pub wait_for_selector: Option<String>,
    #[serde(default)]
    pub timeout: Option<u64>,
}

// ---------------------------------------------------------------------------
// API request/response models
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct ExecuteRequest {
    pub profile_id: String,
    #[allow(dead_code)]
    pub browser: Option<String>,
    pub steps: Vec<AutoStep>,
    #[serde(default)]
    pub variables: HashMap<String, serde_json::Value>,
}

#[derive(Serialize)]
pub struct ExecuteResponseData {
    pub task_id: String,
    pub status: String,
    pub profile_id: String,
    pub total_steps: usize,
}

#[derive(Deserialize)]
pub struct TaskIdParam {
    pub task_id: Option<String>,
}

#[derive(Deserialize)]
pub struct TaskListParam {
    pub status: Option<String>,
}

#[derive(Deserialize)]
pub struct CancelRequest {
    pub task_id: String,
}

// ---------------------------------------------------------------------------
// Global task store
// ---------------------------------------------------------------------------

lazy_static::lazy_static! {
    pub static ref TASKS: Mutex<HashMap<String, AutoTask>> = Mutex::new(HashMap::new());
    static ref CANCELLED: Mutex<std::collections::HashSet<String>> = Mutex::new(std::collections::HashSet::new());
}

// ---------------------------------------------------------------------------
// Execution engine
// ---------------------------------------------------------------------------

/// Spawn a task that executes steps on a profile's browser via CDP.
/// Returns immediately with a task_id; execution runs in background.
pub fn spawn_task(
    profile_id: String,
    steps: Vec<AutoStep>,
    variables: HashMap<String, serde_json::Value>,
    debug_port: u16,
    ws_endpoint: String,
) -> String {
    let task_id = format!("task_{}", uuid::Uuid::new_v4().to_string().replace("-", "")[..12].to_string());
    let total_steps = steps.len();

    let task = AutoTask {
        task_id: task_id.clone(),
        profile_id: profile_id.clone(),
        status: "running".to_string(),
        current_step: 0,
        total_steps,
        started_at: chrono::Utc::now().to_rfc3339(),
        finished_at: None,
        error: None,
        logs: vec![AutoLog {
            timestamp: chrono::Utc::now().to_rfc3339(),
            step: 0,
            level: "info".to_string(),
            message: format!("Task started: {} steps on profile '{}'", total_steps, profile_id),
        }],
    };

    // Store task
    let tid = task_id.clone();
    tokio::spawn(async move {
        {
            let mut tasks = TASKS.lock().await;
            tasks.insert(tid.clone(), task);
        }
        run_task(tid, profile_id, steps, variables, debug_port, ws_endpoint).await;
    });

    task_id
}

async fn run_task(
    task_id: String,
    _profile_id: String,
    steps: Vec<AutoStep>,
    variables: HashMap<String, serde_json::Value>,
    debug_port: u16,
    ws_endpoint: String,
) {
    // Resolve page-level WebSocket URL if we only have the port
    let ws_url = if ws_endpoint.contains("/devtools/page/") {
        ws_endpoint.clone()
    } else {
        // Fetch page target from Chrome /json/list
        match resolve_ws_url(debug_port).await {
            Ok(url) => url,
            Err(e) => {
                update_task_error(&task_id, &format!("Failed to resolve CDP URL: {}", e)).await;
                return;
            }
        }
    };

    // Connect CDP
    let session_id = format!("api_{}", task_id);
    if let Err(e) = crate::cdp::connect(&session_id, &ws_url).await {
        update_task_error(&task_id, &format!("CDP connect failed: {}", e)).await;
        return;
    }

    add_log(&task_id, 0, "info", &format!("CDP connected: {}", ws_url)).await;

    // Inject anti-detection JS patches
    inject_anti_detection_js(&session_id).await;
    add_log(&task_id, 0, "info", "Anti-detection patches injected").await;

    // Execute steps
    for (i, step) in steps.iter().enumerate() {
        // Check cancellation
        {
            let cancelled = CANCELLED.lock().await;
            if cancelled.contains(&task_id) {
                update_task_status(&task_id, "cancelled", Some(i)).await;
                let _ = crate::cdp::disconnect(&session_id).await;
                return;
            }
        }

        // Update progress
        update_task_progress(&task_id, i + 1).await;

        let desc = step.description.as_deref().unwrap_or(&step.action);
        add_log(&task_id, i + 1, "info", &format!("Step {}: {}", i + 1, desc)).await;

        // Execute action
        let result = execute_step(&session_id, step, &variables).await;

        if let Err(e) = result {
            add_log(&task_id, i + 1, "error", &format!("Step {} failed: {}", i + 1, e)).await;
            update_task_error(&task_id, &format!("Step {} failed: {}", i + 1, e)).await;
            let _ = crate::cdp::disconnect(&session_id).await;
            return;
        }

        // Human delay between steps (gaussian distribution for realistic timing)
        if let Some([min, max]) = step.human_delay {
            let mean = (min + max) / 2;
            let stddev = (max - min) / 4; // ~95% of values within [min, max]
            let delay = gaussian_delay(mean, stddev.max(1));
            tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
        }
    }

    // Done
    update_task_status(&task_id, "completed", Some(steps.len())).await;
    add_log(&task_id, steps.len(), "info", "Task completed successfully").await;
    let _ = crate::cdp::disconnect(&session_id).await;
}

async fn execute_step(
    session_id: &str,
    step: &AutoStep,
    variables: &HashMap<String, serde_json::Value>,
) -> Result<(), String> {
    match step.action.as_str() {
        "navigate" => {
            let url = step.url.as_deref().unwrap_or("about:blank");
            let url = replace_variables(url, variables);
            let js = format!("window.location.href = '{}'", url.replace('\'', "\\'"));
            let params = serde_json::json!({
                "expression": js,
                "returnByValue": true,
            });
            crate::cdp::send_command(session_id, "Runtime.evaluate", params).await?;
            // Wait for page load
            tokio::time::sleep(std::time::Duration::from_millis(2000)).await;

            // waitForSelector: poll DOM until selector appears
            if let Some(ref wfs) = step.wait_for_selector {
                let wfs = replace_variables(wfs, variables);
                let timeout = step.timeout.unwrap_or(15000);
                let deadline = std::time::Instant::now() + std::time::Duration::from_millis(timeout);
                let selectors: Vec<&str> = wfs.split(',').map(|s| s.trim()).collect();
                let js_check = selectors.iter()
                    .map(|s| format!("document.querySelector('{}')", s.replace('\'', "\\'")))
                    .collect::<Vec<_>>()
                    .join(" || ");
                let poll_js = format!("!!({js_check})");
                loop {
                    let params = serde_json::json!({
                        "expression": &poll_js,
                        "returnByValue": true,
                    });
                    if let Ok(resp) = crate::cdp::send_command(session_id, "Runtime.evaluate", params).await {
                        if resp.get("result").and_then(|r| r.get("value")).and_then(|v| v.as_bool()) == Some(true) {
                            break;
                        }
                    }
                    if std::time::Instant::now() > deadline {
                        log::warn!("[RPA] waitForSelector timed out: {}", wfs);
                        break;
                    }
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                }
            }
            Ok(())
        }
        "click" => {
            if let Some(ref expr) = step.js_expression {
                let expr = replace_variables(expr, variables);
                let params = serde_json::json!({
                    "expression": expr,
                    "returnByValue": true,
                    "awaitPromise": true,
                });
                crate::cdp::send_command(session_id, "Runtime.evaluate", params).await?;
            } else {
                let sel = resolve_selector(session_id, step, variables).await;
                if let Some(ref sel) = sel {
                    // Human-like click via CDP Input events
                    if let Some((x, y)) = get_element_center(session_id, sel).await {
                        human_click_at(session_id, x, y).await?;
                    } else {
                        // Fallback to JS click if coordinates unavailable
                        let js = format!("document.querySelector('{}')?.click()", sel);
                        let params = serde_json::json!({
                            "expression": js,
                            "returnByValue": true,
                        });
                        crate::cdp::send_command(session_id, "Runtime.evaluate", params).await?;
                    }
                }
            }
            Ok(())
        }
        "type" => {
            let value = step.value.as_deref().unwrap_or("");
            let value = replace_variables(value, variables);
            let sel = resolve_selector(session_id, step, variables).await;
            if let Some(sel) = sel {
                // Click to focus the input field (human-like)
                if let Some((x, y)) = get_element_center(session_id, &sel).await {
                    human_click_at(session_id, x, y).await?;
                    tokio::time::sleep(std::time::Duration::from_millis(gaussian_delay(200, 80))).await;
                } else {
                    // Fallback: JS focus
                    let focus_js = format!("document.querySelector('{}')?.focus()", sel.replace('\'', "\\'"));
                    let params = serde_json::json!({
                        "expression": focus_js,
                        "returnByValue": true,
                    });
                    crate::cdp::send_command(session_id, "Runtime.evaluate", params).await?;
                }

                // Clear existing value
                let clear_js = format!(
                    "(() => {{ const el = document.querySelector('{}'); if (el) {{ el.value = ''; el.dispatchEvent(new Event('input', {{ bubbles: true }})); }} }})()",
                    sel.replace('\'', "\\'")
                );
                let params = serde_json::json!({
                    "expression": clear_js,
                    "returnByValue": true,
                });
                crate::cdp::send_command(session_id, "Runtime.evaluate", params).await?;

                // Type character by character (human-like)
                human_type(session_id, &value).await?;

                // Press Enter to submit
                tokio::time::sleep(std::time::Duration::from_millis(gaussian_delay(300, 100))).await;
                dispatch_key_press(session_id, "Enter", "Enter", 13).await?;
            }
            Ok(())
        }
        "scroll" => {
            if let Some(ref expr) = step.js_expression {
                // Custom scroll via jsExpression (e.g. scroll to reviews section)
                let expr = replace_variables(expr, variables);
                let params = serde_json::json!({
                    "expression": expr,
                    "returnByValue": true,
                });
                crate::cdp::send_command(session_id, "Runtime.evaluate", params).await?;
            } else {
                // Human-like scroll: randomized distance, speed, occasional scroll-up
                let iterations = step.iterations.unwrap_or(3);
                for i in 0..iterations {
                    // 15% chance to scroll up slightly before scrolling down (natural behavior)
                    if i > 0 && rand::random::<f64>() < 0.15 {
                        let up_amount = 50.0 + rand::random::<f64>() * 150.0;
                        let js = format!("window.scrollBy({{ top: -{}, behavior: 'smooth' }})", up_amount as i64);
                        let params = serde_json::json!({
                            "expression": js,
                            "returnByValue": true,
                        });
                        crate::cdp::send_command(session_id, "Runtime.evaluate", params).await?;
                        tokio::time::sleep(std::time::Duration::from_millis(gaussian_delay(400, 150))).await;
                    }
                    // Random scroll amount: 50-110% of viewport height
                    let factor = 0.5 + rand::random::<f64>() * 0.6;
                    let js = format!("window.scrollBy({{ top: Math.round(window.innerHeight * {}), behavior: 'smooth' }})", factor);
                    let params = serde_json::json!({
                        "expression": js,
                        "returnByValue": true,
                    });
                    crate::cdp::send_command(session_id, "Runtime.evaluate", params).await?;
                    // Gaussian delay between scrolls: mean=1200ms, stddev=400ms
                    tokio::time::sleep(std::time::Duration::from_millis(gaussian_delay(1200, 400))).await;
                }
            }
            Ok(())
        }
        "wait" => {
            let ms = step.wait_ms.unwrap_or(3000);
            tokio::time::sleep(std::time::Duration::from_millis(ms)).await;
            Ok(())
        }
        "evaluate" => {
            if let Some(ref expr) = step.js_expression {
                let expr = replace_variables(expr, variables);
                let params = serde_json::json!({
                    "expression": expr,
                    "returnByValue": true,
                    "awaitPromise": true,
                });
                crate::cdp::send_command(session_id, "Runtime.evaluate", params).await?;
            }
            Ok(())
        }
        _ => Ok(()), // Unknown action — skip
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Try primary selector, then fallbacks. Returns the first selector that finds an element.
async fn resolve_selector(
    session_id: &str,
    step: &AutoStep,
    variables: &HashMap<String, serde_json::Value>,
) -> Option<String> {
    // Try primary selector first
    if let Some(ref sel) = step.selector {
        let sel = replace_variables(sel, variables);
        if check_selector_exists(session_id, &sel).await {
            return Some(sel);
        }
    }
    // Try fallback selectors
    if let Some(ref fallbacks) = step.fallback_selectors {
        for fb in fallbacks {
            let fb = replace_variables(fb, variables);
            if check_selector_exists(session_id, &fb).await {
                log::info!("[RPA] Primary selector not found, using fallback: {}", fb);
                return Some(fb);
            }
        }
    }
    // Return primary selector even if not found (let the action handle it)
    step.selector.as_ref().map(|s| replace_variables(s, variables))
}

/// Check if a CSS selector matches any element in the page
async fn check_selector_exists(session_id: &str, selector: &str) -> bool {
    let js = format!("!!document.querySelector('{}')", selector.replace('\'', "\\'"));
    let params = serde_json::json!({
        "expression": js,
        "returnByValue": true,
    });
    match crate::cdp::send_command(session_id, "Runtime.evaluate", params).await {
        Ok(resp) => resp.get("result")
            .and_then(|r| r.get("value"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        Err(_) => false,
    }
}

fn replace_variables(text: &str, variables: &HashMap<String, serde_json::Value>) -> String {
    let mut result = text.to_string();
    for (key, value) in variables {
        let placeholder = format!("{{{{{}}}}}", key);
        let replacement = match value {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            _ => value.to_string(),
        };
        result = result.replace(&placeholder, &replacement);
    }
    result
}

// ---------------------------------------------------------------------------
// Anti-Bot: Human-like behavior helpers
// ---------------------------------------------------------------------------

/// Gaussian random delay (ms) using Box-Muller transform.
/// Returns a value clamped between min_ms and max_ms.
fn gaussian_delay(mean_ms: u64, stddev_ms: u64) -> u64 {
    let u1: f64 = rand::random::<f64>().max(1e-10);
    let u2: f64 = rand::random::<f64>();
    let z = (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos();
    let value = mean_ms as f64 + z * stddev_ms as f64;
    value.round().max(20.0) as u64
}

/// Human-like typing via CDP Input.dispatchKeyEvent (char by char).
/// Includes random delay per keystroke and occasional typo simulation.
async fn human_type(session_id: &str, text: &str) -> Result<(), String> {
    for ch in text.chars() {
        // 5% chance of typo: type wrong char then backspace
        if rand::random::<f64>() < 0.05 && ch.is_alphabetic() {
            let wrong = if ch.is_uppercase() {
                ((rand::random::<u8>() % 26) + b'A') as char
            } else {
                ((rand::random::<u8>() % 26) + b'a') as char
            };
            dispatch_key_char(session_id, wrong).await?;
            tokio::time::sleep(std::time::Duration::from_millis(gaussian_delay(80, 30))).await;
            dispatch_key_press(session_id, "Backspace", "Backspace", 8).await?;
            tokio::time::sleep(std::time::Duration::from_millis(gaussian_delay(60, 20))).await;
        }

        dispatch_key_char(session_id, ch).await?;
        // Random delay between keystrokes: mean=90ms, stddev=35ms
        tokio::time::sleep(std::time::Duration::from_millis(gaussian_delay(90, 35))).await;
    }
    Ok(())
}

/// Dispatch a single character keystroke via CDP Input.dispatchKeyEvent
async fn dispatch_key_char(session_id: &str, ch: char) -> Result<(), String> {
    let text = ch.to_string();
    // keyDown
    let params = serde_json::json!({
        "type": "keyDown",
        "text": &text,
        "unmodifiedText": &text,
        "key": &text,
    });
    crate::cdp::send_command(session_id, "Input.dispatchKeyEvent", params).await?;
    // char
    let params = serde_json::json!({
        "type": "char",
        "text": &text,
        "unmodifiedText": &text,
        "key": &text,
    });
    crate::cdp::send_command(session_id, "Input.dispatchKeyEvent", params).await?;
    // keyUp
    let params = serde_json::json!({
        "type": "keyUp",
        "text": &text,
        "unmodifiedText": &text,
        "key": &text,
    });
    crate::cdp::send_command(session_id, "Input.dispatchKeyEvent", params).await?;
    Ok(())
}

/// Dispatch a special key press (Enter, Backspace, Tab, etc.)
async fn dispatch_key_press(session_id: &str, key: &str, code: &str, key_code: u32) -> Result<(), String> {
    let params = serde_json::json!({
        "type": "rawKeyDown",
        "key": key,
        "code": code,
        "windowsVirtualKeyCode": key_code,
        "nativeVirtualKeyCode": key_code,
    });
    crate::cdp::send_command(session_id, "Input.dispatchKeyEvent", params).await?;
    let params = serde_json::json!({
        "type": "keyUp",
        "key": key,
        "code": code,
        "windowsVirtualKeyCode": key_code,
        "nativeVirtualKeyCode": key_code,
    });
    crate::cdp::send_command(session_id, "Input.dispatchKeyEvent", params).await?;
    Ok(())
}

/// Get element center coordinates from a CSS selector.
/// Returns (x, y) or None if element not found.
async fn get_element_center(session_id: &str, selector: &str) -> Option<(f64, f64)> {
    let js = format!(
        r#"(() => {{ const el = document.querySelector('{}'); if (!el) return null; const r = el.getBoundingClientRect(); return {{ x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, h: r.height }}; }})()"#,
        selector.replace('\'', "\\'")
    );
    let params = serde_json::json!({
        "expression": js,
        "returnByValue": true,
    });
    let resp = crate::cdp::send_command(session_id, "Runtime.evaluate", params).await.ok()?;
    let value = resp.get("result")?.get("value")?;
    let x = value.get("x")?.as_f64()?;
    let y = value.get("y")?.as_f64()?;
    let w = value.get("w")?.as_f64().unwrap_or(10.0);
    let h = value.get("h")?.as_f64().unwrap_or(10.0);
    // Add random offset within element bounds (±30% of dimensions)
    let offset_x = (rand::random::<f64>() - 0.5) * w * 0.3;
    let offset_y = (rand::random::<f64>() - 0.5) * h * 0.3;
    Some((x + offset_x, y + offset_y))
}

/// Human-like click at coordinates via CDP Input.dispatchMouseEvent.
/// Simulates: mouseMoved → mousePressed → (delay) → mouseReleased
async fn human_click_at(session_id: &str, x: f64, y: f64) -> Result<(), String> {
    // Mouse move to target (with small intermediate moves)
    mouse_jitter(session_id, x, y).await;

    // Move to target
    let params = serde_json::json!({
        "type": "mouseMoved",
        "x": x as i64,
        "y": y as i64,
    });
    crate::cdp::send_command(session_id, "Input.dispatchMouseEvent", params).await?;
    tokio::time::sleep(std::time::Duration::from_millis(gaussian_delay(60, 20))).await;

    // Press
    let params = serde_json::json!({
        "type": "mousePressed",
        "x": x as i64,
        "y": y as i64,
        "button": "left",
        "clickCount": 1,
    });
    crate::cdp::send_command(session_id, "Input.dispatchMouseEvent", params).await?;
    // Human press-release delay: 50-120ms
    tokio::time::sleep(std::time::Duration::from_millis(gaussian_delay(70, 25))).await;

    // Release
    let params = serde_json::json!({
        "type": "mouseReleased",
        "x": x as i64,
        "y": y as i64,
        "button": "left",
        "clickCount": 1,
    });
    crate::cdp::send_command(session_id, "Input.dispatchMouseEvent", params).await?;
    Ok(())
}

/// Inject 1-3 small random mouse movements near target area (simulates natural jitter).
async fn mouse_jitter(session_id: &str, target_x: f64, target_y: f64) {
    let moves = 1 + (rand::random::<u8>() % 3) as usize;
    for i in 0..moves {
        // Interpolate from random offset toward target
        let progress = (i + 1) as f64 / (moves + 1) as f64;
        let jx = target_x + (rand::random::<f64>() - 0.5) * 80.0 * (1.0 - progress);
        let jy = target_y + (rand::random::<f64>() - 0.5) * 80.0 * (1.0 - progress);
        let params = serde_json::json!({
            "type": "mouseMoved",
            "x": jx.max(0.0) as i64,
            "y": jy.max(0.0) as i64,
        });
        let _ = crate::cdp::send_command(session_id, "Input.dispatchMouseEvent", params).await;
        tokio::time::sleep(std::time::Duration::from_millis(gaussian_delay(30, 15))).await;
    }
}

/// Inject anti-detection JS at the start of each task.
/// Patches detectable CDP/automation artifacts.
async fn inject_anti_detection_js(session_id: &str) {
    let js = r#"
    (() => {
        // 1. Force document.hasFocus() to always return true
        if (document.hasFocus.toString().includes('native code')) {
            Object.defineProperty(Document.prototype, 'hasFocus', {
                value: () => true,
                configurable: false,
                writable: false
            });
        }

        // 2. Mask CDP detection via Error.stack
        const origError = Error;
        window.Error = class extends origError {
            constructor(...args) {
                super(...args);
                if (this.stack) {
                    this.stack = this.stack
                        .split('\n')
                        .filter(l => !l.includes('__puppeteer') && !l.includes('__cdp'))
                        .join('\n');
                }
            }
        };
        window.Error.prototype = origError.prototype;

        // 3. Fuzz Performance.now() precision (prevents timing fingerprinting)
        const origNow = Performance.prototype.now;
        Performance.prototype.now = function() {
            return origNow.call(this) + (Math.random() * 0.1);
        };

        // 4. Prevent detection via window.chrome.runtime
        if (!window.chrome) window.chrome = {};
        if (!window.chrome.runtime) window.chrome.runtime = {};

        // 5. Override Notification.permission to look normal
        try {
            Object.defineProperty(Notification, 'permission', {
                get: () => 'default',
                configurable: true
            });
        } catch(e) {}
    })();
    "#;
    let params = serde_json::json!({
        "expression": js,
        "returnByValue": true,
    });
    let _ = crate::cdp::send_command(session_id, "Runtime.evaluate", params).await;
}

async fn resolve_ws_url(port: u16) -> Result<String, String> {
    let url = format!("http://127.0.0.1:{}/json/list", port);

    // Retry up to 15 times (1s apart) — browser may need time to bind the port
    let mut last_err = String::new();
    for attempt in 0..15 {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
        }
        match reqwest::get(&url).await {
            Ok(resp) => {
                let json: Vec<serde_json::Value> = resp.json().await
                    .map_err(|e| format!("Invalid CDP response: {}", e))?;

                // Prefer navigable page targets (non-chrome://, non-extension)
                // Fallback to chrome://newtab if no navigable page exists
                let page_target = json.iter()
                    .filter(|entry| {
                        let t = entry.get("type").and_then(|t| t.as_str()).unwrap_or("");
                        t == "page" && entry.get("webSocketDebuggerUrl").is_some()
                    })
                    .find(|entry| {
                        let url = entry.get("url").and_then(|u| u.as_str()).unwrap_or("");
                        !url.starts_with("chrome://")
                            && !url.starts_with("chrome-extension://")
                            && !url.starts_with("chrome-untrusted://")
                    })
                    .or_else(|| {
                        // Fallback: chrome://newtab (supports Runtime.evaluate)
                        json.iter().find(|e| {
                            e.get("type").and_then(|t| t.as_str()) == Some("page")
                                && e.get("webSocketDebuggerUrl").is_some()
                                && e.get("url").and_then(|u| u.as_str())
                                    .unwrap_or("").contains("newtab")
                        })
                    });

                if let Some(page) = page_target {
                    let ws = page.get("webSocketDebuggerUrl")
                        .and_then(|v| v.as_str())
                        .unwrap();
                    log::info!("[RPA-API] Resolved page target: {} → {}",
                        page.get("url").and_then(|u| u.as_str()).unwrap_or("?"), ws);
                    return Ok(ws.to_string());
                }

                last_err = format!("No usable page target in {} entries", json.len());
                log::info!("[RPA-API] No usable page target yet on port {} (attempt {}, {} entries)", port, attempt + 1, json.len());
            }
            Err(e) => {
                last_err = format!("Attempt {}: {}", attempt + 1, e);
                log::info!("[RPA-API] Waiting for CDP on port {} (attempt {})", port, attempt + 1);
            }
        }
    }
    Err(format!("Cannot reach CDP on port {} after 15 attempts: {}", port, last_err))
}

async fn update_task_error(task_id: &str, error: &str) {
    let mut tasks = TASKS.lock().await;
    if let Some(task) = tasks.get_mut(task_id) {
        task.status = "failed".to_string();
        task.error = Some(error.to_string());
        task.finished_at = Some(chrono::Utc::now().to_rfc3339());
    }
}

async fn update_task_status(task_id: &str, status: &str, step: Option<usize>) {
    let mut tasks = TASKS.lock().await;
    if let Some(task) = tasks.get_mut(task_id) {
        task.status = status.to_string();
        if let Some(s) = step {
            task.current_step = s;
        }
        task.finished_at = Some(chrono::Utc::now().to_rfc3339());
    }
}

async fn update_task_progress(task_id: &str, step: usize) {
    let mut tasks = TASKS.lock().await;
    if let Some(task) = tasks.get_mut(task_id) {
        task.current_step = step;
    }
}

async fn add_log(task_id: &str, step: usize, level: &str, message: &str) {
    let mut tasks = TASKS.lock().await;
    if let Some(task) = tasks.get_mut(task_id) {
        task.logs.push(AutoLog {
            timestamp: chrono::Utc::now().to_rfc3339(),
            step,
            level: level.to_string(),
            message: message.to_string(),
        });
    }
}

/// Mark a task for cancellation.
pub async fn cancel_task(task_id: &str) -> Result<(), String> {
    let tasks = TASKS.lock().await;
    if !tasks.contains_key(task_id) {
        return Err(format!("Task '{}' not found", task_id));
    }
    let task = tasks.get(task_id).unwrap();
    if task.status != "running" {
        return Err(format!("Task '{}' is not running (status: {})", task_id, task.status));
    }
    drop(tasks);

    let mut cancelled = CANCELLED.lock().await;
    cancelled.insert(task_id.to_string());
    Ok(())
}
