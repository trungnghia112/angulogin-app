import { Injectable, signal } from '@angular/core';
import { debugLog } from '../core/utils/logger.util';

export interface GeoIpInfo {
    country: string;       // e.g., "US"
    countryName: string;   // e.g., "United States"
    city?: string;         // e.g., "New York"
}

@Injectable({ providedIn: 'root' })
export class GeoIpService {
    // Cache: host -> GeoIpInfo (persists while app is open)
    private readonly cache = new Map<string, GeoIpInfo | null>();
    // Track inflight requests to avoid duplicates
    private readonly inflight = new Map<string, Promise<GeoIpInfo | null>>();

    // Reactive lookup results map (host -> GeoIpInfo)
    readonly lookupResults = signal<Map<string, GeoIpInfo | null>>(new Map());

    /**
     * Get the 2-letter country code flag emoji for a given IP or hostname.
     * Returns cached result immediately or triggers a lookup.
     */
    getFlagEmoji(countryCode: string): string {
        if (!countryCode || countryCode.length !== 2) return '';
        const code = countryCode.toUpperCase();
        const offset = 0x1F1E6 - 65; // 'A' = 65
        return String.fromCodePoint(
            code.charCodeAt(0) + offset,
            code.charCodeAt(1) + offset
        );
    }

    /**
     * Async lookup with deduplication and caching.
     */
    async lookupAsync(host: string): Promise<GeoIpInfo | null> {
        if (!host) return null;

        // Return cached
        const cached = this.cache.get(host);
        if (cached !== undefined) return cached;

        // Return inflight
        const existing = this.inflight.get(host);
        if (existing) return existing;

        // Start lookup
        const promise = this.fetchGeoIp(host);
        this.inflight.set(host, promise);

        try {
            const result = await promise;
            this.cache.set(host, result);

            // Update reactive signal
            this.lookupResults.update(map => {
                const newMap = new Map(map);
                newMap.set(host, result);
                return newMap;
            });

            return result;
        } finally {
            this.inflight.delete(host);
        }
    }

    /**
     * Batch lookup multiple hosts at once.
     * Includes inter-batch delay to respect ip-api.com rate limit (45 req/min).
     */
    async batchLookup(hosts: string[]): Promise<void> {
        const unique = [...new Set(hosts)].filter(h => h && !this.cache.has(h));
        if (unique.length === 0) return;

        // Process in parallel, max 5 concurrent, with rate-limit delay
        const batchSize = 5;
        for (let i = 0; i < unique.length; i += batchSize) {
            const batch = unique.slice(i, i + batchSize);
            await Promise.allSettled(batch.map(h => this.lookupAsync(h)));
            // Throttle: wait 1.5s between batches (45 req/min = ~1.3s/req)
            if (i + batchSize < unique.length) {
                await new Promise(r => setTimeout(r, 1500));
            }
        }
    }

    private async fetchGeoIp(host: string): Promise<GeoIpInfo | null> {
        try {
            // ipwhois.app: free tier with HTTPS, no key needed, 10k req/month
            const response = await fetch(
                `https://ipwhois.app/json/${encodeURIComponent(host)}?objects=country_code,country,city,success,message`
            );
            if (!response.ok) return null;

            const data = await response.json();
            if (data.success !== false) {
                return {
                    country: data.country_code,
                    countryName: data.country,
                    city: data.city || undefined,
                };
            }
            debugLog(`GeoIP lookup failed for ${host}:`, data.message);
            return null;
        } catch (e) {
            debugLog(`GeoIP fetch error for ${host}:`, e);
            return null;
        }
    }

    /**
     * Extract host from a proxy string like "socks5://1.2.3.4:1080"
     * Also handles auth-embedded URLs like "socks5://user:pass@1.2.3.4:1080"
     */
    extractHost(proxyStr: string): string {
        if (!proxyStr) return '';
        try {
            const match = proxyStr.match(/^(?:https?|socks[45]):\/\/(?:[^@]+@)?([^:]+):(\d+)$/);
            return match ? match[1] : proxyStr;
        } catch {
            return proxyStr;
        }
    }
}
