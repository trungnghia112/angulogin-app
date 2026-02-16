//! Static fingerprint data for realistic value generation.
//!
//! Contains screen resolutions, user agents, WebGL configs, and font lists
//! sourced from real-world browser statistics.

use serde::Deserialize;

/// Screen resolution entry
#[derive(Debug, Clone, Deserialize)]
pub struct ScreenResolution {
    pub width: u32,
    pub height: u32,
    pub pixel_ratio: f64,
    pub weight: u32, // Popularity weight for random selection
}

/// WebGL GPU configuration
#[derive(Debug, Clone, Deserialize)]
pub struct WebGLConfig {
    pub vendor: String,
    pub renderer: String,
    pub os: Vec<String>, // Compatible OS list
    pub weight: u32,
}

/// Common screen resolutions weighted by market share
pub fn screen_resolutions() -> Vec<ScreenResolution> {
    vec![
        ScreenResolution { width: 1920, height: 1080, pixel_ratio: 1.0, weight: 30 },
        ScreenResolution { width: 1366, height: 768, pixel_ratio: 1.0, weight: 15 },
        ScreenResolution { width: 1536, height: 864, pixel_ratio: 1.25, weight: 12 },
        ScreenResolution { width: 1440, height: 900, pixel_ratio: 1.0, weight: 8 },
        ScreenResolution { width: 1280, height: 720, pixel_ratio: 1.0, weight: 7 },
        ScreenResolution { width: 2560, height: 1440, pixel_ratio: 1.0, weight: 7 },
        ScreenResolution { width: 1600, height: 900, pixel_ratio: 1.0, weight: 5 },
        ScreenResolution { width: 1280, height: 800, pixel_ratio: 1.0, weight: 4 },
        ScreenResolution { width: 1280, height: 1024, pixel_ratio: 1.0, weight: 3 },
        ScreenResolution { width: 3840, height: 2160, pixel_ratio: 2.0, weight: 3 },
        ScreenResolution { width: 2560, height: 1600, pixel_ratio: 2.0, weight: 3 },
        ScreenResolution { width: 1680, height: 1050, pixel_ratio: 1.0, weight: 3 },
    ]
}

/// macOS-specific screen resolutions (Retina)
pub fn screen_resolutions_macos() -> Vec<ScreenResolution> {
    vec![
        ScreenResolution { width: 1440, height: 900, pixel_ratio: 2.0, weight: 20 },
        ScreenResolution { width: 1680, height: 1050, pixel_ratio: 2.0, weight: 15 },
        ScreenResolution { width: 1920, height: 1080, pixel_ratio: 2.0, weight: 12 },
        ScreenResolution { width: 2560, height: 1600, pixel_ratio: 2.0, weight: 12 },
        ScreenResolution { width: 1512, height: 982, pixel_ratio: 2.0, weight: 10 },
        ScreenResolution { width: 1470, height: 956, pixel_ratio: 2.0, weight: 10 },
        ScreenResolution { width: 1728, height: 1117, pixel_ratio: 2.0, weight: 8 },
        ScreenResolution { width: 2560, height: 1440, pixel_ratio: 2.0, weight: 8 },
        ScreenResolution { width: 3024, height: 1964, pixel_ratio: 2.0, weight: 5 },
    ]
}

/// WebGL GPU configurations (real GPU models)
pub fn webgl_configs() -> Vec<WebGLConfig> {
    vec![
        // NVIDIA - Windows/Linux
        WebGLConfig { vendor: "Google Inc. (NVIDIA)".into(), renderer: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)".into(), os: vec!["windows".into()], weight: 12 },
        WebGLConfig { vendor: "Google Inc. (NVIDIA)".into(), renderer: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)".into(), os: vec!["windows".into()], weight: 8 },
        WebGLConfig { vendor: "Google Inc. (NVIDIA)".into(), renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)".into(), os: vec!["windows".into()], weight: 10 },
        WebGLConfig { vendor: "Google Inc. (NVIDIA)".into(), renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)".into(), os: vec!["windows".into()], weight: 7 },
        WebGLConfig { vendor: "Google Inc. (NVIDIA)".into(), renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0, D3D11)".into(), os: vec!["windows".into()], weight: 6 },
        WebGLConfig { vendor: "Google Inc. (NVIDIA)".into(), renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)".into(), os: vec!["windows".into()], weight: 5 },
        // AMD - Windows
        WebGLConfig { vendor: "Google Inc. (AMD)".into(), renderer: "ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)".into(), os: vec!["windows".into()], weight: 8 },
        WebGLConfig { vendor: "Google Inc. (AMD)".into(), renderer: "ANGLE (AMD, AMD Radeon RX 6600 XT Direct3D11 vs_5_0 ps_5_0, D3D11)".into(), os: vec!["windows".into()], weight: 5 },
        WebGLConfig { vendor: "Google Inc. (AMD)".into(), renderer: "ANGLE (AMD, AMD Radeon RX 7600 Direct3D11 vs_5_0 ps_5_0, D3D11)".into(), os: vec!["windows".into()], weight: 4 },
        // Intel - Windows
        WebGLConfig { vendor: "Google Inc. (Intel)".into(), renderer: "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)".into(), os: vec!["windows".into()], weight: 10 },
        WebGLConfig { vendor: "Google Inc. (Intel)".into(), renderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)".into(), os: vec!["windows".into()], weight: 8 },
        // Apple - macOS
        WebGLConfig { vendor: "Apple".into(), renderer: "Apple M1".into(), os: vec!["macos".into()], weight: 15 },
        WebGLConfig { vendor: "Apple".into(), renderer: "Apple M1 Pro".into(), os: vec!["macos".into()], weight: 10 },
        WebGLConfig { vendor: "Apple".into(), renderer: "Apple M1 Max".into(), os: vec!["macos".into()], weight: 5 },
        WebGLConfig { vendor: "Apple".into(), renderer: "Apple M2".into(), os: vec!["macos".into()], weight: 12 },
        WebGLConfig { vendor: "Apple".into(), renderer: "Apple M2 Pro".into(), os: vec!["macos".into()], weight: 8 },
        WebGLConfig { vendor: "Apple".into(), renderer: "Apple M3".into(), os: vec!["macos".into()], weight: 7 },
        WebGLConfig { vendor: "Apple".into(), renderer: "Apple M3 Pro".into(), os: vec!["macos".into()], weight: 5 },
        // Linux
        WebGLConfig { vendor: "Mesa".into(), renderer: "Mesa Intel(R) UHD Graphics 630 (CFL GT2)".into(), os: vec!["linux".into()], weight: 10 },
        WebGLConfig { vendor: "Mesa".into(), renderer: "llvmpipe (LLVM 15.0.7, 256 bits)".into(), os: vec!["linux".into()], weight: 5 },
        WebGLConfig { vendor: "X.Org".into(), renderer: "AMD Radeon RX 580 (polaris10, LLVM 15.0.7, DRM 3.49, 6.2.0)".into(), os: vec!["linux".into()], weight: 6 },
    ]
}

/// Common fonts for Windows
pub fn fonts_windows() -> Vec<String> {
    vec![
        "Arial", "Arial Black", "Calibri", "Cambria", "Cambria Math",
        "Comic Sans MS", "Consolas", "Constantia", "Corbel", "Courier New",
        "Ebrima", "Franklin Gothic Medium", "Gabriola", "Gadugi",
        "Georgia", "Impact", "Ink Free", "Javanese Text", "Leelawadee UI",
        "Lucida Console", "Lucida Sans Unicode", "Malgun Gothic",
        "Microsoft Himalaya", "Microsoft JhengHei", "Microsoft New Tai Lue",
        "Microsoft PhagsPa", "Microsoft Sans Serif", "Microsoft Tai Le",
        "Microsoft YaHei", "Microsoft Yi Baiti", "MingLiU-ExtB",
        "Mongolian Baiti", "MS Gothic", "MS PGothic", "MS UI Gothic",
        "MV Boli", "Myanmar Text", "Nirmala UI", "Palatino Linotype",
        "Segoe MDL2 Assets", "Segoe Print", "Segoe Script", "Segoe UI",
        "Segoe UI Emoji", "Segoe UI Historic", "Segoe UI Symbol",
        "SimSun", "Sitka Banner", "Sitka Display", "Sitka Heading",
        "Sitka Small", "Sitka Subheading", "Sitka Text", "Sylfaen",
        "Symbol", "Tahoma", "Times New Roman", "Trebuchet MS",
        "Verdana", "Webdings", "Wingdings", "Yu Gothic",
    ].into_iter().map(String::from).collect()
}

/// Common fonts for macOS
pub fn fonts_macos() -> Vec<String> {
    vec![
        ".AppleSystemUIFont", "American Typewriter", "Andale Mono",
        "Apple Braille", "Apple Color Emoji", "Apple SD Gothic Neo",
        "Apple Symbols", "AppleGothic", "AppleMyungjo", "Arial",
        "Arial Black", "Arial Hebrew", "Arial Narrow", "Arial Rounded MT Bold",
        "Avenir", "Avenir Next", "Avenir Next Condensed", "Bangla MN",
        "Baskerville", "Bodoni 72", "Bradley Hand", "Brush Script MT",
        "Chalkboard", "Chalkboard SE", "Chalkduster", "Charter",
        "Cochin", "Comic Sans MS", "Copperplate", "Corsiva Hebrew",
        "Courier New", "Damascus", "DejaVu Sans", "Didot",
        "DIN Alternate", "DIN Condensed", "Futura", "Galvji",
        "Geneva", "Georgia", "Gill Sans", "Grantha Sangam MN",
        "Helvetica", "Helvetica Neue", "Hiragino Kaku Gothic Pro",
        "Hiragino Maru Gothic Pro", "Hiragino Mincho ProN", "Hoefler Text",
        "Impact", "InaiMathi", "Kailasa", "Kannada MN", "Kefa",
        "Khmer Sangam MN", "Kohinoor Bangla", "Kohinoor Telugu",
        "Lao Sangam MN", "Lucida Grande", "Luminari", "Malayalam Sangam MN",
        "Marker Felt", "Menlo", "Microsoft Sans Serif", "Monaco",
        "Noteworthy", "Optima", "Oriya Sangam MN", "Palatino",
        "Papyrus", "Phosphate", "PingFang HK", "PingFang SC",
        "PingFang TC", "PT Mono", "PT Sans", "PT Serif",
        "Rockwell", "Savoye LET", "Sinhala Sangam MN",
        "Skia", "Snell Roundhand", "STIXGeneral", "Symbol",
        "System Font", "Tahoma", "Tamil Sangam MN", "Telugu Sangam MN",
        "Thonburi", "Times New Roman", "Trebuchet MS", "Verdana",
        "Zapfino",
    ].into_iter().map(String::from).collect()
}

/// Common fonts for Linux
pub fn fonts_linux() -> Vec<String> {
    vec![
        "Cantarell", "DejaVu Sans", "DejaVu Sans Mono", "DejaVu Serif",
        "Droid Sans", "Droid Sans Mono", "Droid Serif", "FreeMono",
        "FreeSans", "FreeSerif", "Liberation Mono", "Liberation Sans",
        "Liberation Serif", "Lohit Bengali", "Lohit Devanagari",
        "Lohit Gujarati", "Lohit Tamil", "Noto Color Emoji", "Noto Mono",
        "Noto Sans", "Noto Sans CJK", "Noto Serif", "Noto Serif CJK",
        "Open Sans", "Roboto", "Ubuntu", "Ubuntu Mono",
        "WenQuanYi Micro Hei", "WenQuanYi Zen Hei",
    ].into_iter().map(String::from).collect()
}

/// Timezones with weights (common timezones first)
pub fn timezones() -> Vec<(&'static str, &'static str, u32)> {
    vec![
        ("America/New_York", "en-US", 15),
        ("America/Chicago", "en-US", 8),
        ("America/Denver", "en-US", 5),
        ("America/Los_Angeles", "en-US", 12),
        ("Europe/London", "en-GB", 10),
        ("Europe/Berlin", "de-DE", 8),
        ("Europe/Paris", "fr-FR", 7),
        ("Europe/Madrid", "es-ES", 4),
        ("Europe/Rome", "it-IT", 4),
        ("Europe/Amsterdam", "nl-NL", 3),
        ("Europe/Moscow", "ru-RU", 5),
        ("Asia/Tokyo", "ja-JP", 6),
        ("Asia/Seoul", "ko-KR", 4),
        ("Asia/Shanghai", "zh-CN", 8),
        ("Asia/Ho_Chi_Minh", "vi-VN", 3),
        ("Asia/Singapore", "en-SG", 3),
        ("Australia/Sydney", "en-AU", 4),
        ("Pacific/Auckland", "en-NZ", 2),
        ("America/Sao_Paulo", "pt-BR", 5),
        ("America/Toronto", "en-CA", 4),
    ]
}

/// Hardware concurrency values (CPU core counts) with weights
pub fn hardware_concurrency_values() -> Vec<(u8, u32)> {
    vec![
        (2, 5),
        (4, 20),
        (6, 15),
        (8, 25),
        (10, 8),
        (12, 12),
        (16, 10),
        (24, 3),
        (32, 2),
    ]
}

/// Device memory values (GB) with weights
pub fn device_memory_values() -> Vec<(f64, u32)> {
    vec![
        (2.0, 5),
        (4.0, 15),
        (8.0, 35),
        (16.0, 30),
        (32.0, 10),
        (64.0, 5),
    ]
}

/// Firefox user agent templates per OS
pub fn firefox_user_agents(os: &str, ff_version: &str) -> String {
    match os {
        "windows" => format!(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:{ff_version}) Gecko/20100101 Firefox/{ff_version}"
        ),
        "macos" => format!(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:{ff_version}) Gecko/20100101 Firefox/{ff_version}"
        ),
        "linux" => format!(
            "Mozilla/5.0 (X11; Linux x86_64; rv:{ff_version}) Gecko/20100101 Firefox/{ff_version}"
        ),
        _ => format!(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:{ff_version}) Gecko/20100101 Firefox/{ff_version}"
        ),
    }
}

/// Navigator platform per OS
pub fn navigator_platform(os: &str) -> &'static str {
    match os {
        "windows" => "Win32",
        "macos" => "MacIntel",
        "linux" => "Linux x86_64",
        _ => "Win32",
    }
}
