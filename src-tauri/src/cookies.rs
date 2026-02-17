use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

/// Cookie in EditThisCookie/Cookie-Editor JSON format (industry standard)
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CookieJson {
    pub name: String,
    pub value: String,
    pub domain: String,
    pub path: String,
    #[serde(default)]
    pub expires: f64,
    #[serde(default)]
    pub http_only: bool,
    #[serde(default)]
    pub secure: bool,
    #[serde(default)]
    pub same_site: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CookieExportResult {
    pub cookies: Vec<CookieJson>,
    pub count: usize,
    pub decrypted_count: usize,
    pub format: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CookieImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

/// Get the Chrome Safe Storage password from macOS Keychain
fn get_chrome_keychain_password(browser: &str) -> Result<String, String> {
    let service_name = match browser {
        "brave" => "Brave Safe Storage",
        "edge" => "Microsoft Edge Safe Storage",
        "arc" => "Arc Safe Storage",
        _ => "Chrome Safe Storage",
    };

    let output = Command::new("security")
        .args(["find-generic-password", "-ga", service_name, "-w"])
        .output()
        .map_err(|e| format!("Failed to run security command: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Failed to get keychain password for {}: {}",
            service_name,
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let password = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if password.is_empty() {
        return Err("Keychain password is empty".to_string());
    }
    Ok(password)
}

/// Derive the AES-128 key from the keychain password using PBKDF2
fn derive_key(password: &str) -> [u8; 16] {
    use hmac::Hmac;
    use sha1::Sha1;

    let salt = b"saltysalt";
    let iterations = 1003;
    let mut key = [0u8; 16];

    pbkdf2::pbkdf2::<Hmac<Sha1>>(password.as_bytes(), salt, iterations, &mut key)
        .expect("PBKDF2 derivation failed");

    key
}

/// Decrypt a Chrome encrypted cookie value (macOS)
/// Chrome prefixes encrypted values with b"v10" (3 bytes), followed by
/// 16 bytes IV (all spaces on macOS) + AES-128-CBC ciphertext (PKCS7 padded)
fn decrypt_cookie_value(encrypted: &[u8], key: &[u8; 16]) -> Result<String, String> {
    use aes::cipher::{BlockDecryptMut, KeyIvInit};

    if encrypted.len() < 3 {
        return Err("Encrypted value too short".to_string());
    }

    // Check for "v10" prefix (macOS Chrome encryption marker)
    if &encrypted[..3] != b"v10" {
        // Not encrypted or unknown format, try as UTF-8
        return String::from_utf8(encrypted.to_vec())
            .map_err(|_| "Not a v10 encrypted value and not valid UTF-8".to_string());
    }

    let ciphertext = &encrypted[3..];
    if ciphertext.is_empty() {
        return Ok(String::new());
    }

    // macOS Chrome uses 16 bytes of spaces as IV
    let iv: [u8; 16] = [b' '; 16];

    type Aes128CbcDec = cbc::Decryptor<aes::Aes128>;

    let mut buf = ciphertext.to_vec();
    let decryptor = Aes128CbcDec::new(key.into(), &iv.into());

    let decrypted = decryptor
        .decrypt_padded_mut::<aes::cipher::block_padding::Pkcs7>(&mut buf)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(decrypted.to_vec())
        .map_err(|_| "Decrypted value is not valid UTF-8".to_string())
}

/// Resolve the Cookies database path within a Chrome profile
fn find_cookies_db(profile_path: &str) -> Result<String, String> {
    let path = Path::new(profile_path);

    // Check direct Cookies file
    let direct = path.join("Cookies");
    if direct.exists() {
        return Ok(direct.to_string_lossy().to_string());
    }

    // Check Default subfolder
    let default_sub = path.join("Default").join("Cookies");
    if default_sub.exists() {
        return Ok(default_sub.to_string_lossy().to_string());
    }

    Err("Cookies database not found in profile".to_string())
}

/// Export cookies from a Chrome profile's Cookies SQLite database
pub fn export_cookies(profile_path: String, browser: Option<String>) -> Result<CookieExportResult, String> {
    crate::commands::validate_path_safety(&profile_path, "Profile path")?;

    let db_path = find_cookies_db(&profile_path)?;

    // Open the SQLite database in read-only mode
    let conn = Connection::open_with_flags(
        &db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("Failed to open Cookies database: {}", e))?;

    // Try to get decryption key
    let browser_name = browser.as_deref().unwrap_or("chrome");
    let key_result = get_chrome_keychain_password(browser_name).and_then(|pwd| Ok(derive_key(&pwd)));

    let mut stmt = conn
        .prepare(
            "SELECT host_key, name, value, encrypted_value, path, expires_utc, is_secure, is_httponly, samesite
             FROM cookies ORDER BY host_key, name",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let mut cookies = Vec::new();
    let mut decrypted_count = 0usize;

    let rows = stmt
        .query_map([], |row| {
            let host_key: String = row.get(0)?;
            let name: String = row.get(1)?;
            let plain_value: String = row.get(2)?;
            let encrypted_value: Vec<u8> = row.get(3)?;
            let path: String = row.get(4)?;
            let expires_utc: i64 = row.get(5)?;
            let is_secure: bool = row.get(6)?;
            let is_httponly: bool = row.get(7)?;
            let samesite: i32 = row.get(8)?;
            Ok((host_key, name, plain_value, encrypted_value, path, expires_utc, is_secure, is_httponly, samesite))
        })
        .map_err(|e| format!("Failed to query cookies: {}", e))?;

    for row_result in rows {
        let (host_key, name, plain_value, encrypted_value, path, expires_utc, is_secure, is_httponly, samesite) =
            row_result.map_err(|e| format!("Failed to read row: {}", e))?;

        // Try to get the cookie value: prefer plain, then decrypt
        let value = if !plain_value.is_empty() {
            decrypted_count += 1;
            plain_value
        } else if !encrypted_value.is_empty() {
            if let Ok(ref key) = key_result {
                match decrypt_cookie_value(&encrypted_value, key) {
                    Ok(v) => {
                        decrypted_count += 1;
                        v
                    }
                    Err(_) => String::new(),
                }
            } else {
                String::new()
            }
        } else {
            String::new()
        };

        // Convert Chrome's microsecond epoch (Jan 1, 1601) to Unix epoch seconds
        let expires = if expires_utc > 0 {
            // Chrome epoch starts at Jan 1, 1601. Unix epoch starts at Jan 1, 1970.
            // Difference is 11644473600 seconds. Chrome stores in microseconds.
            let chrome_to_unix = (expires_utc / 1_000_000) - 11644473600;
            chrome_to_unix as f64
        } else {
            0.0
        };

        let same_site_str = match samesite {
            0 => Some("unspecified".to_string()),
            1 => Some("lax".to_string()),
            2 => Some("strict".to_string()),
            _ => Some("no_restriction".to_string()),
        };

        cookies.push(CookieJson {
            name,
            value,
            domain: host_key,
            path,
            expires,
            http_only: is_httponly,
            secure: is_secure,
            same_site: same_site_str,
        });
    }

    let count = cookies.len();
    Ok(CookieExportResult {
        cookies,
        count,
        decrypted_count,
        format: "json".to_string(),
    })
}

/// Import cookies into a Chrome profile's Cookies SQLite database
pub fn import_cookies(profile_path: String, cookies_json: String) -> Result<CookieImportResult, String> {
    crate::commands::validate_path_safety(&profile_path, "Profile path")?;

    let cookies: Vec<CookieJson> = serde_json::from_str(&cookies_json)
        .map_err(|e| format!("Failed to parse cookies JSON: {}", e))?;

    if cookies.is_empty() {
        return Ok(CookieImportResult {
            imported: 0,
            skipped: 0,
            errors: vec!["No cookies in JSON".to_string()],
        });
    }

    // Find or create the Cookies database
    let db_path = find_cookies_db(&profile_path).unwrap_or_else(|_| {
        // Create Cookies file in the profile directory
        let path = Path::new(&profile_path);
        let cookies_path = path.join("Cookies");
        cookies_path.to_string_lossy().to_string()
    });

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open/create Cookies database: {}", e))?;

    // Create the cookies table if it doesn't exist (for new profiles)
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS cookies (
            creation_utc INTEGER NOT NULL,
            host_key TEXT NOT NULL,
            top_frame_site_key TEXT NOT NULL DEFAULT '',
            name TEXT NOT NULL,
            value TEXT NOT NULL DEFAULT '',
            encrypted_value BLOB NOT NULL DEFAULT X'',
            path TEXT NOT NULL DEFAULT '/',
            expires_utc INTEGER NOT NULL DEFAULT 0,
            is_secure INTEGER NOT NULL DEFAULT 0,
            is_httponly INTEGER NOT NULL DEFAULT 0,
            last_access_utc INTEGER NOT NULL DEFAULT 0,
            has_expires INTEGER NOT NULL DEFAULT 1,
            is_persistent INTEGER NOT NULL DEFAULT 1,
            priority INTEGER NOT NULL DEFAULT 1,
            samesite INTEGER NOT NULL DEFAULT -1,
            source_scheme INTEGER NOT NULL DEFAULT 2,
            source_port INTEGER NOT NULL DEFAULT -1,
            last_update_utc INTEGER NOT NULL DEFAULT 0,
            source_type INTEGER NOT NULL DEFAULT 0,
            has_cross_site_ancestor INTEGER NOT NULL DEFAULT 0,
            UNIQUE (host_key, top_frame_site_key, name, path, source_scheme, source_port, has_cross_site_ancestor)
        );
        CREATE TABLE IF NOT EXISTS meta (key TEXT NOT NULL UNIQUE PRIMARY KEY, value TEXT NOT NULL);",
    )
    .map_err(|e| format!("Failed to create tables: {}", e))?;

    let now_utc = {
        // Chrome uses microseconds since Jan 1, 1601
        let unix_epoch_seconds = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        (unix_epoch_seconds + 11644473600) * 1_000_000
    };

    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut errors = Vec::new();

    for cookie in &cookies {
        // Convert Unix epoch seconds to Chrome microsecond epoch
        let expires_utc = if cookie.expires > 0.0 {
            ((cookie.expires as i64) + 11644473600) * 1_000_000
        } else {
            0
        };

        let samesite = match cookie.same_site.as_deref() {
            Some("strict") => 2,
            Some("lax") => 1,
            Some("no_restriction") | Some("none") => -1,
            _ => -1,
        };

        let is_secure = if cookie.secure { 1 } else { 0 };
        let is_httponly = if cookie.http_only { 1 } else { 0 };
        let has_expires = if cookie.expires > 0.0 { 1 } else { 0 };

        // Use INSERT OR REPLACE to handle duplicates
        let result = conn.execute(
            "INSERT OR REPLACE INTO cookies (
                creation_utc, host_key, top_frame_site_key, name, value, encrypted_value,
                path, expires_utc, is_secure, is_httponly, last_access_utc, has_expires,
                is_persistent, priority, samesite, source_scheme, source_port,
                last_update_utc, source_type, has_cross_site_ancestor
            ) VALUES (
                ?1, ?2, '', ?3, ?4, X'', ?5, ?6, ?7, ?8, ?9, ?10,
                1, 1, ?11, 2, -1, ?12, 0, 0
            )",
            params![
                now_utc,
                cookie.domain,
                cookie.name,
                cookie.value,
                cookie.path,
                expires_utc,
                is_secure,
                is_httponly,
                now_utc,
                has_expires,
                samesite,
                now_utc,
            ],
        );

        match result {
            Ok(_) => imported += 1,
            Err(e) => {
                errors.push(format!("{}@{}: {}", cookie.name, cookie.domain, e));
                skipped += 1;
            }
        }
    }

    eprintln!("[CookieImport] Imported {} cookies, skipped {} for profile: {}", imported, skipped, profile_path);

    Ok(CookieImportResult {
        imported,
        skipped,
        errors,
    })
}
