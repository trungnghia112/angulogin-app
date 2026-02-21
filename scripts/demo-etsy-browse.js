#!/usr/bin/env node
/**
 * Demo: Real E2E Automation — Browse Goods on Etsy
 *
 * This script proves the ENTIRE automation pipeline works end-to-end:
 * API → launch browser → CDP → template execution → real website interaction
 *
 * Usage: node scripts/demo-etsy-browse.js
 * Requires: Tauri app running (npm run tauri dev)
 */

const fs = require('fs');
const path = require('path');

// --- Config ---
const API_BASE = 'http://127.0.0.1:50200';
const API_KEY = (() => {
    try {
        const cfgPath = path.join(require('os').homedir(), 'Library', 'Application Support', 'AnguLogin', 'api_config.json');
        const key = JSON.parse(fs.readFileSync(cfgPath, 'utf8')).api_key;
        console.log(`🔑 API Key: ${key.slice(0, 15)}...`);
        return key;
    } catch (e) {
        console.error('❌ Cannot read API key:', e.message);
        process.exit(1);
    }
})();

// --- Etsy Browse Template (from marketplace) ---
const ETSY_TEMPLATE = {
    steps: [
        {
            action: "navigate",
            url: "https://www.etsy.com",
            description: "Open Etsy homepage",
            waitForSelector: ".listing-card, .v2-listing-card, [data-listing-id], a[href*='/listing/']",
            timeout: 15000,
            humanDelay: [3000, 5000]
        },
        {
            action: "scroll",
            description: "Scroll down to browse product categories",
            iterations: 4,
            humanDelay: [2000, 4000]
        },
        {
            action: "click",
            description: "Click on a random product listing",
            jsExpression: `(() => {
                const cards = document.querySelectorAll('.listing-card a.listing-link, .v2-listing-card a, [data-listing-id] a, a[href*="/listing/"]');
                const count = Math.min(cards.length, 3);
                if (count > 0) {
                    const idx = Math.floor(Math.random() * count);
                    cards[idx]?.click();
                    return 'clicked product ' + idx + ' of ' + cards.length;
                }
                return 'no products found';
            })()`,
            humanDelay: [4000, 7000]
        },
        {
            action: "wait",
            waitMs: 3000,
            description: "Wait for product page to load",
            humanDelay: [1000, 2000]
        },
        {
            action: "scroll",
            description: "Scroll through product detail page",
            iterations: 3,
            humanDelay: [2000, 4000]
        },
        {
            action: "scroll",
            description: "Scroll to reviews section",
            jsExpression: `(() => {
                const reviewSection = document.querySelector('#reviews, [data-appears-component-name="Reviews"]');
                if (reviewSection) {
                    reviewSection.scrollIntoView({ behavior: 'smooth' });
                    return 'scrolled to reviews';
                }
                window.scrollBy({ top: 600, behavior: 'smooth' });
                return 'scrolled down';
            })()`,
            humanDelay: [3000, 5000]
        }
    ],
    variables: {
        browseCount: 3
    }
};

// --- HTTP Helper ---
async function api(method, endpoint, body) {
    const url = `${API_BASE}${endpoint}`;
    const opts = {
        method,
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        }
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(url, opts);
    return resp.json();
}

// --- Main Demo ---
async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  🛍️  Real E2E: Browse Goods on Etsy                     ║');
    console.log('║  Template from AnguLogin Marketplace                    ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // Step 0: Check API
    console.log('🔍  Step 0: Verify API server');
    console.log('────────────────────────────────────────────────────────────');
    const status = await api('GET', '/api/v1/status');
    if (status.code !== 0) { console.error('   ❌ API offline'); process.exit(1); }
    console.log('   ✅ API online — v' + status.data.version + '\n');

    // Step 1: List profiles, pick the first one
    console.log('📋  Step 1: Select a profile');
    console.log('────────────────────────────────────────────────────────────');
    const profiles = await api('GET', '/api/v1/profile/list');
    if (!profiles.data?.length) { console.error('   ❌ No profiles'); process.exit(1); }
    const profile = profiles.data.find(p => p.status === 'stopped') || profiles.data[0];
    console.log(`   → Using profile: "${profile.name}" (${profile.status})\n`);

    // Step 2: Launch browser
    console.log('🚀  Step 2: Launch browser for profile');
    console.log('────────────────────────────────────────────────────────────');
    const launch = await api('GET', `/api/v1/browser/open?profile_id=${encodeURIComponent(profile.name)}&browser=chrome`);
    if (launch.code !== 0) { console.error('   ❌ Launch failed:', launch.msg); process.exit(1); }
    console.log(`   ✅ Browser launched! Debug port: ${launch.data.debug_port}`);
    console.log('   ⏳ Waiting 5s for browser to initialize...\n');
    await new Promise(r => setTimeout(r, 5000));

    // Step 3: Execute the Etsy template
    console.log('🤖  Step 3: Execute "Browse Goods on Etsy" template');
    console.log('────────────────────────────────────────────────────────────');
    console.log('   Steps:');
    ETSY_TEMPLATE.steps.forEach((s, i) => console.log(`     ${i + 1}. ${s.description}`));
    console.log('');

    const exec = await api('POST', '/api/v1/automation/execute', {
        profile_id: profile.name,
        steps: ETSY_TEMPLATE.steps,
        variables: ETSY_TEMPLATE.variables,
    });

    if (exec.code !== 0) { console.error('   ❌ Execute failed:', exec.msg); process.exit(1); }
    const taskId = exec.data.task_id;
    console.log(`   ✅ Task created: ${taskId}\n`);

    // Step 4: Monitor progress
    console.log('📊  Step 4: Monitor execution');
    console.log('────────────────────────────────────────────────────────────');
    let finalStatus = 'running';
    while (finalStatus === 'running') {
        await new Promise(r => setTimeout(r, 3000));
        const task = await api('GET', `/api/v1/automation/task?task_id=${taskId}`);
        if (task.data) {
            const { status, completed_steps, total_steps, logs } = task.data;
            console.log(`   [${completed_steps}/${total_steps}] ${status}`);

            // Print new logs
            if (logs?.length > 0) {
                const last = logs[logs.length - 1];
                console.log(`     └─ ${last.message}`);
            }
            finalStatus = status;
        }
    }

    console.log('');
    if (finalStatus === 'completed') {
        console.log('   🎉 Template executed successfully!');
    } else {
        console.log(`   ⚠️ Task ended with status: ${finalStatus}`);
    }

    // Step 5: Show final task details
    console.log('\n📝  Step 5: Execution log');
    console.log('────────────────────────────────────────────────────────────');
    const final_ = await api('GET', `/api/v1/automation/task?task_id=${taskId}`);
    if (final_.data?.logs) {
        for (const log of final_.data.logs) {
            const icon = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : '✅';
            console.log(`   ${icon} Step ${log.step}: ${log.message}`);
        }
    }

    // Step 6: Close browser
    console.log('\n🛑  Step 6: Close browser');
    console.log('────────────────────────────────────────────────────────────');
    const close = await api('GET', `/api/v1/browser/close?profile_id=${encodeURIComponent(profile.name)}`);
    console.log(`   ${close.code === 0 ? '✅' : '❌'} ${close.msg}\n`);

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  ✅ E2E Test Complete!                                   ║');
    console.log('║                                                          ║');
    console.log('║  Browser tự động:                                       ║');
    console.log('║  • Mở etsy.com                                          ║');
    console.log('║  • Scroll browse sản phẩm                               ║');
    console.log('║  • Click vào 1 sản phẩm ngẫu nhiên                     ║');
    console.log('║  • Xem chi tiết + reviews                               ║');
    console.log('║  → Tất cả qua REST API, không cần mở UI!               ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
}

main().catch(err => {
    console.error('💥 Error:', err.message || err);
    process.exit(1);
});
