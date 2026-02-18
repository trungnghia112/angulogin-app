use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

// ---------------------------------------------------------------------------
// Traffic Stats: per-profile byte counters
// ---------------------------------------------------------------------------

pub struct TrafficStats {
    pub bytes_sent: AtomicU64,
    pub bytes_received: AtomicU64,
}

impl TrafficStats {
    fn new() -> Self {
        Self {
            bytes_sent: AtomicU64::new(0),
            bytes_received: AtomicU64::new(0),
        }
    }
}

fn traffic_stats() -> &'static Mutex<HashMap<String, Arc<TrafficStats>>> {
    static INSTANCE: OnceLock<Mutex<HashMap<String, Arc<TrafficStats>>>> = OnceLock::new();
    INSTANCE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn get_or_create_stats(profile_id: &str) -> Arc<TrafficStats> {
    let mut map = traffic_stats().lock().unwrap();
    map.entry(profile_id.to_string())
        .or_insert_with(|| Arc::new(TrafficStats::new()))
        .clone()
}

/// Get traffic stats for a profile (bytes_sent, bytes_received).
pub fn get_profile_traffic(profile_id: &str) -> (u64, u64) {
    let map = traffic_stats().lock().unwrap();
    if let Some(stats) = map.get(profile_id) {
        (
            stats.bytes_sent.load(Ordering::Relaxed),
            stats.bytes_received.load(Ordering::Relaxed),
        )
    } else {
        (0, 0)
    }
}

/// Get traffic stats for all profiles.
pub fn get_all_traffic() -> HashMap<String, (u64, u64)> {
    let map = traffic_stats().lock().unwrap();
    map.iter()
        .map(|(k, v)| {
            (
                k.clone(),
                (
                    v.bytes_sent.load(Ordering::Relaxed),
                    v.bytes_received.load(Ordering::Relaxed),
                ),
            )
        })
        .collect()
}

/// Reset traffic stats for a profile.
pub fn reset_profile_traffic(profile_id: &str) {
    let map = traffic_stats().lock().unwrap();
    if let Some(stats) = map.get(profile_id) {
        stats.bytes_sent.store(0, Ordering::Relaxed);
        stats.bytes_received.store(0, Ordering::Relaxed);
    }
}

/// Reset all traffic stats.
pub fn reset_all_traffic() {
    let map = traffic_stats().lock().unwrap();
    for stats in map.values() {
        stats.bytes_sent.store(0, Ordering::Relaxed);
        stats.bytes_received.store(0, Ordering::Relaxed);
    }
}

// ---------------------------------------------------------------------------
// Relay Manager: tracks active relays per profile for graceful cleanup
// ---------------------------------------------------------------------------

struct RelayHandle {
    port: u16,
    shutdown: Arc<AtomicBool>,
}

fn active_relays() -> &'static Mutex<HashMap<String, RelayHandle>> {
    static INSTANCE: OnceLock<Mutex<HashMap<String, RelayHandle>>> = OnceLock::new();
    INSTANCE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Stop the relay associated with a specific profile path.
pub fn stop_relay(profile_id: &str) {
    let mut relays = active_relays().lock().unwrap();
    if let Some(handle) = relays.remove(profile_id) {
        eprintln!("[ProxyRelay] Shutting down relay on port {} for profile: {}", handle.port, profile_id);
        handle.shutdown.store(true, Ordering::SeqCst);
        // Connect to the listener to unblock the accept() call
        let _ = TcpStream::connect(format!("127.0.0.1:{}", handle.port));
    }
}

/// Stop all active relays (called on app exit).
#[allow(dead_code)]
pub fn stop_all_relays() {
    let mut relays = active_relays().lock().unwrap();
    for (profile_id, handle) in relays.drain() {
        eprintln!("[ProxyRelay] Shutting down relay on port {} for profile: {}", handle.port, profile_id);
        handle.shutdown.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(format!("127.0.0.1:{}", handle.port));
    }
}

fn register_relay(profile_id: &str, port: u16, shutdown: Arc<AtomicBool>) {
    let mut relays = active_relays().lock().unwrap();
    // Stop any existing relay for this profile first
    if let Some(old) = relays.remove(profile_id) {
        eprintln!("[ProxyRelay] Replacing existing relay on port {} for profile: {}", old.port, profile_id);
        old.shutdown.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(format!("127.0.0.1:{}", old.port));
    }
    relays.insert(profile_id.to_string(), RelayHandle { port, shutdown });
}

/// List all active relay ports keyed by profile ID.
pub fn get_active_relay_ports() -> HashMap<String, u16> {
    let relays = active_relays().lock().unwrap();
    relays.iter()
        .filter(|(_, h)| !h.shutdown.load(Ordering::SeqCst))
        .map(|(k, v)| (k.clone(), v.port))
        .collect()
}

// ---------------------------------------------------------------------------
// HTTP Proxy Relay (existing, with lifecycle management added)
// ---------------------------------------------------------------------------

struct RelayConfig {
    upstream_addr: String,
    auth_header: String,
    stats: Arc<TrafficStats>,
}

/// Start a local HTTP proxy relay that forwards connections to an upstream proxy with authentication.
/// Returns the local port number that Chrome should use as its proxy.
///
/// Flow:
///   Chrome -> 127.0.0.1:{local_port} (no auth) -> upstream_proxy (with Proxy-Authorization header)
pub fn start_proxy_relay(
    upstream_host: &str,
    upstream_port: u16,
    username: &str,
    password: &str,
    profile_id: &str,
) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind local proxy relay: {}", e))?;
    let local_port = listener.local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?
        .port();

    let credentials = format!("{}:{}", username, password);
    let auth_header = format!("Proxy-Authorization: Basic {}", BASE64.encode(credentials.as_bytes()));

    let upstream = format!("{}:{}", upstream_host, upstream_port);

    eprintln!("[ProxyRelay] Starting HTTP relay on 127.0.0.1:{} -> {} (user: {})",
        local_port, upstream, username);

    let stats = get_or_create_stats(profile_id);

    let config = Arc::new(RelayConfig {
        upstream_addr: upstream,
        auth_header,
        stats,
    });

    let shutdown = Arc::new(AtomicBool::new(false));
    register_relay(profile_id, local_port, Arc::clone(&shutdown));

    let shutdown_flag = Arc::clone(&shutdown);
    // Set a timeout on the listener so we can check the shutdown flag periodically
    listener.set_nonblocking(false).ok();

    thread::spawn(move || {
        // Use a timeout-based accept loop for graceful shutdown
        listener.set_nonblocking(true).ok();
        loop {
            if shutdown_flag.load(Ordering::SeqCst) {
                eprintln!("[ProxyRelay] HTTP relay on port {} shutting down", local_port);
                break;
            }
            match listener.accept() {
                Ok((client, _)) => {
                    if shutdown_flag.load(Ordering::SeqCst) {
                        break;
                    }
                    let cfg = Arc::clone(&config);
                    thread::spawn(move || {
                        if let Err(e) = handle_http_client(client, &cfg) {
                            eprintln!("[ProxyRelay] Connection error: {}", e);
                        }
                    });
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // No pending connection, sleep briefly then retry
                    thread::sleep(Duration::from_millis(50));
                }
                Err(e) => {
                    if !shutdown_flag.load(Ordering::SeqCst) {
                        eprintln!("[ProxyRelay] Accept error: {}", e);
                    }
                    break;
                }
            }
        }
    });

    Ok(local_port)
}

fn handle_http_client(client: TcpStream, config: &RelayConfig) -> Result<(), String> {
    client.set_nodelay(true).ok();

    let mut reader = BufReader::new(client.try_clone()
        .map_err(|e| format!("Clone error: {}", e))?);
    let mut writer = client;

    // Read the first line to determine request type
    let mut first_line = String::new();
    reader.read_line(&mut first_line)
        .map_err(|e| format!("Read error: {}", e))?;

    if first_line.is_empty() {
        return Ok(());
    }

    // Read remaining headers
    let mut headers = Vec::new();
    loop {
        let mut line = String::new();
        reader.read_line(&mut line)
            .map_err(|e| format!("Read header error: {}", e))?;
        if line == "\r\n" || line == "\n" || line.is_empty() {
            break;
        }
        // Skip any existing Proxy-Authorization from client
        if !line.to_lowercase().starts_with("proxy-authorization:") {
            headers.push(line);
        }
    }

    // Connect to upstream proxy
    let mut upstream = TcpStream::connect(&config.upstream_addr)
        .map_err(|e| format!("Upstream connect error ({}): {}", config.upstream_addr, e))?;
    upstream.set_nodelay(true).ok();

    // Send first line
    upstream.write_all(first_line.as_bytes())
        .map_err(|e| format!("Upstream write error: {}", e))?;

    // Send auth header FIRST (before other headers)
    upstream.write_all(format!("{}\r\n", config.auth_header).as_bytes())
        .map_err(|e| format!("Upstream auth write error: {}", e))?;

    // Send remaining headers
    for h in &headers {
        upstream.write_all(h.as_bytes())
            .map_err(|e| format!("Upstream header write error: {}", e))?;
    }

    // End of headers
    upstream.write_all(b"\r\n")
        .map_err(|e| format!("Upstream end headers error: {}", e))?;

    // Flush to ensure everything is sent
    upstream.flush()
        .map_err(|e| format!("Upstream flush error: {}", e))?;

    // Check if this is a CONNECT request (HTTPS tunneling)
    let is_connect = first_line.to_uppercase().starts_with("CONNECT ");

    if is_connect {
        // For CONNECT: read upstream response, forward to client, then pipe bidirectionally
        let mut upstream_reader = BufReader::new(upstream.try_clone()
            .map_err(|e| format!("Upstream clone error: {}", e))?);

        // Read the response status line first
        let mut status_line = String::new();
        upstream_reader.read_line(&mut status_line)
            .map_err(|e| format!("Upstream status read error: {}", e))?;

        // Check if auth failed (407)
        if status_line.contains("407") {
            eprintln!("[ProxyRelay] ERROR: Upstream returned 407 Proxy Authentication Required!");
            eprintln!("[ProxyRelay] Auth header sent: Proxy-Authorization: Basic <redacted>");
        }

        // Forward status line to client
        writer.write_all(status_line.as_bytes())
            .map_err(|e| format!("Client status write error: {}", e))?;

        // Read and forward remaining response headers from upstream
        loop {
            let mut resp_line = String::new();
            upstream_reader.read_line(&mut resp_line)
                .map_err(|e| format!("Upstream response read error: {}", e))?;
            writer.write_all(resp_line.as_bytes())
                .map_err(|e| format!("Client response write error: {}", e))?;
            if resp_line == "\r\n" || resp_line == "\n" || resp_line.is_empty() {
                break;
            }
        }
        writer.flush().ok();

        // Only pipe if tunnel was established (200)
        if status_line.contains("200") {
            // Bidirectional pipe: client <-> upstream
            let upstream_write = upstream;
            let client_read = reader.into_inner();
            pipe_bidirectional(client_read, writer, upstream_reader.into_inner(), upstream_write, Some(Arc::clone(&config.stats)));
        } else {
            eprintln!("[ProxyRelay] CONNECT failed: {}", status_line.trim());
        }
    } else {
        // For HTTP: there might be a request body (Content-Length based)
        let content_length: usize = headers.iter()
            .find(|h| h.to_lowercase().starts_with("content-length:"))
            .and_then(|h| h.split(':').nth(1))
            .and_then(|v| v.trim().parse().ok())
            .unwrap_or(0);

        // Forward request body if present
        if content_length > 0 {
            let mut body = vec![0u8; content_length];
            reader.read_exact(&mut body)
                .map_err(|e| format!("Read body error: {}", e))?;
            upstream.write_all(&body)
                .map_err(|e| format!("Write body error: {}", e))?;
            upstream.flush()
                .map_err(|e| format!("Flush body error: {}", e))?;
        }

        // Read upstream response first line for logging
        let mut upstream_reader = BufReader::new(upstream.try_clone()
            .map_err(|e| format!("Upstream clone for response: {}", e))?);
        let mut resp_status = String::new();
        upstream_reader.read_line(&mut resp_status)
            .map_err(|e| format!("Read response status error: {}", e))?;

        if resp_status.contains("407") {
            eprintln!("[ProxyRelay] ERROR: 407 Proxy Auth Required for HTTP request");
        }

        // Forward status line to client
        writer.write_all(resp_status.as_bytes())
            .map_err(|e| format!("Write response status error: {}", e))?;

        // Forward remaining response data
        let mut upstream_buf = [0u8; 8192];
        loop {
            match upstream_reader.read(&mut upstream_buf) {
                Ok(0) => break,
                Ok(n) => {
                    if writer.write_all(&upstream_buf[..n]).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// SOCKS5 Auth Relay (NEW)
// ---------------------------------------------------------------------------

struct Socks5Config {
    upstream_addr: String,
    username: String,
    password: String,
    stats: Arc<TrafficStats>,
}

/// Start a local HTTP proxy relay that forwards connections through a SOCKS5 upstream with auth.
/// Chrome connects to this relay as an HTTP proxy (no auth needed).
/// The relay performs SOCKS5 handshake with username/password auth, then tunnels traffic.
///
/// Flow:
///   Chrome -> 127.0.0.1:{local_port} (HTTP proxy, no auth)
///         -> SOCKS5 upstream (with username/password auth)
///         -> target website
pub fn start_socks5_relay(
    upstream_host: &str,
    upstream_port: u16,
    username: &str,
    password: &str,
    profile_id: &str,
) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind SOCKS5 relay: {}", e))?;
    let local_port = listener.local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?
        .port();

    let upstream = format!("{}:{}", upstream_host, upstream_port);

    eprintln!("[ProxyRelay] Starting SOCKS5 relay on 127.0.0.1:{} -> {} (user: {})",
        local_port, upstream, username);

    let stats = get_or_create_stats(profile_id);

    let config = Arc::new(Socks5Config {
        upstream_addr: upstream,
        username: username.to_string(),
        password: password.to_string(),
        stats,
    });

    let shutdown = Arc::new(AtomicBool::new(false));
    register_relay(profile_id, local_port, Arc::clone(&shutdown));

    let shutdown_flag = Arc::clone(&shutdown);

    thread::spawn(move || {
        listener.set_nonblocking(true).ok();
        loop {
            if shutdown_flag.load(Ordering::SeqCst) {
                eprintln!("[ProxyRelay] SOCKS5 relay on port {} shutting down", local_port);
                break;
            }
            match listener.accept() {
                Ok((client, _)) => {
                    if shutdown_flag.load(Ordering::SeqCst) {
                        break;
                    }
                    let cfg = Arc::clone(&config);
                    thread::spawn(move || {
                        if let Err(e) = handle_socks5_client(client, &cfg) {
                            eprintln!("[ProxyRelay] SOCKS5 connection error: {}", e);
                        }
                    });
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(50));
                }
                Err(e) => {
                    if !shutdown_flag.load(Ordering::SeqCst) {
                        eprintln!("[ProxyRelay] SOCKS5 accept error: {}", e);
                    }
                    break;
                }
            }
        }
    });

    Ok(local_port)
}

fn handle_socks5_client(client: TcpStream, config: &Socks5Config) -> Result<(), String> {
    client.set_nodelay(true).ok();

    let mut reader = BufReader::new(client.try_clone()
        .map_err(|e| format!("Clone error: {}", e))?);
    let mut writer = client;

    // Read the first line (HTTP request from Chrome)
    let mut first_line = String::new();
    reader.read_line(&mut first_line)
        .map_err(|e| format!("Read error: {}", e))?;

    if first_line.is_empty() {
        return Ok(());
    }

    // Read remaining headers (consume them, we don't forward HTTP headers to SOCKS)
    let mut headers = Vec::new();
    loop {
        let mut line = String::new();
        reader.read_line(&mut line)
            .map_err(|e| format!("Read header error: {}", e))?;
        if line == "\r\n" || line == "\n" || line.is_empty() {
            break;
        }
        headers.push(line);
    }

    // Parse target from the HTTP request
    let is_connect = first_line.to_uppercase().starts_with("CONNECT ");
    let (target_host, target_port) = if is_connect {
        // CONNECT host:port HTTP/1.1
        parse_connect_target(&first_line)?
    } else {
        // GET http://host:port/path HTTP/1.1
        parse_http_target(&first_line)?
    };

    // Connect to SOCKS5 upstream
    let mut upstream = TcpStream::connect(&config.upstream_addr)
        .map_err(|e| format!("SOCKS5 upstream connect error ({}): {}", config.upstream_addr, e))?;
    upstream.set_nodelay(true).ok();
    upstream.set_read_timeout(Some(Duration::from_secs(30))).ok();
    upstream.set_write_timeout(Some(Duration::from_secs(30))).ok();

    // SOCKS5 Handshake: greeting
    // [version=5, nmethods=2, methods=[0x00(no-auth), 0x02(username/password)]]
    upstream.write_all(&[0x05, 0x02, 0x00, 0x02])
        .map_err(|e| format!("SOCKS5 greeting write error: {}", e))?;
    upstream.flush().map_err(|e| format!("SOCKS5 greeting flush: {}", e))?;

    // Read server method selection: [version, method]
    let mut method_resp = [0u8; 2];
    upstream.read_exact(&mut method_resp)
        .map_err(|e| format!("SOCKS5 method response read error: {}", e))?;

    if method_resp[0] != 0x05 {
        return Err(format!("Invalid SOCKS5 version in response: {}", method_resp[0]));
    }

    match method_resp[1] {
        0x02 => {
            // Username/password auth sub-negotiation (RFC 1929)
            // [version=1, ulen, username, plen, password]
            let uname = config.username.as_bytes();
            let passwd = config.password.as_bytes();

            if uname.len() > 255 || passwd.len() > 255 {
                return Err("SOCKS5 auth: username or password too long (max 255 bytes)".to_string());
            }

            let mut auth_req = Vec::with_capacity(3 + uname.len() + passwd.len());
            auth_req.push(0x01); // auth version
            auth_req.push(uname.len() as u8);
            auth_req.extend_from_slice(uname);
            auth_req.push(passwd.len() as u8);
            auth_req.extend_from_slice(passwd);

            upstream.write_all(&auth_req)
                .map_err(|e| format!("SOCKS5 auth write error: {}", e))?;
            upstream.flush().map_err(|e| format!("SOCKS5 auth flush: {}", e))?;

            // Read auth result: [version, status]
            let mut auth_resp = [0u8; 2];
            upstream.read_exact(&mut auth_resp)
                .map_err(|e| format!("SOCKS5 auth response read error: {}", e))?;

            if auth_resp[1] != 0x00 {
                return Err(format!("SOCKS5 authentication failed (status={}). Check username/password.", auth_resp[1]));
            }
        }
        0x00 => {
            // No auth required (server chose no-auth even though we offered user/pass)
            eprintln!("[ProxyRelay] SOCKS5 server accepted no-auth (credentials not needed)");
        }
        0xFF => {
            return Err("SOCKS5 server rejected all auth methods".to_string());
        }
        m => {
            return Err(format!("SOCKS5 server selected unsupported auth method: {}", m));
        }
    }

    // SOCKS5 CONNECT request
    // [version=5, cmd=CONNECT(1), reserved=0, addr_type, addr, port]
    let mut connect_req = vec![0x05, 0x01, 0x00];

    // Use domain name (type 0x03) to let the SOCKS server resolve DNS
    connect_req.push(0x03); // DOMAINNAME
    let host_bytes = target_host.as_bytes();
    if host_bytes.len() > 255 {
        return Err("Target hostname too long for SOCKS5".to_string());
    }
    connect_req.push(host_bytes.len() as u8);
    connect_req.extend_from_slice(host_bytes);
    connect_req.extend_from_slice(&target_port.to_be_bytes());

    upstream.write_all(&connect_req)
        .map_err(|e| format!("SOCKS5 CONNECT write error: {}", e))?;
    upstream.flush().map_err(|e| format!("SOCKS5 CONNECT flush: {}", e))?;

    // Read CONNECT response: [version, status, reserved, addr_type, ...]
    let mut connect_resp = [0u8; 4];
    upstream.read_exact(&mut connect_resp)
        .map_err(|e| format!("SOCKS5 CONNECT response read error: {}", e))?;

    if connect_resp[1] != 0x00 {
        let err_msg = match connect_resp[1] {
            0x01 => "general SOCKS server failure",
            0x02 => "connection not allowed by ruleset",
            0x03 => "network unreachable",
            0x04 => "host unreachable",
            0x05 => "connection refused",
            0x06 => "TTL expired",
            0x07 => "command not supported",
            0x08 => "address type not supported",
            _ => "unknown error",
        };
        return Err(format!("SOCKS5 CONNECT failed: {} (code={})", err_msg, connect_resp[1]));
    }

    // Consume the remaining bound address in the response
    match connect_resp[3] {
        0x01 => {
            // IPv4: 4 bytes addr + 2 bytes port
            let mut discard = [0u8; 6];
            upstream.read_exact(&mut discard).ok();
        }
        0x03 => {
            // Domain: 1 byte len + domain + 2 bytes port
            let mut len_buf = [0u8; 1];
            upstream.read_exact(&mut len_buf).ok();
            let mut discard = vec![0u8; len_buf[0] as usize + 2];
            upstream.read_exact(&mut discard).ok();
        }
        0x04 => {
            // IPv6: 16 bytes addr + 2 bytes port
            let mut discard = [0u8; 18];
            upstream.read_exact(&mut discard).ok();
        }
        _ => {}
    }

    // Clear read timeout for the streaming phase
    upstream.set_read_timeout(None).ok();

    // Tunnel is established! Now bridge Chrome <-> SOCKS5 upstream

    if is_connect {
        // HTTPS: Send 200 Connection Established to Chrome, then pipe
        writer.write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            .map_err(|e| format!("Client 200 write error: {}", e))?;
        writer.flush().map_err(|e| format!("Client flush error: {}", e))?;

        let client_read = reader.into_inner();
        let upstream_read = upstream.try_clone()
            .map_err(|e| format!("Upstream clone for pipe: {}", e))?;
        pipe_bidirectional(client_read, writer, upstream_read, upstream, Some(Arc::clone(&config.stats)));
    } else {
        // HTTP: Forward the original request through the tunnel
        // Reconstruct the HTTP request with relative path (strip scheme+host)
        let relative_request = convert_to_relative_request(&first_line);
        upstream.write_all(relative_request.as_bytes())
            .map_err(|e| format!("SOCKS5 HTTP request write error: {}", e))?;

        // Forward headers (skip proxy-specific ones)
        for h in &headers {
            let lower = h.to_lowercase();
            if !lower.starts_with("proxy-authorization:")
                && !lower.starts_with("proxy-connection:") {
                upstream.write_all(h.as_bytes())
                    .map_err(|e| format!("SOCKS5 header write error: {}", e))?;
            }
        }
        upstream.write_all(b"\r\n")
            .map_err(|e| format!("SOCKS5 headers end write error: {}", e))?;
        upstream.flush()
            .map_err(|e| format!("SOCKS5 request flush error: {}", e))?;

        // Forward any request body
        let content_length: usize = headers.iter()
            .find(|h| h.to_lowercase().starts_with("content-length:"))
            .and_then(|h| h.split(':').nth(1))
            .and_then(|v| v.trim().parse().ok())
            .unwrap_or(0);

        if content_length > 0 {
            let mut body = vec![0u8; content_length];
            reader.read_exact(&mut body)
                .map_err(|e| format!("Read body error: {}", e))?;
            upstream.write_all(&body)
                .map_err(|e| format!("Write body error: {}", e))?;
            upstream.flush()
                .map_err(|e| format!("Flush body error: {}", e))?;
        }

        // Forward response back to Chrome
        let mut upstream_buf = [0u8; 8192];
        loop {
            match upstream.read(&mut upstream_buf) {
                Ok(0) => break,
                Ok(n) => {
                    if writer.write_all(&upstream_buf[..n]).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Parse target host:port from a CONNECT request line.
/// Example: "CONNECT example.com:443 HTTP/1.1\r\n" -> ("example.com", 443)
fn parse_connect_target(line: &str) -> Result<(String, u16), String> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 2 {
        return Err("Invalid CONNECT request line".to_string());
    }
    let authority = parts[1];
    let colon_pos = authority.rfind(':')
        .ok_or("CONNECT target missing port")?;
    let host = &authority[..colon_pos];
    let port: u16 = authority[colon_pos + 1..].parse()
        .map_err(|_| "Invalid port in CONNECT target")?;
    Ok((host.to_string(), port))
}

/// Parse target host:port from an HTTP request line.
/// Example: "GET http://example.com:80/path HTTP/1.1\r\n" -> ("example.com", 80)
fn parse_http_target(line: &str) -> Result<(String, u16), String> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 2 {
        return Err("Invalid HTTP request line".to_string());
    }
    let uri = parts[1];

    // Strip scheme
    let after_scheme = if let Some(pos) = uri.find("://") {
        &uri[pos + 3..]
    } else {
        uri
    };

    // Split host:port from path
    let host_port = if let Some(pos) = after_scheme.find('/') {
        &after_scheme[..pos]
    } else {
        after_scheme
    };

    if let Some(colon_pos) = host_port.rfind(':') {
        let host = &host_port[..colon_pos];
        let port: u16 = host_port[colon_pos + 1..].parse().unwrap_or(80);
        Ok((host.to_string(), port))
    } else {
        Ok((host_port.to_string(), 80))
    }
}

/// Convert an absolute HTTP request to relative (strip scheme+host).
/// "GET http://example.com/path HTTP/1.1" -> "GET /path HTTP/1.1"
fn convert_to_relative_request(line: &str) -> String {
    let parts: Vec<&str> = line.splitn(3, ' ').collect();
    if parts.len() < 3 {
        return line.to_string();
    }
    let method = parts[0];
    let uri = parts[1];
    let version = parts[2];

    let path = if let Some(pos) = uri.find("://") {
        let after_scheme = &uri[pos + 3..];
        if let Some(slash_pos) = after_scheme.find('/') {
            &after_scheme[slash_pos..]
        } else {
            "/"
        }
    } else {
        uri
    };

    format!("{} {} {}", method, path, version)
}

fn pipe_bidirectional(
    client_read: TcpStream,
    mut client_write: TcpStream,
    mut upstream_read: TcpStream,
    upstream_write: TcpStream,
    stats: Option<Arc<TrafficStats>>,
) {
    let stats_c2u = stats.clone();
    // Client -> Upstream (separate thread) = bytes_sent
    let mut c2u_read = client_read.try_clone().unwrap_or_else(|_| client_read);
    let mut c2u_write = upstream_write;
    let t1 = thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match c2u_read.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    if c2u_write.write_all(&buf[..n]).is_err() {
                        break;
                    }
                    if let Some(ref s) = stats_c2u {
                        s.bytes_sent.fetch_add(n as u64, Ordering::Relaxed);
                    }
                }
                Err(_) => break,
            }
        }
        c2u_write.shutdown(std::net::Shutdown::Write).ok();
    });

    // Upstream -> Client (current thread) = bytes_received
    let mut buf = [0u8; 8192];
    loop {
        match upstream_read.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                if client_write.write_all(&buf[..n]).is_err() {
                    break;
                }
                if let Some(ref s) = stats {
                    s.bytes_received.fetch_add(n as u64, Ordering::Relaxed);
                }
            }
            Err(_) => break,
        }
    }
    client_write.shutdown(std::net::Shutdown::Write).ok();

    t1.join().ok();
}
