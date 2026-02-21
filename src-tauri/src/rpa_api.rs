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
}

// ---------------------------------------------------------------------------
// API request/response models
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct ExecuteRequest {
    pub profile_id: String,
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
    profile_id: String,
    steps: Vec<AutoStep>,
    variables: HashMap<String, serde_json::Value>,
    debug_port: u16,
    ws_endpoint: String,
) {
    // Resolve real WebSocket URL if we only have the port
    let ws_url = if ws_endpoint.contains("/devtools/") {
        ws_endpoint.clone()
    } else {
        // Fetch from Chrome /json/version
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

        // Human delay between steps
        if let Some([min, max]) = step.human_delay {
            let delay = min + (rand::random::<u64>() % (max - min + 1));
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
            // Use Runtime.evaluate for navigation (works on both browser and page targets)
            let js = format!("window.location.href = '{}'", url.replace('\'', "\\'"));
            let params = serde_json::json!({
                "expression": js,
                "returnByValue": true,
            });
            crate::cdp::send_command(session_id, "Runtime.evaluate", params).await?;
            // Wait for load
            tokio::time::sleep(std::time::Duration::from_millis(2000)).await;
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
            } else if let Some(ref sel) = step.selector {
                let sel = replace_variables(sel, variables);
                let js = format!("document.querySelector('{}')?.click()", sel);
                let params = serde_json::json!({
                    "expression": js,
                    "returnByValue": true,
                });
                crate::cdp::send_command(session_id, "Runtime.evaluate", params).await?;
            }
            Ok(())
        }
        "type" => {
            let value = step.value.as_deref().unwrap_or("");
            let value = replace_variables(value, variables);
            if let Some(ref sel) = step.selector {
                let sel = replace_variables(sel, variables);
                // Focus + set value + fire input event
                let js = format!(
                    r#"(() => {{ const el = document.querySelector('{}'); if (el) {{ el.focus(); el.value = '{}'; el.dispatchEvent(new Event('input', {{ bubbles: true }})); return 'typed'; }} return 'not found'; }})()"#,
                    sel.replace('\'', "\\'"),
                    value.replace('\'', "\\'"),
                );
                let params = serde_json::json!({
                    "expression": js,
                    "returnByValue": true,
                });
                crate::cdp::send_command(session_id, "Runtime.evaluate", params).await?;
            }
            Ok(())
        }
        "scroll" => {
            let iterations = step.iterations.unwrap_or(3);
            for _ in 0..iterations {
                let js = "window.scrollBy(0, window.innerHeight * 0.8)";
                let params = serde_json::json!({
                    "expression": js,
                    "returnByValue": true,
                });
                crate::cdp::send_command(session_id, "Runtime.evaluate", params).await?;
                tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
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

async fn resolve_ws_url(port: u16) -> Result<String, String> {
    let url = format!("http://127.0.0.1:{}/json/list", port);

    // Retry up to 10 times (1s apart) — browser may need time to bind the port
    let mut last_err = String::new();
    for attempt in 0..10 {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
        }
        match reqwest::get(&url).await {
            Ok(resp) => {
                let json: Vec<serde_json::Value> = resp.json().await
                    .map_err(|e| format!("Invalid CDP response: {}", e))?;
                // Find first "page" type target
                let page = json.iter()
                    .find(|entry| entry.get("type").and_then(|t| t.as_str()) == Some("page"));
                if let Some(page) = page {
                    return page.get("webSocketDebuggerUrl")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .ok_or_else(|| "webSocketDebuggerUrl not found in page target".to_string());
                }
                last_err = format!("No page target found in {} entries", json.len());
                log::info!("[RPA-API] No page target yet on port {} (attempt {})", port, attempt + 1);
            }
            Err(e) => {
                last_err = format!("Attempt {}: {}", attempt + 1, e);
                log::info!("[RPA-API] Waiting for CDP on port {} (attempt {})", port, attempt + 1);
            }
        }
    }
    Err(format!("Cannot reach CDP on port {} after 10 attempts: {}", port, last_err))
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
