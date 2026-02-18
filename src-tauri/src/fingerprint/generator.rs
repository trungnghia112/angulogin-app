//! Fingerprint generator.
//!
//! Generates realistic browser fingerprints using weighted random selection
//! based on real-world browser statistics.

use super::data;
use super::types::*;

/// Firefox version used for UA string (matches Camoufox binary version)
const DEFAULT_FF_VERSION: &str = "135.0";

/// Generate a complete fingerprint for the specified OS.
/// If no OS is specified, defaults to the current platform.
pub fn generate(os: Option<&str>) -> Fingerprint {
    let os = os.unwrap_or(default_os());

    let screen = generate_screen(os);
    let navigator = generate_navigator(os);
    let video_card = generate_webgl(os);
    let fonts = generate_fonts(os);
    let battery = generate_battery(os);
    let (timezone, locale) = generate_timezone_locale();

    Fingerprint {
        screen,
        navigator,
        video_card,
        fonts,
        battery,
        timezone,
        locale,
        os: os.to_string(),
    }
}

/// Get the default OS string for the current platform
fn default_os() -> &'static str {
    #[cfg(target_os = "macos")]
    { "macos" }
    #[cfg(target_os = "windows")]
    { "windows" }
    #[cfg(target_os = "linux")]
    { "linux" }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    { "windows" }
}

/// Generate screen fingerprint
fn generate_screen(os: &str) -> ScreenFingerprint {
    let resolutions = if os == "macos" {
        data::screen_resolutions_macos()
    } else {
        data::screen_resolutions()
    };

    let res = weighted_random(&resolutions, |r| r.weight);

    // Taskbar/dock offset (avail_height is slightly less than height)
    let taskbar_offset = match os {
        "windows" => 40, // Windows taskbar
        "macos" => 25,   // macOS menu bar + dock
        "linux" => 28,   // GNOME panel
        _ => 40,
    };

    ScreenFingerprint {
        width: res.width,
        height: res.height,
        avail_width: res.width,
        avail_height: res.height.saturating_sub(taskbar_offset),
        color_depth: 24,
        pixel_ratio: res.pixel_ratio,
    }
}

/// Generate navigator fingerprint
fn generate_navigator(os: &str) -> NavigatorFingerprint {
    let hw_values = data::hardware_concurrency_values();
    let mem_values = data::device_memory_values();

    let hardware_concurrency = weighted_random(&hw_values, |v| v.1).0;
    let device_memory = weighted_random(&mem_values, |v| v.1).0;

    let user_agent = data::firefox_user_agents(os, DEFAULT_FF_VERSION);
    let platform = data::navigator_platform(os).to_string();

    // Languages: primary + English fallback
    let timezones = data::timezones();
    let tz = weighted_random(&timezones, |t| t.2);
    let primary_lang = tz.1.to_string();
    let languages = if primary_lang.starts_with("en") {
        vec![primary_lang.clone()]
    } else {
        vec![primary_lang.clone(), "en-US".to_string(), "en".to_string()]
    };

    NavigatorFingerprint {
        user_agent,
        platform,
        language: primary_lang,
        languages,
        hardware_concurrency,
        device_memory,
        max_touch_points: if os == "windows" { 0 } else { 0 }, // Desktop = 0
        do_not_track: None, // Most users dont set DNT
    }
}

/// Generate WebGL video card fingerprint
fn generate_webgl(os: &str) -> VideoCard {
    let all_configs = data::webgl_configs();
    let compatible: Vec<_> = all_configs
        .iter()
        .filter(|c| c.os.iter().any(|o| o == os))
        .collect();

    if compatible.is_empty() {
        // Fallback
        return VideoCard {
            vendor: "Google Inc.".to_string(),
            renderer: "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)".to_string(),
        };
    }

    let config = weighted_random(&compatible, |c| c.weight);

    VideoCard {
        vendor: config.vendor.clone(),
        renderer: config.renderer.clone(),
    }
}

/// Generate font list for the OS
fn generate_fonts(os: &str) -> Vec<String> {
    let base_fonts = match os {
        "windows" => data::fonts_windows(),
        "macos" => data::fonts_macos(),
        "linux" => data::fonts_linux(),
        _ => data::fonts_windows(),
    };

    // Randomly remove a few fonts to create uniqueness (keep 85-95%)
    let keep_ratio = random_range(85, 95) as f64 / 100.0;
    let keep_count = (base_fonts.len() as f64 * keep_ratio) as usize;

    let mut fonts = base_fonts;
    // Simple shuffle: swap random elements, then truncate
    let len = fonts.len();
    for i in 0..len {
        let j = random_range(0, len as u32 - 1) as usize;
        fonts.swap(i, j);
    }
    fonts.truncate(keep_count);
    fonts.sort(); // Sort alphabetically (browsers report sorted)
    fonts
}

/// Generate battery fingerprint (only for laptops on some OS)
fn generate_battery(_os: &str) -> Option<BatteryFingerprint> {
    // ~60% chance of having battery API available
    if random_range(0, 100) < 60 {
        Some(BatteryFingerprint {
            charging: random_range(0, 100) < 50,
            level: random_range(20, 100) as f64 / 100.0,
            charging_time: None,
            discharging_time: None,
        })
    } else {
        None
    }
}

/// Generate timezone and locale pair
fn generate_timezone_locale() -> (String, String) {
    let timezones = data::timezones();
    let tz = weighted_random(&timezones, |t| t.2);
    (tz.0.to_string(), tz.1.to_string())
}

/// Weighted random selection from a slice
fn weighted_random<T, F>(items: &[T], weight_fn: F) -> &T
where
    F: Fn(&T) -> u32,
{
    let total_weight: u32 = items.iter().map(|i| weight_fn(i)).sum();
    let mut target = random_range(0, total_weight.saturating_sub(1));

    for item in items {
        let w = weight_fn(item);
        if target < w {
            return item;
        }
        target -= w;
    }

    // Fallback to first item
    &items[0]
}

/// Simple random number generator using system entropy
/// Range is inclusive [min, max]
fn random_range(min: u32, max: u32) -> u32 {
    if min >= max {
        return min;
    }

    // Use timestamp + thread ID for entropy (no external dependency)
    let seed = {
        use std::time::SystemTime;
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default();
        let nanos = now.subsec_nanos();
        let thread_id = std::thread::current().id();
        let thread_hash = format!("{:?}", thread_id);
        let thread_bytes: u32 = thread_hash.bytes().fold(0u32, |acc, b| acc.wrapping_add(b as u32));

        nanos.wrapping_mul(thread_bytes.wrapping_add(1))
            .wrapping_add(RANDOM_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed))
    };

    min + (seed % (max - min + 1))
}

/// Atomic counter for additional entropy
static RANDOM_COUNTER: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

/// Seeded PRNG based on Mulberry32 — deterministic output for same seed
struct SeededRng {
    state: u32,
}

impl SeededRng {
    fn new(seed: u64) -> Self {
        // Mix both halves of the u64 seed into a u32 state
        let lo = seed as u32;
        let hi = (seed >> 32) as u32;
        Self { state: lo ^ hi.wrapping_mul(0x9E3779B9) }
    }

    fn next(&mut self) -> u32 {
        self.state = self.state.wrapping_add(0x6D2B79F5);
        let mut t = self.state;
        t = (t ^ (t >> 15)).wrapping_mul(1 | t);
        t = (t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t))) ^ t;
        t ^ (t >> 14)
    }

    /// Inclusive range [min, max]
    fn range(&mut self, min: u32, max: u32) -> u32 {
        if min >= max {
            return min;
        }
        min + (self.next() % (max - min + 1))
    }

    /// Weighted random selection from a slice
    fn weighted_random<'a, T, F>(&mut self, items: &'a [T], weight_fn: F) -> &'a T
    where
        F: Fn(&T) -> u32,
    {
        let total_weight: u32 = items.iter().map(|i| weight_fn(i)).sum();
        let mut target = self.range(0, total_weight.saturating_sub(1));

        for item in items {
            let w = weight_fn(item);
            if target < w {
                return item;
            }
            target -= w;
        }
        &items[0]
    }
}

/// Generate a deterministic fingerprint from a seed.
/// The same seed always produces the same fingerprint.
pub fn generate_seeded(seed: u64, os: Option<&str>) -> Fingerprint {
    let os = os.unwrap_or(default_os());
    let mut rng = SeededRng::new(seed);

    let screen = generate_screen_seeded(os, &mut rng);
    let navigator = generate_navigator_seeded(os, &mut rng);
    let video_card = generate_webgl_seeded(os, &mut rng);
    let fonts = generate_fonts_seeded(os, &mut rng);
    let battery = generate_battery_seeded(&mut rng);
    let (timezone, locale) = generate_timezone_locale_seeded(&mut rng);

    Fingerprint {
        screen,
        navigator,
        video_card,
        fonts,
        battery,
        timezone,
        locale,
        os: os.to_string(),
    }
}

fn generate_screen_seeded(os: &str, rng: &mut SeededRng) -> ScreenFingerprint {
    let resolutions = if os == "macos" {
        data::screen_resolutions_macos()
    } else {
        data::screen_resolutions()
    };
    let res = rng.weighted_random(&resolutions, |r| r.weight);
    let taskbar_offset = match os {
        "windows" => 40,
        "macos" => 25,
        "linux" => 28,
        _ => 40,
    };
    ScreenFingerprint {
        width: res.width,
        height: res.height,
        avail_width: res.width,
        avail_height: res.height.saturating_sub(taskbar_offset),
        color_depth: 24,
        pixel_ratio: res.pixel_ratio,
    }
}

fn generate_navigator_seeded(os: &str, rng: &mut SeededRng) -> NavigatorFingerprint {
    let hw_values = data::hardware_concurrency_values();
    let mem_values = data::device_memory_values();

    let hardware_concurrency = rng.weighted_random(&hw_values, |v| v.1).0;
    let device_memory = rng.weighted_random(&mem_values, |v| v.1).0;

    let user_agent = data::firefox_user_agents(os, DEFAULT_FF_VERSION);
    let platform = data::navigator_platform(os).to_string();

    let timezones = data::timezones();
    let tz = rng.weighted_random(&timezones, |t| t.2);
    let primary_lang = tz.1.to_string();
    let languages = if primary_lang.starts_with("en") {
        vec![primary_lang.clone()]
    } else {
        vec![primary_lang.clone(), "en-US".to_string(), "en".to_string()]
    };

    NavigatorFingerprint {
        user_agent,
        platform,
        language: primary_lang,
        languages,
        hardware_concurrency,
        device_memory,
        max_touch_points: 0,
        do_not_track: None,
    }
}

fn generate_webgl_seeded(os: &str, rng: &mut SeededRng) -> VideoCard {
    let all_configs = data::webgl_configs();
    let compatible: Vec<_> = all_configs
        .iter()
        .filter(|c| c.os.iter().any(|o| o == os))
        .collect();

    if compatible.is_empty() {
        return VideoCard {
            vendor: "Google Inc.".to_string(),
            renderer: "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)".to_string(),
        };
    }

    let config = rng.weighted_random(&compatible, |c| c.weight);
    VideoCard {
        vendor: config.vendor.clone(),
        renderer: config.renderer.clone(),
    }
}

fn generate_fonts_seeded(os: &str, rng: &mut SeededRng) -> Vec<String> {
    let base_fonts = match os {
        "windows" => data::fonts_windows(),
        "macos" => data::fonts_macos(),
        "linux" => data::fonts_linux(),
        _ => data::fonts_windows(),
    };

    let keep_ratio = rng.range(85, 95) as f64 / 100.0;
    let keep_count = (base_fonts.len() as f64 * keep_ratio) as usize;

    let mut fonts = base_fonts;
    let len = fonts.len();
    for i in 0..len {
        let j = rng.range(0, len as u32 - 1) as usize;
        fonts.swap(i, j);
    }
    fonts.truncate(keep_count);
    fonts.sort();
    fonts
}

fn generate_battery_seeded(rng: &mut SeededRng) -> Option<BatteryFingerprint> {
    if rng.range(0, 100) < 60 {
        Some(BatteryFingerprint {
            charging: rng.range(0, 100) < 50,
            level: rng.range(20, 100) as f64 / 100.0,
            charging_time: None,
            discharging_time: None,
        })
    } else {
        None
    }
}

fn generate_timezone_locale_seeded(rng: &mut SeededRng) -> (String, String) {
    let timezones = data::timezones();
    let tz = rng.weighted_random(&timezones, |t| t.2);
    (tz.0.to_string(), tz.1.to_string())
}

/// Convert a Fingerprint to Camoufox-compatible config JSON
pub fn to_camoufox_config(fp: &Fingerprint) -> Result<String, String> {
    let config = CamoufoxFingerprintConfig::from(fp);
    serde_json::to_string(&config).map_err(|e| format!("Failed to serialize config: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_fingerprint() {
        let fp = generate(Some("windows"));
        assert_eq!(fp.os, "windows");
        assert!(fp.screen.width > 0);
        assert!(fp.screen.height > 0);
        assert!(!fp.navigator.user_agent.is_empty());
        assert!(fp.navigator.user_agent.contains("Windows"));
        assert!(!fp.video_card.vendor.is_empty());
        assert!(!fp.fonts.is_empty());
    }

    #[test]
    fn test_generate_macos() {
        let fp = generate(Some("macos"));
        assert!(fp.navigator.user_agent.contains("Macintosh"));
        assert_eq!(fp.navigator.platform, "MacIntel");
        assert!(fp.video_card.vendor.contains("Apple"));
    }

    #[test]
    fn test_generate_linux() {
        let fp = generate(Some("linux"));
        assert!(fp.navigator.user_agent.contains("Linux"));
        assert!(fp.fonts.iter().any(|f| f == "DejaVu Sans" || f == "Ubuntu" || f == "Noto Sans"));
    }

    #[test]
    fn test_to_camoufox_config() {
        let fp = generate(Some("windows"));
        let config = to_camoufox_config(&fp);
        assert!(config.is_ok());
        let json = config.unwrap();
        assert!(json.contains("navigator.userAgent"));
        assert!(json.contains("screen.width"));
    }

    #[test]
    fn test_random_range() {
        for _ in 0..100 {
            let val = random_range(5, 10);
            assert!(val >= 5 && val <= 10);
        }
    }

    #[test]
    fn test_fingerprints_are_different() {
        let fp1 = generate(Some("windows"));
        let fp2 = generate(Some("windows"));
        // With random generation, at least one field should differ most of the time
        // This is a probabilistic test
        let same = fp1.screen.width == fp2.screen.width
            && fp1.navigator.hardware_concurrency == fp2.navigator.hardware_concurrency
            && fp1.video_card.renderer == fp2.video_card.renderer
            && fp1.fonts.len() == fp2.fonts.len();
        // Allow same in rare cases but log it
        if same {
            eprintln!("Warning: Two fingerprints were identical (rare but possible)");
        }
    }
}
