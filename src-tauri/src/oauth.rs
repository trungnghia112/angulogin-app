//! OAuth callback server for Google Sign-In in Tauri.
//!
//! Flow:
//!   1. Angular calls `oauth_start_google` → Rust starts local HTTP server on port 8923
//!   2. Angular opens Google OAuth URL in system browser (via shell.open)
//!   3. Google redirects to `http://localhost:8923/callback#access_token=...`
//!   4. Rust serves a small HTML page that extracts the hash fragment via JavaScript
//!      and sends it back to Rust via a second request to `/token?access_token=...`
//!   5. Rust emits `oauth-callback` event with the access token
//!   6. Angular receives the event and calls `signInWithCredential`

use std::io::{Read, Write};
use std::net::TcpListener;
use tauri::Emitter;

const OAUTH_PORT: u16 = 8923;

/// Start the OAuth callback server and return the redirect URI.
/// This is a one-shot server — it handles the callback flow then shuts down.
#[tauri::command]
pub async fn oauth_start_google(app_handle: tauri::AppHandle) -> Result<String, String> {
    let redirect_uri = format!("http://localhost:{}/callback", OAUTH_PORT);

    let handle = app_handle.clone();
    std::thread::spawn(move || {
        let listener = match TcpListener::bind(format!("127.0.0.1:{}", OAUTH_PORT)) {
            Ok(l) => l,
            Err(e) => {
                log::error!("[OAuth] Failed to bind port {}: {}", OAUTH_PORT, e);
                let _ = handle.emit("oauth-callback-error", format!("Port {} in use", OAUTH_PORT));
                return;
            }
        };

        log::info!("[OAuth] Callback server listening on port {}", OAUTH_PORT);

        // We need to handle 2 requests:
        // 1. GET /callback#... → serve HTML that extracts hash fragment
        // 2. GET /token?access_token=... → capture the token and emit event

        for _ in 0..2 {
            if let Ok((mut stream, _)) = listener.accept() {
                let mut buf = [0u8; 8192];
                let n = stream.read(&mut buf).unwrap_or(0);
                let request = String::from_utf8_lossy(&buf[..n]).to_string();

                if request.contains("GET /token?") || request.contains("GET /token%3F") {
                    // Second request: extract access_token from query
                    handle_token_request(&request, &mut stream, &handle);
                    break; // Done — we have the token
                } else if request.contains("GET /callback") {
                    // First request: serve HTML that extracts hash fragment
                    serve_callback_html(&mut stream);
                    // Continue loop to wait for /token request
                } else {
                    let response = "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n";
                    let _ = stream.write_all(response.as_bytes());
                }
            }
        }

        log::info!("[OAuth] Callback server shut down");
    });

    Ok(redirect_uri)
}

/// Serve HTML page that extracts the access_token from the URL hash fragment
/// and sends it back to the server via a fetch request.
fn serve_callback_html(stream: &mut std::net::TcpStream) {
    let html = format!(r#"<!DOCTYPE html>
<html>
<head><title>Signing in...</title></head>
<body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a2e;color:#fff">
<div id="msg" style="text-align:center">
<div style="font-size:48px;margin-bottom:20px">&#9203;</div>
<h2>Signing in to AnguLogin...</h2>
<p style="color:#888">Please wait...</p>
</div>
<script>
(function() {{
    // Google implicit flow puts tokens in the hash fragment
    var hash = window.location.hash.substring(1);
    var params = new URLSearchParams(hash);
    var token = params.get('access_token');
    if (token) {{
        // Send token back to local server
        fetch('http://localhost:{}/token?access_token=' + encodeURIComponent(token))
            .then(function() {{
                document.getElementById('msg').innerHTML =
                    '<div style="font-size:48px;margin-bottom:20px;color:#10b981">&#10004;</div>' +
                    '<h2 style="color:#10b981">Login Successful!</h2>' +
                    '<p style="color:#888">You can close this tab and return to AnguLogin.</p>';
            }})
            .catch(function() {{
                document.getElementById('msg').innerHTML =
                    '<div style="font-size:48px;margin-bottom:20px;color:#e94560">&#10060;</div>' +
                    '<h2 style="color:#e94560">Login Failed</h2>' +
                    '<p style="color:#888">Please try again in the app.</p>';
            }});
    }} else {{
        document.getElementById('msg').innerHTML =
            '<div style="font-size:48px;margin-bottom:20px;color:#e94560">&#10060;</div>' +
            '<h2 style="color:#e94560">No token received</h2>' +
            '<p style="color:#888">Please try again in the app.</p>';
    }}
}})();
</script>
</body>
</html>"#, OAUTH_PORT);

    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
        html
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

/// Handle the /token?access_token=... request — extract token and emit event.
fn handle_token_request(
    request: &str,
    stream: &mut std::net::TcpStream,
    handle: &tauri::AppHandle,
) {
    let mut access_token: Option<String> = None;

    // Parse query string from GET /token?access_token=xxx HTTP/1.1
    if let Some(query_start) = request.find("/token?") {
        let query_part = &request[query_start + 7..];
        let query_end = query_part.find(' ').unwrap_or(query_part.len());
        let query_string = &query_part[..query_end];

        for param in query_string.split('&') {
            let parts: Vec<&str> = param.splitn(2, '=').collect();
            if parts.len() == 2 && parts[0] == "access_token" {
                access_token =
                    Some(urlencoding::decode(parts[1]).unwrap_or_default().to_string());
            }
        }
    }

    // Send CORS-friendly response
    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\nOK";
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();

    if let Some(token) = access_token {
        log::info!("[OAuth] Received access token, emitting event");
        let _ = handle.emit("oauth-callback", token);
    } else {
        log::error!("[OAuth] No access_token in /token request");
        let _ = handle.emit("oauth-callback-error", "No access token received");
    }
}
