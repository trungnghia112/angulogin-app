//! Fingerprint module for Camoufox integration.
//!
//! Generates realistic browser fingerprints for antidetect functionality.
//! Each fingerprint contains Screen, Navigator, WebGL, Fonts, Battery,
//! Timezone, and Locale information that is consistent per OS.

pub mod types;
pub mod generator;
pub mod data;
