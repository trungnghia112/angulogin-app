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
 *   6. Permissions API (notifications → denied)
 */
(function () {
    'use strict';

    // --- Config ---
    // Injected by Tauri at launch: window.__stealth_config__
    // Fallback to empty config if not injected (extension loaded manually)
    const CFG = (typeof window.__stealth_config__ !== 'undefined')
        ? window.__stealth_config__
        : null;

    if (!CFG) {
        // No config injected — skip spoofing
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
    // 1. CANVAS SPOOFING
    // =========================================================================
    (function spoofCanvas() {
        const canvasSeed = SEED ^ 0xCAFE;
        const canvasRng = mulberry32(canvasSeed);

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

        // Override HTMLCanvasElement.toDataURL
        wrapMethod(HTMLCanvasElement.prototype, 'toDataURL', function (original) {
            return function () {
                const ctx = this.getContext('2d');
                if (ctx) {
                    try {
                        const imageData = ctx.getImageData(0, 0, this.width, this.height);
                        addNoiseToImageData(imageData);
                        ctx.putImageData(imageData, 0, 0);
                    } catch (e) {
                        // Cross-origin canvas or other error
                    }
                }
                return original.apply(this, arguments);
            };
        });

        // Override HTMLCanvasElement.toBlob
        wrapMethod(HTMLCanvasElement.prototype, 'toBlob', function (original) {
            return function () {
                const ctx = this.getContext('2d');
                if (ctx) {
                    try {
                        const imageData = ctx.getImageData(0, 0, this.width, this.height);
                        addNoiseToImageData(imageData);
                        ctx.putImageData(imageData, 0, 0);
                    } catch (e) {
                        // Cross-origin canvas
                    }
                }
                return original.apply(this, arguments);
            };
        });

        // Override CanvasRenderingContext2D.getImageData
        wrapMethod(CanvasRenderingContext2D.prototype, 'getImageData', function (original) {
            return function () {
                const imageData = original.apply(this, arguments);
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

        const vendor = CFG.webgl.vendor;
        const renderer = CFG.webgl.renderer;
        const UNMASKED_VENDOR = 0x9245;  // UNMASKED_VENDOR_WEBGL
        const UNMASKED_RENDERER = 0x9246; // UNMASKED_RENDERER_WEBGL

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

        const nav = CFG.navigator;

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
            defineProperty(navigator, 'languages', Object.freeze(nav.languages));
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

        const scr = CFG.screen;

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

        // Also override outerWidth/outerHeight/innerWidth/innerHeight
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
        const OriginalRTC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
        if (!OriginalRTC) return;

        const WrappedRTC = function (config, constraints) {
            // Force relay-only ICE transport to prevent local IP exposure
            if (config && config.iceServers) {
                config.iceTransportPolicy = 'relay';
            } else if (!config) {
                config = { iceTransportPolicy: 'relay' };
            } else {
                config.iceTransportPolicy = 'relay';
            }
            return new OriginalRTC(config, constraints);
        };

        WrappedRTC.prototype = OriginalRTC.prototype;
        WrappedRTC.generateCertificate = OriginalRTC.generateCertificate;

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
    // 6. PERMISSIONS API SPOOFING
    // =========================================================================
    (function spoofPermissions() {
        if (!navigator.permissions) return;

        wrapMethod(navigator.permissions, 'query', function (original) {
            return function (descriptor) {
                // Return 'denied' for notifications to avoid fingerprinting via permission status
                if (descriptor && descriptor.name === 'notifications') {
                    return Promise.resolve({ state: 'denied', onchange: null });
                }
                return original.call(this, descriptor);
            };
        });
    })();

    // =========================================================================
    // 7. AUTOMATION DETECTION PREVENTION
    // =========================================================================
    (function hideAutomation() {
        // Remove webdriver flag that Chrome sets when using --enable-automation
        try {
            Object.defineProperty(navigator, 'webdriver', {
                get: function () { return false; },
                configurable: false,
            });
        } catch (e) { /* already defined */ }

        // Remove Chrome automation-related properties
        if (window.chrome) {
            // Ensure chrome.runtime exists (extensions have it, automation might remove it)
            if (!window.chrome.runtime) {
                window.chrome.runtime = {};
            }
        }

        // Remove Puppeteer/Playwright indicators
        delete window.__playwright;
        delete window.__pw_manual;
        delete window.__PW_inspect;
    })();

    // --- Cleanup: remove config from window ---
    try {
        delete window.__stealth_config__;
    } catch (e) { /* non-configurable */ }

})();
