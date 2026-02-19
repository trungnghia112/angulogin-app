import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TabsModule } from 'primeng/tabs';
import { MessageService } from 'primeng/api';

// Services
import { ApiSettingsService } from '../../../services/api-settings.service';

interface ApiEndpoint {
    method: 'GET' | 'POST';
    path: string;
    description: string;
    auth: boolean;
    params: { name: string; type: string; required: boolean; description: string }[];
    exampleBody: string | null;
    exampleResponse: string;
}

@Component({
    selector: 'app-automation',
    templateUrl: './automation.html',
    styleUrl: './automation.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        TooltipModule,
        TabsModule,
    ],
})
export class Automation implements OnInit {
    protected readonly api = inject(ApiSettingsService);
    private readonly messageService = inject(MessageService);

    protected readonly expandedIndex = signal<number | null>(null);
    protected readonly tryResult = signal<string>('');
    protected readonly tryLoading = signal(false);
    protected readonly tryStatus = signal<number | null>(null);
    protected readonly apiOnline = signal<boolean | null>(null);

    protected readonly endpoints: ApiEndpoint[] = [
        {
            method: 'GET', path: '/api/v1/status',
            description: 'Health check — returns API version and status.',
            auth: false,
            params: [],
            exampleBody: null,
            exampleResponse: '{\n  "code": 0,\n  "msg": "success",\n  "data": {\n    "version": "0.1.0",\n    "api_version": "v1"\n  }\n}',
        },
        {
            method: 'GET', path: '/api/v1/browser/open',
            description: 'Launch a browser profile and return the CDP debug port.',
            auth: true,
            params: [
                { name: 'profile_id', type: 'string', required: true, description: 'The profile folder name' },
                { name: 'open_url', type: 'string', required: false, description: 'URL to open on launch' },
            ],
            exampleBody: null,
            exampleResponse: '{\n  "code": 0,\n  "msg": "success",\n  "data": {\n    "profile_id": "Shop_001",\n    "debug_port": 51000,\n    "ws_endpoint": "ws://127.0.0.1:51000"\n  }\n}',
        },
        {
            method: 'GET', path: '/api/v1/browser/close',
            description: 'Close the running browser for a profile.',
            auth: true,
            params: [
                { name: 'profile_id', type: 'string', required: true, description: 'The profile folder name' },
            ],
            exampleBody: null,
            exampleResponse: '{\n  "code": 0,\n  "msg": "success",\n  "data": { "msg": "Browser closed" }\n}',
        },
        {
            method: 'GET', path: '/api/v1/browser/status',
            description: 'Check if a profile\'s browser is currently running.',
            auth: true,
            params: [
                { name: 'profile_id', type: 'string', required: true, description: 'The profile folder name' },
            ],
            exampleBody: null,
            exampleResponse: '{\n  "code": 0,\n  "msg": "success",\n  "data": { "status": "Active" }\n}',
        },
        {
            method: 'GET', path: '/api/v1/browser/active',
            description: 'List all currently running browser instances.',
            auth: true,
            params: [],
            exampleBody: null,
            exampleResponse: '{\n  "code": 0,\n  "msg": "success",\n  "data": {\n    "list": [\n      { "profile_id": "Shop_001", "debug_port": 51000 }\n    ]\n  }\n}',
        },
        {
            method: 'GET', path: '/api/v1/profile/list',
            description: 'List all profiles with metadata.',
            auth: true,
            params: [],
            exampleBody: null,
            exampleResponse: '{\n  "code": 0,\n  "msg": "success",\n  "data": [\n    {\n      "profile_id": "Shop_001",\n      "name": "Shop_001",\n      "group": "ecommerce",\n      "isRunning": false\n    }\n  ]\n}',
        },
        {
            method: 'GET', path: '/api/v1/profile/detail',
            description: 'Get detailed info for a single profile.',
            auth: true,
            params: [
                { name: 'profile_id', type: 'string', required: true, description: 'The profile folder name' },
            ],
            exampleBody: null,
            exampleResponse: '{\n  "code": 0,\n  "msg": "success",\n  "data": {\n    "name": "Shop_001",\n    "path": "/path/to/Shop_001",\n    "metadata": { "group": "ecommerce", "proxy": null },\n    "isRunning": false\n  }\n}',
        },
        {
            method: 'POST', path: '/api/v1/profile/create',
            description: 'Create a new browser profile.',
            auth: true,
            params: [
                { name: 'name', type: 'string', required: true, description: 'Profile name (becomes folder name)' },
                { name: 'group_id', type: 'string', required: false, description: 'Group to assign' },
            ],
            exampleBody: '{\n  "name": "NewProfile",\n  "group_id": "work"\n}',
            exampleResponse: '{\n  "code": 0,\n  "msg": "success",\n  "data": {\n    "profile_id": "NewProfile",\n    "profile_path": "/path/to/NewProfile"\n  }\n}',
        },
        {
            method: 'POST', path: '/api/v1/profile/update',
            description: 'Update profile metadata.',
            auth: true,
            params: [
                { name: 'profile_id', type: 'string', required: true, description: 'Profile to update' },
                { name: 'group', type: 'string', required: false, description: 'New group name' },
            ],
            exampleBody: '{\n  "profile_id": "Shop_001",\n  "group": "new-group"\n}',
            exampleResponse: '{\n  "code": 0,\n  "msg": "success",\n  "data": { "msg": "Profile updated" }\n}',
        },
        {
            method: 'POST', path: '/api/v1/profile/delete',
            description: 'Delete a profile and its data folder.',
            auth: true,
            params: [
                { name: 'profile_id', type: 'string', required: true, description: 'Profile to delete' },
            ],
            exampleBody: '{\n  "profile_id": "OldProfile"\n}',
            exampleResponse: '{\n  "code": 0,\n  "msg": "success",\n  "data": {\n    "msg": "Profile deleted",\n    "profile_id": "OldProfile"\n  }\n}',
        },
        // --- Proxy Endpoints ---
        {
            method: 'GET', path: '/api/v1/proxy/list',
            description: 'List all configured proxies.',
            auth: true,
            params: [],
            exampleBody: null,
            exampleResponse: '{\n  "code": 0,\n  "msg": "success",\n  "data": [\n    {\n      "id": "proxy-abc123",\n      "name": "US Proxy",\n      "host": "1.2.3.4",\n      "port": 8080,\n      "type": "http",\n      "isAlive": true\n    }\n  ]\n}',
        },
        {
            method: 'POST', path: '/api/v1/proxy/add',
            description: 'Add a new proxy.',
            auth: true,
            params: [
                { name: 'host', type: 'string', required: true, description: 'Proxy host/IP' },
                { name: 'port', type: 'number', required: true, description: 'Proxy port' },
                { name: 'type', type: 'string', required: false, description: 'http | socks4 | socks5' },
                { name: 'username', type: 'string', required: false, description: 'Auth username' },
                { name: 'password', type: 'string', required: false, description: 'Auth password' },
            ],
            exampleBody: '{\n  "host": "1.2.3.4",\n  "port": 8080,\n  "type": "http",\n  "group": "us-proxies"\n}',
            exampleResponse: '{\n  "code": 0,\n  "msg": "success",\n  "data": {\n    "id": "proxy-abc123",\n    "name": "1.2.3.4:8080",\n    "host": "1.2.3.4",\n    "port": 8080\n  }\n}',
        },
        {
            method: 'POST', path: '/api/v1/proxy/delete',
            description: 'Delete a proxy by ID.',
            auth: true,
            params: [
                { name: 'id', type: 'string', required: true, description: 'Proxy ID' },
            ],
            exampleBody: '{\n  "id": "proxy-abc123"\n}',
            exampleResponse: '{\n  "code": 0,\n  "msg": "success",\n  "data": { "msg": "Proxy deleted" }\n}',
        },
        {
            method: 'GET', path: '/api/v1/proxy/check',
            description: 'Health check proxies via TCP connect test.',
            auth: true,
            params: [
                { name: 'id', type: 'string', required: false, description: 'Check specific proxy (omit for all)' },
            ],
            exampleBody: null,
            exampleResponse: '{\n  "code": 0,\n  "msg": "success",\n  "data": [\n    {\n      "id": "proxy-abc123",\n      "host": "1.2.3.4",\n      "port": 8080,\n      "is_alive": true,\n      "latency_ms": 142\n    }\n  ]\n}',
        },
        // --- Group Endpoints ---
        {
            method: 'GET', path: '/api/v1/group/list',
            description: 'List all profile groups with counts.',
            auth: true,
            params: [],
            exampleBody: null,
            exampleResponse: '{\n  "code": 0,\n  "msg": "success",\n  "data": [\n    { "group_id": "ecommerce", "group_name": "ecommerce", "profile_count": 12 },\n    { "group_id": "social", "group_name": "social", "profile_count": 5 }\n  ]\n}',
        },
    ];

    ngOnInit(): void {
        this.api.loadConfig();
        this.checkApiOnline();
    }

    toggleExpand(index: number): void {
        this.expandedIndex.set(this.expandedIndex() === index ? null : index);
        this.tryResult.set('');
        this.tryStatus.set(null);
    }

    async checkApiOnline(): Promise<void> {
        try {
            const res = await fetch(`${this.api.connectionUrl()}/api/v1/status`);
            this.apiOnline.set(res.ok);
        } catch {
            this.apiOnline.set(false);
        }
    }

    async tryEndpoint(endpoint: ApiEndpoint): Promise<void> {
        this.tryLoading.set(true);
        this.tryResult.set('');
        this.tryStatus.set(null);

        try {
            const url = `${this.api.connectionUrl()}${endpoint.path}`;
            const headers: Record<string, string> = {};
            if (endpoint.auth) {
                headers['Authorization'] = `Bearer ${this.api.apiKey()}`;
            }

            let res: Response;
            if (endpoint.method === 'POST') {
                headers['Content-Type'] = 'application/json';
                res = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: endpoint.exampleBody || '{}',
                });
            } else {
                res = await fetch(url, { headers });
            }

            this.tryStatus.set(res.status);
            const json = await res.json();
            this.tryResult.set(JSON.stringify(json, null, 2));
        } catch (err) {
            this.tryStatus.set(0);
            this.tryResult.set(err instanceof Error ? err.message : 'Connection refused — is the API server running?');
        } finally {
            this.tryLoading.set(false);
        }
    }

    getCurlCommand(endpoint: ApiEndpoint): string {
        const base = this.api.connectionUrl();
        const authHeader = endpoint.auth ? ` \\\n  -H "Authorization: Bearer ${this.api.apiKey()}"` : '';

        if (endpoint.method === 'POST') {
            return `curl -X POST${authHeader} \\\n  -H "Content-Type: application/json" \\\n  -d '${endpoint.exampleBody || '{}'}' \\\n  ${base}${endpoint.path}`;
        }
        return `curl${authHeader} \\\n  ${base}${endpoint.path}`;
    }

    getPythonCode(endpoint: ApiEndpoint): string {
        const base = this.api.connectionUrl();
        const headers = endpoint.auth
            ? `headers = {"Authorization": "Bearer ${this.api.apiKey()}"}\n`
            : '';

        if (endpoint.method === 'POST') {
            return `import requests\n\n${headers}data = ${endpoint.exampleBody || '{}'}\nres = requests.post("${base}${endpoint.path}", json=data, headers=headers)\nprint(res.json())`;
        }
        return `import requests\n\n${headers}res = requests.get("${base}${endpoint.path}"${endpoint.auth ? ', headers=headers' : ''})\nprint(res.json())`;
    }

    getNodeCode(endpoint: ApiEndpoint): string {
        const base = this.api.connectionUrl();
        const headersObj = endpoint.auth
            ? `{ "Authorization": "Bearer ${this.api.apiKey()}"${endpoint.method === 'POST' ? ', "Content-Type": "application/json"' : ''} }`
            : '{}';

        if (endpoint.method === 'POST') {
            return `const res = await fetch("${base}${endpoint.path}", {\n  method: "POST",\n  headers: ${headersObj},\n  body: JSON.stringify(${endpoint.exampleBody || '{}'}),\n});\nconsole.log(await res.json());`;
        }
        return `const res = await fetch("${base}${endpoint.path}", {\n  headers: ${headersObj},\n});\nconsole.log(await res.json());`;
    }

    async copyCurl(endpoint: ApiEndpoint): Promise<void> {
        try {
            await navigator.clipboard.writeText(this.getCurlCommand(endpoint));
            this.messageService.add({ severity: 'success', summary: 'Copied', detail: 'cURL command copied to clipboard.' });
        } catch {
            this.messageService.add({ severity: 'error', summary: 'Copy Failed', detail: 'Could not copy to clipboard.' });
        }
    }

    async copyCode(code: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(code);
            this.messageService.add({ severity: 'success', summary: 'Copied', detail: 'Code copied to clipboard.' });
        } catch {
            this.messageService.add({ severity: 'error', summary: 'Copy Failed', detail: 'Could not copy to clipboard.' });
        }
    }
}
