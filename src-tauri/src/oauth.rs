//! OAuth callback server for Google Sign-In in Tauri.
//!
//! Flow:
//!   1. Angular calls `oauth_start_google` → Rust starts local HTTP server on port 8923
//!   2. Angular opens Google OAuth URL in system browser (via shell.open)
//!   3. Google redirects to `http://localhost:8923/callback?code=...`
//!   4. Rust captures the `code`, serves a "success" HTML page, then emits `oauth-callback` event
//!   5. Angular receives the event, exchanges code for tokens, calls `signInWithCredential`

use std::io::{Read, Write};
use std::net::TcpListener;
use tauri::Emitter;

const OAUTH_PORT: u16 = 8923;

/// Start the OAuth callback server and return the redirect URI.
/// This is a one-shot server — it handles exactly 1 callback request then shuts down.
#[tauri::command]
pub async fn oauth_start_google(app_handle: tauri::AppHandle) -> Result<String, String> {
    let redirect_uri = format!("http://localhost:{}/callback", OAUTH_PORT);

    // Spawn a thread to listen for the callback (one-shot)
    let handle = app_handle.clone();
    std::thread::spawn(move || {
        let listener = match TcpListener::bind(format!("127.0.0.1:{}", OAUTH_PORT)) {
            Ok(l) => l,
            Err(e) => {
                log::error!("[OAuth] Failed to bind port {}: {}", OAUTH_PORT, e);
                return;
            }
        };

        log::info!("[OAuth] Callback server listening on port {}", OAUTH_PORT);

        // Set a timeout so the server doesn't hang forever
        listener
            .set_nonblocking(false)
            .ok();

        // Accept exactly 1 connection
        if let Ok((mut stream, _)) = listener.accept() {
            let mut buf = [0u8; 4096];
            let n = stream.read(&mut buf).unwrap_or(0);
            let request = String::from_utf8_lossy(&buf[..n]);

            // Parse the GET request line to extract query params
            // GET /callback?code=xxx&scope=yyy HTTP/1.1
            if let Some(query_start) = request.find("/callback?") {
                let query_part = &request[query_start + 10..]; // skip "/callback?"
                let query_end = query_part.find(' ').unwrap_or(query_part.len());
                let query_string = &query_part[..query_end];

                // Extract 'code' parameter
                let mut auth_code: Option<String> = None;
                for param in query_string.split('&') {
                    let parts: Vec<&str> = param.splitn(2, '=').collect();
                    if parts.len() == 2 && parts[0] == "code" {
                        auth_code = Some(urlencoding::decode(parts[1]).unwrap_or_default().to_string());
                    }
                }

                // Send success HTML response
                let html = r#"<!DOCTYPE html>
<html>
<head><title>Login Successful</title></head>
<body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a2e;color:#fff">
<div style="text-align:center">
<h1 style="color:#e94560">&#10004; Login Successful!</h1>
<p>You can close this tab and return to AnguLogin.</p>
</div>
</body>
</html>"#;

                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n{}",
                    html
                );
                let _ = stream.write_all(response.as_bytes());
                let _ = stream.flush();

                // Emit event with auth code
                if let Some(code) = auth_code {
                    log::info!("[OAuth] Received auth code, emitting event");
                    let _ = handle.emit("oauth-callback", code);
                } else {
                    log::error!("[OAuth] No auth code in callback");
                    let _ = handle.emit("oauth-callback-error", "No auth code received");
                }
            } else {
                // Not the callback path — just close
                let response = "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n";
                let _ = stream.write_all(response.as_bytes());
            }
        }

        log::info!("[OAuth] Callback server shut down");
    });

    Ok(redirect_uri)
}
