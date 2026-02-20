//! Chrome DevTools Protocol (CDP) WebSocket client.
//!
//! Manages persistent WebSocket connections to Chrome instances launched
//! with `--remote-debugging-port`. Each connection is keyed by a session ID
//! (typically the profile path) and stored in a global map.

use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};

type WsStream = WebSocketStream<MaybeTlsStream<TcpStream>>;

/// A single CDP session connected to one Chrome tab.
struct CdpSession {
    ws: WsStream,
    next_id: AtomicU64,
}

lazy_static::lazy_static! {
    /// Global map of session_id → CdpSession.
    static ref SESSIONS: Mutex<HashMap<String, CdpSession>> = Mutex::new(HashMap::new());
}

/// Connect to a Chrome CDP WebSocket endpoint.
/// Returns Ok(()) on success; the session is stored globally under `session_id`.
pub async fn connect(session_id: &str, ws_url: &str) -> Result<(), String> {
    let (ws, _resp) = connect_async(ws_url)
        .await
        .map_err(|e| format!("CDP WebSocket connect failed: {}", e))?;

    let session = CdpSession {
        ws,
        next_id: AtomicU64::new(1),
    };

    let mut sessions = SESSIONS.lock().await;
    sessions.insert(session_id.to_string(), session);
    log::info!("[CDP] Connected session '{}' → {}", session_id, ws_url);
    Ok(())
}

/// Send a CDP command and wait for the matching response.
/// Returns the JSON result object (or error).
pub async fn send_command(
    session_id: &str,
    method: &str,
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let mut sessions = SESSIONS.lock().await;
    let session = sessions
        .get_mut(session_id)
        .ok_or_else(|| format!("CDP session '{}' not found", session_id))?;

    let id = session.next_id.fetch_add(1, Ordering::SeqCst);

    let msg = serde_json::json!({
        "id": id,
        "method": method,
        "params": params,
    });

    session
        .ws
        .send(Message::Text(msg.to_string()))
        .await
        .map_err(|e| format!("CDP send error: {}", e))?;

    // Read messages until we get the response with our id.
    // CDP also sends events; we skip those.
    loop {
        let frame = session
            .ws
            .next()
            .await
            .ok_or("CDP connection closed unexpectedly")?
            .map_err(|e| format!("CDP read error: {}", e))?;

        if let Message::Text(text) = frame {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                // Match by id
                if json.get("id").and_then(|v| v.as_u64()) == Some(id) {
                    if let Some(error) = json.get("error") {
                        return Err(format!("CDP error: {}", error));
                    }
                    return Ok(json.get("result").cloned().unwrap_or(serde_json::json!({})));
                }
                // else: it's an event, skip
            }
        }
    }
}

/// Disconnect a CDP session.
pub async fn disconnect(session_id: &str) -> Result<(), String> {
    let mut sessions = SESSIONS.lock().await;
    if let Some(mut session) = sessions.remove(session_id) {
        let _ = session.ws.close(None).await;
        log::info!("[CDP] Disconnected session '{}'", session_id);
    }
    Ok(())
}

/// Check if a session exists.
pub async fn has_session(session_id: &str) -> bool {
    let sessions = SESSIONS.lock().await;
    sessions.contains_key(session_id)
}
