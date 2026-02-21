import { Injectable, signal, computed } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import {
    RpaTemplate, ExecutableStep, RpaTaskExecution,
    RpaLogEntry, RpaTaskStatus,
} from '../models/rpa-template.model';

/**
 * RPA Executor Service — Production CDP Engine
 *
 * Orchestrates template execution through Tauri IPC -> Rust CDP -> Chrome.
 * Each task gets its own CDP session keyed by profile path.
 */
@Injectable({ providedIn: 'root' })
export class RpaExecutorService {

    /** All task executions (current and historical) */
    private readonly _tasks = signal<RpaTaskExecution[]>([]);
    readonly tasks = this._tasks.asReadonly();

    /** Currently active (running) tasks */
    readonly activeTasks = computed(() =>
        this._tasks().filter(t => t.status === 'running' || t.status === 'paused')
    );

    /** Task history (completed/failed/cancelled) */
    readonly taskHistory = computed(() =>
        this._tasks().filter(t => ['completed', 'failed', 'cancelled'].includes(t.status))
    );

    /** Cancellation tokens: taskId -> cancelled flag */
    private cancelTokens = new Map<string, boolean>();

    /** Current task ID for logging from within action methods */
    private currentTaskId = '';

    // --- Public API ---

    /**
     * Start executing a template on a profile.
     * Returns the task ID immediately; execution runs in background.
     */
    startTask(
        template: RpaTemplate,
        profilePath: string,
        profileName: string,
        browser: string,
        variables: Record<string, string | number | boolean>,
    ): string {
        const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const task: RpaTaskExecution = {
            id: taskId,
            templateId: template.id,
            templateTitle: template.metadata.title,
            profilePath,
            profileName,
            browser,
            status: 'pending',
            currentStep: 0,
            totalSteps: template.steps.length,
            progress: 0,
            startTime: new Date().toISOString(),
            endTime: null,
            variables,
            logs: [],
            sessionId: null,
            frequency: 'once',
        };

        this._tasks.update(list => [...list, task]);
        this.cancelTokens.set(taskId, false);

        // Fire and forget -- execution runs async
        this.executeTask(taskId, template).catch(() => { /* handled inside */ });

        return taskId;
    }

    /** Cancel a running task */
    cancelTask(taskId: string): void {
        this.cancelTokens.set(taskId, true);
        this.updateTask(taskId, { status: 'cancelled', endTime: new Date().toISOString() });
    }

    /** Remove a task from the list */
    removeTask(taskId: string): void {
        this._tasks.update(list => list.filter(t => t.id !== taskId));
        this.cancelTokens.delete(taskId);
    }

    /** Get a specific task by ID */
    getTask(taskId: string): RpaTaskExecution | undefined {
        return this._tasks().find(t => t.id === taskId);
    }

    // --- Execution Engine ---

    private async executeTask(taskId: string, template: RpaTemplate): Promise<void> {
        const task = this.getTask(taskId);
        if (!task) return;
        this.currentTaskId = taskId;

        try {
            // Phase 1: Launch browser with CDP
            this.log(taskId, 0, 'info', `Launching ${task.browser} with CDP...`);
            this.updateTask(taskId, { status: 'running' });

            const launchResult = await invoke<{ cdpPort: number; wsUrl: string; sessionId: string }>(
                'rpa_launch', {
                profilePath: task.profilePath,
                browser: task.browser,
                url: null,
            }
            );

            this.updateTask(taskId, { sessionId: launchResult.sessionId });
            this.log(taskId, 0, 'success', `Chrome CDP ready on port ${launchResult.cdpPort}`);

            // Phase 2: Connect CDP session
            await invoke('rpa_connect', {
                sessionId: launchResult.sessionId,
                wsUrl: launchResult.wsUrl,
            });
            this.log(taskId, 0, 'success', 'CDP session connected');

            // Phase 3: Enable required CDP domains
            await invoke('rpa_execute', {
                sessionId: launchResult.sessionId,
                method: 'Page.enable',
                params: {},
            });

            await invoke('rpa_execute', {
                sessionId: launchResult.sessionId,
                method: 'Runtime.enable',
                params: {},
            });

            this.log(taskId, 0, 'success', 'CDP domains enabled (Page, Runtime)');

            // Phase 4: Execute steps
            const steps = template.steps as ExecutableStep[];
            let failedSteps = 0;

            for (let i = 0; i < steps.length; i++) {
                // Check cancellation
                if (this.cancelTokens.get(taskId)) {
                    this.log(taskId, i + 1, 'warn', 'Task cancelled by user');
                    break;
                }

                const step = steps[i];
                const stepNum = i + 1;
                this.updateTask(taskId, {
                    currentStep: stepNum,
                    progress: Math.round((i / steps.length) * 100),
                });

                this.log(taskId, stepNum, 'info', `Step ${stepNum}/${steps.length}: ${step.description}`);

                try {
                    const result = await this.executeStep(launchResult.sessionId, step, task.variables);
                    if (result) {
                        // Detect warning/skeleton results
                        const isWarning = /\bno\b.*\b(found|element|product|video|button)/i.test(result)
                            || /\bnot found\b/i.test(result)
                            || result.startsWith('[SKELETON]')
                            || result.startsWith('unsupported action');
                        const level = isWarning ? 'warn' : 'success';
                        this.log(taskId, stepNum, level, `Step ${stepNum}: ${result}`);
                    } else {
                        this.log(taskId, stepNum, 'success', `Step ${stepNum} completed`);
                    }
                } catch (err) {
                    failedSteps++;
                    const errMsg = err instanceof Error ? err.message : String(err);
                    this.log(taskId, stepNum, 'error', `Step ${stepNum} failed: ${errMsg}`);
                    // Continue to next step (error recovery)
                }

                // Human-like delay between steps
                const delay = step.humanDelay || [2000, 5000];
                const waitMs = delay[0] + Math.random() * (delay[1] - delay[0]);
                await this.sleep(waitMs);
            }

            // Phase 5: Cleanup
            const finalStatus: RpaTaskStatus = this.cancelTokens.get(taskId)
                ? 'cancelled'
                : failedSteps > 0 ? 'failed' : 'completed';
            this.updateTask(taskId, {
                status: finalStatus,
                progress: finalStatus === 'completed' ? 100 : undefined,
                endTime: new Date().toISOString(),
            });
            this.log(taskId, template.steps.length, finalStatus === 'failed' ? 'error' : 'success',
                `Task ${finalStatus} (${failedSteps} step(s) failed)`);

            // Disconnect CDP (don't close browser)
            try {
                await invoke('rpa_disconnect', { sessionId: launchResult.sessionId });
            } catch { /* browser may have been closed manually */ }

        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            this.log(taskId, 0, 'error', `Task failed: ${errMsg}`);
            this.updateTask(taskId, {
                status: 'failed',
                endTime: new Date().toISOString(),
            });
        }
    }

    private async executeStep(
        sessionId: string,
        step: ExecutableStep,
        variables: Record<string, string | number | boolean>,
    ): Promise<string> {
        // Detect skeleton steps (placeholder without implementation)
        const hasImplementation = step.selector || step.jsExpression || step.url || step.waitMs;
        if (!hasImplementation && step.action !== 'loop') {
            return `[SKELETON] Step not implemented: "${step.description}" — no selector/JS/URL`;
        }

        switch (step.action) {
            case 'navigate':
                return this.actionNavigate(sessionId, step, variables);
            case 'click':
                return this.actionClick(sessionId, step, variables);
            case 'type':
                return this.actionType(sessionId, step, variables);
            case 'scroll':
                return this.actionScroll(sessionId, step);
            case 'wait':
                await this.sleep(step.waitMs || 3000);
                return `waited ${step.waitMs || 3000}ms`;
            case 'extract':
                return this.actionExtract(sessionId, step);
            case 'loop':
                return 'loop (handled at template level)';
            default:
                return `unsupported action: ${step.action}`;
        }
    }

    // --- Step Actions (CDP wrappers) ---

    private async actionNavigate(
        sessionId: string,
        step: ExecutableStep,
        variables: Record<string, string | number | boolean>,
    ): Promise<string> {
        let url = step.url || '';
        url = this.replaceVariables(url, variables);

        await invoke('rpa_execute', {
            sessionId,
            method: 'Page.navigate',
            params: { url },
        });

        // Wait for page load
        await this.sleep(3000);

        // If waitForSelector, wait until element appears
        if (step.waitForSelector) {
            // waitForSelector may contain comma-separated selectors
            const selectors = step.waitForSelector.split(',').map(s => s.trim());
            await this.waitForAnySelector(sessionId, selectors, step.timeout || 10000);
        }

        return `navigated to ${url}`;
    }

    private async actionClick(
        sessionId: string,
        step: ExecutableStep,
        variables: Record<string, string | number | boolean>,
    ): Promise<string> {
        if (step.jsExpression) {
            const js = this.replaceVariables(step.jsExpression, variables);
            const result = await this.evaluateJS(sessionId, js);
            return `js: ${result}`;
        }

        const selector = step.selector;
        if (!selector) throw new Error('Click step has no selector');

        const allSelectors = [selector, ...(step.fallbackSelectors || [])];

        // Wait for any of the selectors to appear
        await this.waitForAnySelector(sessionId, allSelectors, step.timeout || 10000);

        // Click the first matching element
        const js = `
            (() => {
                const selectors = ${JSON.stringify(allSelectors)};
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.click();
                        return 'clicked: ' + sel;
                    }
                }
                throw new Error('No element found for selectors: ' + selectors.join(', '));
            })()
        `;
        return await this.evaluateJS(sessionId, js);
    }

    private async actionType(
        sessionId: string,
        step: ExecutableStep,
        variables: Record<string, string | number | boolean>,
    ): Promise<string> {
        if (step.jsExpression) {
            const js = this.replaceVariables(step.jsExpression, variables);
            const result = await this.evaluateJS(sessionId, js);
            return `js: ${result}`;
        }

        const selector = step.selector;
        const value = this.replaceVariables(step.value || '', variables);
        if (!selector) throw new Error('Type step has no selector');
        if (!value) throw new Error('Type step has no value');

        const allSelectors = [selector, ...(step.fallbackSelectors || [])];

        // Wait for any of the selectors to appear
        const foundSelector = await this.waitForAnySelector(sessionId, allSelectors, step.timeout || 10000);

        // Focus the element and type using CDP Input.dispatchKeyEvent for realistic typing
        const focusJs = `
            (() => {
                const el = document.querySelector(${JSON.stringify(foundSelector)});
                if (!el) throw new Error('Element not found: ${foundSelector}');
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
                el.value = '';
                el.dispatchEvent(new Event('focus', { bubbles: true }));
                return 'focused: ' + el.tagName;
            })()
        `;
        await this.evaluateJS(sessionId, focusJs);

        // Type each character using CDP Input.dispatchKeyEvent (more realistic than JS)
        for (const char of value) {
            await invoke('rpa_execute', {
                sessionId,
                method: 'Input.dispatchKeyEvent',
                params: { type: 'keyDown', text: char, key: char, },
            });
            await invoke('rpa_execute', {
                sessionId,
                method: 'Input.dispatchKeyEvent',
                params: { type: 'keyUp', key: char, },
            });
            // Small delay between keystrokes (30-100ms) for human-like typing
            await this.sleep(30 + Math.random() * 70);
        }

        // Verify the value was typed
        const verifyJs = `
            (() => {
                const el = document.querySelector(${JSON.stringify(foundSelector)});
                return el ? 'typed ' + el.value.length + ' chars: "' + el.value.substring(0, 50) + '"' : 'element lost';
            })()
        `;
        const result = await this.evaluateJS(sessionId, verifyJs);

        // Press Enter if this is a search input
        if (selector.includes('search') || step.description.toLowerCase().includes('search')) {
            await this.sleep(500);

            // Use CDP Input.dispatchKeyEvent for Enter — more reliable than DOM events
            await invoke('rpa_execute', {
                sessionId,
                method: 'Input.dispatchKeyEvent',
                params: {
                    type: 'keyDown',
                    key: 'Enter',
                    code: 'Enter',
                    windowsVirtualKeyCode: 13,
                    nativeVirtualKeyCode: 13,
                },
            });
            await invoke('rpa_execute', {
                sessionId,
                method: 'Input.dispatchKeyEvent',
                params: {
                    type: 'keyUp',
                    key: 'Enter',
                    code: 'Enter',
                    windowsVirtualKeyCode: 13,
                    nativeVirtualKeyCode: 13,
                },
            });

            // Wait for search results to load
            await this.sleep(3000);
        }

        return result;
    }

    private async actionScroll(sessionId: string, step: ExecutableStep): Promise<string> {
        if (step.jsExpression) {
            return await this.evaluateJS(sessionId, step.jsExpression);
        }

        const scrollCount = step.iterations || 3;
        for (let i = 0; i < scrollCount; i++) {
            const scrollAmount = 300 + Math.floor(Math.random() * 500);
            await this.evaluateJS(
                sessionId,
                `window.scrollBy({ top: ${scrollAmount}, behavior: 'smooth' })`,
            );
            await this.sleep(1000 + Math.random() * 2000);
        }
        return `scrolled ${scrollCount} times`;
    }

    private async actionExtract(sessionId: string, step: ExecutableStep): Promise<string> {
        if (step.jsExpression) {
            return await this.evaluateJS(sessionId, step.jsExpression);
        }
        return 'no extract expression';
    }

    // --- Helpers ---

    /**
     * Evaluate JavaScript in the page and return the string result.
     * Throws if the JS execution fails or throws.
     */
    private async evaluateJS(sessionId: string, expression: string): Promise<string> {
        const result = await invoke<{ type: string; value: unknown; description?: string }>(
            'rpa_evaluate_js',
            { sessionId, expression },
        );
        // Convert result to readable string
        if (result?.value !== undefined && result?.value !== null) {
            return String(result.value);
        }
        if (result?.description) {
            return result.description;
        }
        return JSON.stringify(result);
    }

    /**
     * Wait for ANY of the given selectors to appear in the page.
     * Returns the first selector that was found.
     * Throws on timeout with details about what was tried.
     */
    private async waitForAnySelector(
        sessionId: string,
        selectors: string[],
        timeoutMs: number,
    ): Promise<string> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            for (const selector of selectors) {
                try {
                    const result = await invoke<{ type: string; value: unknown }>('rpa_evaluate_js', {
                        sessionId,
                        expression: `!!document.querySelector(${JSON.stringify(selector)})`,
                    });
                    if (result?.value === true) {
                        return selector;
                    }
                } catch {
                    // JS eval failed, continue trying
                }
            }
            await this.sleep(500);
        }
        throw new Error(`Timeout (${timeoutMs}ms) waiting for selectors: ${selectors.join(', ')}`);
    }

    private replaceVariables(
        text: string,
        variables: Record<string, string | number | boolean>,
    ): string {
        return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
            return variables[key]?.toString() || '';
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private updateTask(taskId: string, patch: Partial<RpaTaskExecution>): void {
        this._tasks.update(list =>
            list.map(t => t.id === taskId ? { ...t, ...patch } : t)
        );
    }

    private log(taskId: string, step: number, level: RpaLogEntry['level'], message: string): void {
        const entry: RpaLogEntry = {
            timestamp: new Date().toISOString(),
            level,
            step,
            message,
        };
        this._tasks.update(list =>
            list.map(t => t.id === taskId ? { ...t, logs: [...t.logs, entry] } : t)
        );
    }
}
