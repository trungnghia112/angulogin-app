use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use std::thread;

/// Start a local proxy relay that forwards connections to an upstream proxy with authentication.
/// Returns the local port number that Chrome should use as its proxy.
///
/// Flow:
///   Chrome -> 127.0.0.1:{local_port} (no auth) -> upstream_proxy (with Proxy-Authorization header)
pub fn start_proxy_relay(
    upstream_host: &str,
    upstream_port: u16,
    username: &str,
    password: &str,
) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind local proxy relay: {}", e))?;
    let local_port = listener.local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?
        .port();

    let credentials = format!("{}:{}", username, password);
    let auth_header = format!("Proxy-Authorization: Basic {}", BASE64.encode(credentials.as_bytes()));

    let upstream = format!("{}:{}", upstream_host, upstream_port);

    let config = Arc::new(RelayConfig {
        upstream_addr: upstream,
        auth_header,
    });

    // Spawn acceptor thread (daemon - will stop when app exits)
    thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(client) => {
                    let cfg = Arc::clone(&config);
                    thread::spawn(move || {
                        if let Err(e) = handle_client(client, &cfg) {
                            eprintln!("[ProxyRelay] Connection error: {}", e);
                        }
                    });
                }
                Err(e) => {
                    eprintln!("[ProxyRelay] Accept error: {}", e);
                }
            }
        }
    });

    Ok(local_port)
}

struct RelayConfig {
    upstream_addr: String,
    auth_header: String,
}

fn handle_client(client: TcpStream, config: &RelayConfig) -> Result<(), String> {
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
        .map_err(|e| format!("Upstream connect error: {}", e))?;
    upstream.set_nodelay(true).ok();

    // Send first line
    upstream.write_all(first_line.as_bytes())
        .map_err(|e| format!("Upstream write error: {}", e))?;

    // Send headers with auth injected
    for h in &headers {
        upstream.write_all(h.as_bytes())
            .map_err(|e| format!("Upstream header write error: {}", e))?;
    }
    upstream.write_all(format!("{}\r\n", config.auth_header).as_bytes())
        .map_err(|e| format!("Upstream auth write error: {}", e))?;

    // End of headers
    upstream.write_all(b"\r\n")
        .map_err(|e| format!("Upstream end headers error: {}", e))?;

    // Check if this is a CONNECT request (HTTPS tunneling)
    let is_connect = first_line.to_uppercase().starts_with("CONNECT ");

    if is_connect {
        // For CONNECT: read upstream response, forward to client, then pipe bidirectionally
        let mut upstream_reader = BufReader::new(upstream.try_clone()
            .map_err(|e| format!("Upstream clone error: {}", e))?);

        // Read and forward the response line + headers from upstream
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

        // Bidirectional pipe: client <-> upstream
        let upstream_write = upstream;
        let client_read = reader.into_inner();
        pipe_bidirectional(client_read, writer, upstream_reader.into_inner(), upstream_write);
    } else {
        // For HTTP: there might be a request body (Content-Length based)
        // Check if there's a Content-Length header
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
        }

        // Read upstream response and forward to client
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

fn pipe_bidirectional(
    client_read: TcpStream,
    mut client_write: TcpStream,
    mut upstream_read: TcpStream,
    upstream_write: TcpStream,
) {
    // Client -> Upstream (separate thread)
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
                }
                Err(_) => break,
            }
        }
        c2u_write.shutdown(std::net::Shutdown::Write).ok();
    });

    // Upstream -> Client (current thread)
    let mut buf = [0u8; 8192];
    loop {
        match upstream_read.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                if client_write.write_all(&buf[..n]).is_err() {
                    break;
                }
            }
            Err(_) => break,
        }
    }
    client_write.shutdown(std::net::Shutdown::Write).ok();

    t1.join().ok();
}
