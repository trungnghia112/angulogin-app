//! Fingerprint type definitions.

use serde::{Deserialize, Serialize};

/// Complete browser fingerprint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fingerprint {
    pub screen: ScreenFingerprint,
    pub navigator: NavigatorFingerprint,
    pub video_card: VideoCard,
    pub fonts: Vec<String>,
    pub battery: Option<BatteryFingerprint>,
    pub timezone: String,
    pub locale: String,
    pub os: String,
}

/// Screen/display fingerprint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenFingerprint {
    pub width: u32,
    pub height: u32,
    pub avail_width: u32,
    pub avail_height: u32,
    pub color_depth: u8,
    pub pixel_ratio: f64,
}

/// Navigator/browser fingerprint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigatorFingerprint {
    pub user_agent: String,
    pub platform: String,
    pub language: String,
    pub languages: Vec<String>,
    pub hardware_concurrency: u8,
    pub device_memory: f64,
    pub max_touch_points: u8,
    pub do_not_track: Option<String>,
}

/// WebGL video card info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoCard {
    pub vendor: String,
    pub renderer: String,
}

/// Battery status fingerprint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatteryFingerprint {
    pub charging: bool,
    pub level: f64,
    pub charging_time: Option<f64>,
    pub discharging_time: Option<f64>,
}

/// Camoufox-compatible fingerprint config
/// This is what gets passed to Camoufox via env vars
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CamoufoxFingerprintConfig {
    #[serde(rename = "screen.width")]
    pub screen_width: u32,
    #[serde(rename = "screen.height")]
    pub screen_height: u32,
    #[serde(rename = "screen.availWidth")]
    pub screen_avail_width: u32,
    #[serde(rename = "screen.availHeight")]
    pub screen_avail_height: u32,
    #[serde(rename = "screen.colorDepth")]
    pub screen_color_depth: u8,
    #[serde(rename = "screen.pixelDepth")]
    pub screen_pixel_depth: u8,
    #[serde(rename = "window.devicePixelRatio")]
    pub device_pixel_ratio: f64,
    #[serde(rename = "navigator.userAgent")]
    pub user_agent: String,
    #[serde(rename = "navigator.platform")]
    pub platform: String,
    #[serde(rename = "navigator.language")]
    pub language: String,
    #[serde(rename = "navigator.languages")]
    pub languages: Vec<String>,
    #[serde(rename = "navigator.hardwareConcurrency")]
    pub hardware_concurrency: u8,
    #[serde(rename = "navigator.deviceMemory")]
    pub device_memory: f64,
    #[serde(rename = "navigator.maxTouchPoints")]
    pub max_touch_points: u8,
    #[serde(rename = "navigator.doNotTrack")]
    pub do_not_track: Option<String>,
    #[serde(rename = "webGl.vendor")]
    pub webgl_vendor: String,
    #[serde(rename = "webGl.renderer")]
    pub webgl_renderer: String,
    pub fonts: Vec<String>,
    #[serde(rename = "intl.timezone")]
    pub timezone: String,
    #[serde(rename = "intl.locale")]
    pub locale: String,
}

impl From<&Fingerprint> for CamoufoxFingerprintConfig {
    fn from(fp: &Fingerprint) -> Self {
        Self {
            screen_width: fp.screen.width,
            screen_height: fp.screen.height,
            screen_avail_width: fp.screen.avail_width,
            screen_avail_height: fp.screen.avail_height,
            screen_color_depth: fp.screen.color_depth,
            screen_pixel_depth: fp.screen.color_depth,
            device_pixel_ratio: fp.screen.pixel_ratio,
            user_agent: fp.navigator.user_agent.clone(),
            platform: fp.navigator.platform.clone(),
            language: fp.navigator.language.clone(),
            languages: fp.navigator.languages.clone(),
            hardware_concurrency: fp.navigator.hardware_concurrency,
            device_memory: fp.navigator.device_memory,
            max_touch_points: fp.navigator.max_touch_points,
            do_not_track: fp.navigator.do_not_track.clone(),
            webgl_vendor: fp.video_card.vendor.clone(),
            webgl_renderer: fp.video_card.renderer.clone(),
            fonts: fp.fonts.clone(),
            timezone: fp.timezone.clone(),
            locale: fp.locale.clone(),
        }
    }
}
