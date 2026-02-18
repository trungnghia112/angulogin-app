/**
 * AnguLogin Stealth Extension — Content Script (MAIN world)
 *
 * Spoofs browser fingerprint APIs using a per-profile seed injected by Tauri.
 * Runs before any page script via document_start + MAIN world.
 *
 * Spoofing targets:
 *   1. Canvas 2D (toDataURL, toBlob, getImageData)
 *   2. WebGL (getParameter for vendor/renderer, readPixels noise)
 *   3. Navigator (hardwareConcurrency, deviceMemory, platform, languages)
 *   4. Screen (width, height, availWidth, availHeight, colorDepth, pixelRatio)
 *   5. WebRTC (RTCPeerConnection leak prevention)
 *   6. Automation detection prevention
 *
 * Config is injected INLINE by Tauri (no window globals).
 * The placeholder below is replaced at build time per-profile:
 */
(function () {
    'use strict';

    // --- Config (injected inline by Tauri — never exposed to page) ---
    // @@STEALTH_CONFIG_PLACEHOLDER@@ is replaced by prepare_stealth_extension()
    const CFG = null; /* @@STEALTH_CONFIG@@ */

    if (!CFG) {
        // No config injected — skip spoofing (extension loaded manually)
        return;
    }

    const SEED = CFG.seed || 0;

    // --- Seeded PRNG (Mulberry32) ---
    function mulberry32(seed) {
        let s = seed | 0;
        return function () {
            s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const rng = mulberry32(SEED);

    // --- Helper: Define non-configurable property ---
    function defineProperty(obj, prop, value) {
        try {
            Object.defineProperty(obj, prop, {
                get: function () { return value; },
                configurable: false,
                enumerable: true,
            });
        } catch (e) {
            // Property may already be non-configurable
        }
    }

    // --- Helper: Define getter property (called each access) ---
    function defineGetter(obj, prop, getter) {
        try {
            Object.defineProperty(obj, prop, {
                get: getter,
                configurable: false,
                enumerable: true,
            });
        } catch (e) {
            // Property may already be non-configurable
        }
    }

    // --- Helper: Wrap a method with detection resistance ---
    function wrapMethod(obj, methodName, wrapper) {
        const original = obj[methodName];
        if (!original) return;

        const wrapped = wrapper(original);
        // Preserve toString to avoid detection
        wrapped.toString = function () {
            return original.toString();
        };
        wrapped.toString.toString = function () {
            return Function.prototype.toString.toString();
        };

        try {
            Object.defineProperty(obj, methodName, {
                value: wrapped,
                writable: false,
                configurable: false,
            });
        } catch (e) {
            obj[methodName] = wrapped;
        }
    }

    // =========================================================================
    // 1. CANVAS SPOOFING (non-destructive — never modifies original canvas)
    // =========================================================================
    (function spoofCanvas() {
        const canvasSeed = SEED ^ 0xCAFE;

        function addNoiseToImageData(imageData) {
            const data = imageData.data;
            const localRng = mulberry32(canvasSeed ^ data.length);
            // Add subtle noise to ~2% of pixels (undetectable by eye)
            for (let i = 0; i < data.length; i += 4) {
                if (localRng() < 0.02) {
                    // Flip least significant bit of R channel
                    data[i] ^= 1;
                }
            }
            return imageData;
        }

        // Clone canvas with noise applied (DO NOT modify original)
        function createNoisyClone(sourceCanvas) {
            var clone = document.createElement('canvas');
            clone.width = sourceCanvas.width;
            clone.height = sourceCanvas.height;
            var ctx = clone.getContext('2d');
            if (!ctx) return null;
            ctx.drawImage(sourceCanvas, 0, 0);
            var imageData = ctx.getImageData(0, 0, clone.width, clone.height);
            addNoiseToImageData(imageData);
            ctx.putImageData(imageData, 0, 0);
            return clone;
        }

        // Override HTMLCanvasElement.toDataURL
        wrapMethod(HTMLCanvasElement.prototype, 'toDataURL', function (original) {
            return function () {
                try {
                    var clone = createNoisyClone(this);
                    if (clone) return original.apply(clone, arguments);
                } catch (e) {
                    // Cross-origin canvas or other error — fall through
                }
                return original.apply(this, arguments);
            };
        });

        // Override HTMLCanvasElement.toBlob
        wrapMethod(HTMLCanvasElement.prototype, 'toBlob', function (original) {
            return function () {
                try {
                    var clone = createNoisyClone(this);
                    if (clone) return original.apply(clone, arguments);
                } catch (e) {
                    // Cross-origin canvas — fall through
                }
                return original.apply(this, arguments);
            };
        });

        // Override CanvasRenderingContext2D.getImageData
        wrapMethod(CanvasRenderingContext2D.prototype, 'getImageData', function (original) {
            return function () {
                var imageData = original.apply(this, arguments);
                addNoiseToImageData(imageData);
                return imageData;
            };
        });
    })();

    // =========================================================================
    // 2. WEBGL SPOOFING
    // =========================================================================
    (function spoofWebGL() {
        if (!CFG.webgl) return;

        var vendor = CFG.webgl.vendor;
        var renderer = CFG.webgl.renderer;
        var UNMASKED_VENDOR = 0x9245;  // UNMASKED_VENDOR_WEBGL
        var UNMASKED_RENDERER = 0x9246; // UNMASKED_RENDERER_WEBGL

        function patchGetParameter(proto) {
            wrapMethod(proto, 'getParameter', function (original) {
                return function (param) {
                    if (param === UNMASKED_VENDOR) return vendor;
                    if (param === UNMASKED_RENDERER) return renderer;
                    return original.call(this, param);
                };
            });
        }

        if (typeof WebGLRenderingContext !== 'undefined') {
            patchGetParameter(WebGLRenderingContext.prototype);
        }
        if (typeof WebGL2RenderingContext !== 'undefined') {
            patchGetParameter(WebGL2RenderingContext.prototype);
        }
    })();

    // =========================================================================
    // 3. NAVIGATOR SPOOFING
    // =========================================================================
    (function spoofNavigator() {
        if (!CFG.navigator) return;

        var nav = CFG.navigator;

        if (nav.hardwareConcurrency != null) {
            defineProperty(navigator, 'hardwareConcurrency', nav.hardwareConcurrency);
        }
        if (nav.deviceMemory != null) {
            defineProperty(navigator, 'deviceMemory', nav.deviceMemory);
        }
        if (nav.platform != null) {
            defineProperty(navigator, 'platform', nav.platform);
        }
        if (nav.language != null) {
            defineProperty(navigator, 'language', nav.language);
        }
        if (nav.languages != null) {
            // Return a NEW frozen copy each call (matches real Chrome behavior)
            var langArr = nav.languages;
            defineGetter(navigator, 'languages', function () {
                return Object.freeze(langArr.slice());
            });
        }
        if (nav.maxTouchPoints != null) {
            defineProperty(navigator, 'maxTouchPoints', nav.maxTouchPoints);
        }
        if (nav.doNotTrack != null) {
            defineProperty(navigator, 'doNotTrack', nav.doNotTrack);
        }

        // Override navigator.userAgent via Object.defineProperty
        if (nav.userAgent != null) {
            defineProperty(navigator, 'userAgent', nav.userAgent);
            defineProperty(navigator, 'appVersion', nav.userAgent.replace('Mozilla/', ''));
        }
    })();

    // =========================================================================
    // 4. SCREEN SPOOFING
    // =========================================================================
    (function spoofScreen() {
        if (!CFG.screen) return;

        var scr = CFG.screen;

        if (scr.width != null) {
            defineProperty(screen, 'width', scr.width);
        }
        if (scr.height != null) {
            defineProperty(screen, 'height', scr.height);
        }
        if (scr.availWidth != null) {
            defineProperty(screen, 'availWidth', scr.availWidth);
        }
        if (scr.availHeight != null) {
            defineProperty(screen, 'availHeight', scr.availHeight);
        }
        if (scr.colorDepth != null) {
            defineProperty(screen, 'colorDepth', scr.colorDepth);
            defineProperty(screen, 'pixelDepth', scr.colorDepth);
        }
        if (scr.pixelRatio != null) {
            defineProperty(window, 'devicePixelRatio', scr.pixelRatio);
        }

        // Also override outerWidth/outerHeight
        if (scr.width != null) {
            defineProperty(window, 'outerWidth', scr.width);
        }
        if (scr.height != null) {
            defineProperty(window, 'outerHeight', scr.height);
        }
    })();

    // =========================================================================
    // 5. WEBRTC LEAK PREVENTION
    // =========================================================================
    (function spoofWebRTC() {
        if (CFG.blockWebRTC === false) return;

        // Wrap RTCPeerConnection to prevent local IP leaking
        var OriginalRTC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
        if (!OriginalRTC) return;

        function WrappedRTC(config, constraints) {
            // Force relay-only ICE transport to prevent local IP exposure
            if (!config) {
                config = { iceTransportPolicy: 'relay' };
            } else {
                config.iceTransportPolicy = 'relay';
            }
            // Use Reflect.construct for proper prototype chain
            return Reflect.construct(OriginalRTC, [config, constraints], WrappedRTC);
        }

        // Set up proper prototype chain
        WrappedRTC.prototype = Object.create(OriginalRTC.prototype, {
            constructor: { value: WrappedRTC, writable: true, configurable: true }
        });
        Object.setPrototypeOf(WrappedRTC, OriginalRTC);

        // Copy static methods
        if (OriginalRTC.generateCertificate) {
            WrappedRTC.generateCertificate = OriginalRTC.generateCertificate;
        }

        // Preserve toString
        WrappedRTC.toString = function () {
            return OriginalRTC.toString();
        };

        try {
            Object.defineProperty(window, 'RTCPeerConnection', {
                value: WrappedRTC,
                writable: false,
                configurable: false,
            });
        } catch (e) {
            window.RTCPeerConnection = WrappedRTC;
        }

        if (window.webkitRTCPeerConnection) {
            try {
                Object.defineProperty(window, 'webkitRTCPeerConnection', {
                    value: WrappedRTC,
                    writable: false,
                    configurable: false,
                });
            } catch (e) {
                window.webkitRTCPeerConnection = WrappedRTC;
            }
        }
    })();

    // =========================================================================
    // 6. AUTOMATION DETECTION PREVENTION
    // =========================================================================
    (function hideAutomation() {
        // Remove webdriver flag that Chrome sets when using --enable-automation
        try {
            Object.defineProperty(navigator, 'webdriver', {
                get: function () { return false; },
                configurable: false,
            });
        } catch (e) { /* already defined */ }

        // Remove Puppeteer/Playwright indicators
        try { delete window.__playwright; } catch (e) { /* */ }
        try { delete window.__pw_manual; } catch (e) { /* */ }
        try { delete window.__PW_inspect; } catch (e) { /* */ }
    })();

})();
