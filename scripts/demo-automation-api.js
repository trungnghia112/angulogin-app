#!/usr/bin/env node
/**
 * AnguLogin Automation API — Demo Script
 * 
 * Kịch bản thực tế: "Auto check giá sản phẩm trên nhiều profile"
 * 
 * Use case: Bạn quản lý 50 profiles shop (mỗi profile = 1 tài khoản)
 * Muốn tự động mở từng profile, vào trang sản phẩm, scroll xem giá,
 * rồi đóng lại. Không cần ngồi click tay 50 lần.
 * 
 * Flow:
 *   1. Gọi API mở profile → browser mở lên
 *   2. Gọi API lấy CDP URL → để theo dõi
 *   3. Gọi API chạy automation steps → navigate, type, scroll...
 *   4. Theo dõi task status → xem tiến độ
 *   5. Đóng browser
 */

const API_BASE = 'http://localhost:50200';
let API_KEY = ''; // Will be auto-detected

// ---- Helpers ----
async function api(method, path, body) {
    const opts = {
        method,
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
        },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    return res.json();
}

function logStep(emoji, msg) {
    console.log(`\n${emoji}  ${msg}`);
    console.log('─'.repeat(60));
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ---- Main Demo ----
async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  AnguLogin Automation API — Live Demo                   ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    // Step 0: Check API server
    logStep('🔍', 'Step 0: Check API server status');
    try {
        const status = await api('GET', '/api/v1/status');
        console.log('   API Response:', JSON.stringify(status, null, 2));
        if (status.code !== 0) {
            console.log('\n❌ API server is not responding correctly.');
            console.log('   Make sure the AnguLogin app is running!');
            process.exit(1);
        }
        console.log('   ✅ API server is online!');
    } catch (e) {
        console.log('\n❌ Cannot connect to API server at', API_BASE);
        console.log('   Make sure the AnguLogin app is running!');
        console.log('   Error:', e.message);
        process.exit(1);
    }

    // Step 1: List profiles
    logStep('📋', 'Step 1: List available profiles');
    const profiles = await api('GET', '/api/v1/profile/list');
    if (!profiles.data || profiles.data.length === 0) {
        console.log('   No profiles found. Create some in the app first.');
        process.exit(1);
    }
    console.log(`   Found ${profiles.data.length} profiles:`);
    profiles.data.slice(0, 5).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} (${p.status}) ${p.group ? `[${p.group}]` : ''}`);
    });

    // Pick first stopped profile
    const profile = profiles.data.find(p => p.status === 'stopped') || profiles.data[0];
    console.log(`\n   → Using profile: "${profile.name}"`);

    // Step 2: Open browser
    logStep('🚀', `Step 2: Launch browser for "${profile.name}"`);
    const openRes = await api('GET', `/api/v1/browser/open?profile_id=${encodeURIComponent(profile.name)}&browser=chrome`);
    console.log('   Response:', JSON.stringify(openRes, null, 2));

    if (openRes.code !== 0) {
        console.log('   ❌ Failed to open browser:', openRes.msg);
        process.exit(1);
    }
    console.log('   ✅ Browser launched! Debug port:', openRes.data.debug_port);

    // Wait for browser to fully start
    console.log('   ⏳ Waiting 5s for browser to initialize...');
    await sleep(5000);

    // Step 3: Get CDP info
    logStep('🔌', 'Step 3: Get CDP WebSocket URL');
    const cdpRes = await api('GET', `/api/v1/browser/cdp?profile_id=${encodeURIComponent(profile.name)}`);
    console.log('   CDP Info:', JSON.stringify(cdpRes.data, null, 2));

    if (cdpRes.data?.ws_endpoint) {
        console.log('\n   🎯 Puppeteer connection code:');
        console.log(`   const browser = await puppeteer.connect({`);
        console.log(`     browserWSEndpoint: "${cdpRes.data.ws_endpoint}"`);
        console.log(`   });`);
    }

    // Step 4: Execute automation
    logStep('🤖', 'Step 4: Execute automation steps');
    const execRes = await api('POST', '/api/v1/automation/execute', {
        profile_id: profile.name,
        steps: [
            {
                action: 'navigate',
                url: 'https://www.google.com',
                description: 'Navigate to Google',
            },
            {
                action: 'wait',
                waitMs: 2000,
                description: 'Wait for page load',
            },
            {
                action: 'evaluate',
                jsExpression: 'document.title',
                description: 'Get page title',
            },
            {
                action: 'navigate',
                url: 'https://news.ycombinator.com',
                description: 'Navigate to Hacker News',
            },
            {
                action: 'wait',
                waitMs: 2000,
                description: 'Wait for page load',
            },
            {
                action: 'scroll',
                iterations: 2,
                description: 'Scroll down to see more articles',
            },
        ],
        variables: {},
    });
    console.log('   Task created:', JSON.stringify(execRes.data, null, 2));
    const taskId = execRes.data?.task_id;

    if (!taskId) {
        console.log('   ❌ Failed to create task');
    } else {
        // Step 5: Monitor task
        logStep('📊', 'Step 5: Monitor task progress');
        let done = false;
        for (let i = 0; i < 30 && !done; i++) {
            await sleep(2000);
            const taskRes = await api('GET', `/api/v1/automation/task?task_id=${taskId}`);
            const task = taskRes.data;
            if (task) {
                const progress = `${task.current_step}/${task.total_steps}`;
                console.log(`   [${progress}] Status: ${task.status}`);

                if (task.status !== 'running') {
                    done = true;
                    console.log('\n   Task result:', task.status);
                    if (task.logs?.length > 0) {
                        console.log('   Logs:');
                        task.logs.forEach(log => {
                            console.log(`     [${log.level}] Step ${log.step}: ${log.message}`);
                        });
                    }
                    if (task.error) {
                        console.log('   Error:', task.error);
                    }
                }
            }
        }
    }

    // Step 6: Close browser
    logStep('🛑', 'Step 6: Close browser');
    const closeRes = await api('GET', `/api/v1/browser/close?profile_id=${encodeURIComponent(profile.name)}`);
    console.log('   Response:', JSON.stringify(closeRes, null, 2));

    // Summary
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  Demo Complete!                                         ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║  Kịch bản ứng dụng thực tế:                            ║');
    console.log('║  • Chạy script này cho 50 profiles → automation hàng    ║');
    console.log('║    loạt mà không cần mở app, click tay                  ║');
    console.log('║  • Tích hợp với n8n/Make.com workflow                   ║');
    console.log('║  • Cron job chạy hàng ngày: check giá, post bài, like   ║');
    console.log('║  • Connect Puppeteer/Playwright cho automation phức tạp ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
}

// ---- Run ----
// Read API key from config
const fs = require('fs');
const path = require('path');
const os = require('os');

const configPath = path.join(os.homedir(), 'Library', 'Application Support', 'AnguLogin', 'api_config.json');
try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    API_KEY = config.api_key;
    console.log('🔑 API Key loaded from config:', API_KEY.substring(0, 15) + '...');
} catch {
    console.log('⚠️  Could not read API key from', configPath);
    console.log('   Set API_KEY manually or make sure AnguLogin has been run at least once.');
    process.exit(1);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
