#!/usr/bin/env node
/**
 * Test All RPA Marketplace Templates
 *
 * Runs each of the 15 marketplace templates end-to-end via the REST API.
 * - No-login templates: full execution
 * - Login-required templates: tests navigate + available steps
 *
 * Usage: node scripts/test-all-templates.js
 * Requires: Tauri app running (npm run tauri dev)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// --- Config ---
const API_BASE = 'http://127.0.0.1:50200';
const configPath = path.join(os.homedir(), 'Library', 'Application Support', 'AnguLogin', 'api_config.json');
let API_KEY;
try {
    API_KEY = JSON.parse(fs.readFileSync(configPath, 'utf8')).api_key;
} catch (e) {
    console.error('Cannot read API key:', e.message);
    process.exit(1);
}

// Load templates
const TEMPLATES = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../src/assets/rpa-templates/templates.json'), 'utf8')
);

// Default variable values for testing
const TEST_VARIABLES = {
    'tiktok-search-like': { searchText: 'cute cats', viewVideoCount: 2, CommentLikes: 1, likeRate: 5 },
    'fb-group-exit': { groupUrls: 'https://www.facebook.com/groups/test' },
    'fb-group-search-join': { searchKeyword: 'tech community', joinCount: 1 },
    'x-like-ai-comment': { scrollCount: 2, likeRate: 3, commentRate: 1 },
    'fb-friends-counter': {},
    'ig-auto-follow': { hashtags: 'photography', followCount: 1, delaySeconds: 2 },
    'amazon-review-scraper': { productUrl: 'https://www.amazon.com/dp/B0CHX3QBCH', maxPages: 1 },
    'shopee-browse-products': { searchKeywords: 'phone case', browseCount: 2 },
    'linkedin-connect': { searchQuery: 'software engineer', connectCount: 1, noteTemplate: 'Hi, I would like to connect!' },
    'reddit-upvote-comment': { subreddits: 'r/programming', comments: 'Great post!', upvoteRate: 5 },
    'youtube-watch-subscribe': { searchKeywords: 'coding tutorial', watchDuration: 5, subscribeRate: 3 },
    'gmail-send-bulk': { recipients: 'test@example.com', subject: 'Test', bodyTemplate: 'Hello', delaySeconds: 2 },
    'etsy-browse-goods': { browseCount: 2 },
    'fb-add-friends': { addCount: 1 },
    'poshmark-share-listings': { maxShares: 1 }
};

// --- HTTP Helper ---
async function api(method, endpoint, body) {
    const opts = {
        method,
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(`${API_BASE}${endpoint}`, opts);
    return resp.json();
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Force kill all Chrome processes and wait for cleanup
async function forceKillChrome() {
    const { execSync } = require('child_process');
    try { execSync('pkill -9 -f "Google Chrome"', { stdio: 'ignore' }); } catch { }
    // Wait for process cleanup and lock file release
    await sleep(4000);
}

// --- Test a single template ---
async function testTemplate(template, profileName) {
    const id = template.id;
    const title = template.metadata.title;
    const requiresLogin = template.requirements?.note?.toLowerCase().includes('login') ||
        template.requirements?.note?.toLowerCase().includes('requires');
    const stepCount = template.steps.length;
    const variables = TEST_VARIABLES[id] || {};

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`  ID: ${id} | Steps: ${stepCount} | Login: ${requiresLogin ? 'YES' : 'NO'}`);
    console.log(`${'═'.repeat(60)}`);

    // Launch browser
    const launch = await api('GET', `/api/v1/browser/open?profile_id=${encodeURIComponent(profileName)}&browser=chrome`);
    if (launch.code !== 0) {
        console.log(`  ❌ FAIL: Cannot launch browser: ${launch.msg}`);
        return { id, title, status: 'FAIL', reason: 'browser launch failed' };
    }
    console.log(`  🚀 Browser launched (port ${launch.data.debug_port})`);
    await sleep(4000);

    // Execute template
    const exec = await api('POST', '/api/v1/automation/execute', {
        profile_id: profileName,
        steps: template.steps,
        variables
    });

    if (exec.code !== 0) {
        console.log(`  ❌ FAIL: Execute failed: ${exec.msg}`);
        await api('GET', `/api/v1/browser/close?profile_id=${encodeURIComponent(profileName)}`);
        return { id, title, status: 'FAIL', reason: exec.msg };
    }

    const taskId = exec.data.task_id;
    console.log(`  🤖 Task: ${taskId}`);

    // Monitor with timeout (max 90s per template)
    const deadline = Date.now() + 90000;
    let finalStatus = 'running';
    let lastLog = '';
    while (finalStatus === 'running' && Date.now() < deadline) {
        await sleep(3000);
        const task = await api('GET', `/api/v1/automation/task?task_id=${taskId}`);
        if (task.data) {
            finalStatus = task.data.status;
            if (task.data.logs?.length > 0) {
                const log = task.data.logs[task.data.logs.length - 1];
                if (log.message !== lastLog) {
                    lastLog = log.message;
                    const icon = log.level === 'error' ? '❌' : '✅';
                    console.log(`  ${icon} ${log.message}`);
                }
            }
        }
    }

    if (finalStatus === 'running') {
        finalStatus = 'timeout';
        console.log(`  ⏰ Timed out after 90s`);
    }

    // Get full logs
    const final_ = await api('GET', `/api/v1/automation/task?task_id=${taskId}`);
    const logs = final_.data?.logs || [];
    const errors = logs.filter(l => l.level === 'error');
    const completedSteps = logs.filter(l => l.level === 'info' && l.message.startsWith('Step')).length;

    // Close browser and force-kill Chrome
    await sleep(1000);
    await api('GET', `/api/v1/browser/close?profile_id=${encodeURIComponent(profileName)}`);
    await forceKillChrome();
    console.log(`  🛑 Browser closed`);

    const result = {
        id, title,
        status: finalStatus === 'completed' ? 'PASS' : finalStatus,
        completedSteps,
        totalSteps: stepCount,
        errors: errors.map(e => e.message),
        requiresLogin
    };

    const emoji = result.status === 'PASS' ? '✅' : result.status === 'timeout' ? '⏰' : '❌';
    console.log(`  ${emoji} Result: ${result.status} (${completedSteps}/${stepCount} steps)`);

    return result;
}

// --- Main ---
async function main() {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  🧪 Testing ALL 15 Marketplace RPA Templates             ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');

    // Check API
    const status = await api('GET', '/api/v1/status');
    if (status.code !== 0) { console.error('❌ API offline'); process.exit(1); }
    console.log(`✅ API online — v${status.data.version}`);

    // Get a profile
    const profiles = await api('GET', '/api/v1/profile/list');
    if (!profiles.data?.length) { console.error('❌ No profiles'); process.exit(1); }
    const profile = profiles.data.find(p => p.status === 'stopped') || profiles.data[0];
    console.log(`📋 Using profile: "${profile.name}"`);
    console.log(`📊 Templates to test: ${TEMPLATES.length}\n`);

    // Test each template
    const results = [];
    for (const tmpl of TEMPLATES) {
        const result = await testTemplate(tmpl, profile.name);
        results.push(result);
    }

    // Summary
    console.log('\n\n' + '═'.repeat(60));
    console.log('  📊 TEST RESULTS SUMMARY');
    console.log('═'.repeat(60));

    const passed = results.filter(r => r.status === 'PASS');
    const failed = results.filter(r => r.status !== 'PASS' && r.status !== 'timeout');
    const timedOut = results.filter(r => r.status === 'timeout');

    console.log(`\n  ✅ PASS: ${passed.length}/${results.length}`);
    console.log(`  ❌ FAIL: ${failed.length}/${results.length}`);
    console.log(`  ⏰ TIMEOUT: ${timedOut.length}/${results.length}\n`);

    console.log('  Template                          │ Steps │ Login │ Result');
    console.log('  ──────────────────────────────────┼───────┼───────┼───────');
    for (const r of results) {
        const name = r.title.padEnd(34);
        const steps = `${r.completedSteps}/${r.totalSteps}`.padEnd(5);
        const login = r.requiresLogin ? 'Yes' : 'No ';
        const emoji = r.status === 'PASS' ? '✅' : r.status === 'timeout' ? '⏰' : '❌';
        console.log(`  ${name} │ ${steps} │ ${login}   │ ${emoji} ${r.status}`);
    }

    if (failed.length > 0) {
        console.log('\n  🔍 FAILED DETAILS:');
        for (const r of failed) {
            console.log(`\n  ❌ ${r.title}:`);
            r.errors.forEach(e => console.log(`     └─ ${e}`));
        }
    }

    console.log('\n' + '═'.repeat(60));
}

main().catch(err => {
    console.error('Fatal:', err.message || err);
    process.exit(1);
});
