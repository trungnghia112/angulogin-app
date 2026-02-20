import { Injectable, signal, computed } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import {
    RpaTemplate, ExecutableStep, RpaTaskExecution,
    RpaLogEntry, RpaTaskStatus,
} from '../models/rpa-template.model';

/**
 * RPA Executor Service — Production CDP Engine
 *
 * Orchestrates template execution through Tauri IPC → Rust CDP → Chrome.
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

    /** Cancellation tokens: taskId → cancelled flag */
    private cancelTokens = new Map<string, boolean>();

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

        // Fire and forget — execution runs async
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

            // Phase 3: Enable Page events
            await invoke('rpa_execute', {
                sessionId: launchResult.sessionId,
                method: 'Page.enable',
                params: {},
            });

            // Phase 4: Execute steps
            const steps = template.steps as ExecutableStep[];
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
                    await this.executeStep(launchResult.sessionId, step, task.variables);
                    this.log(taskId, stepNum, 'success', `Step ${stepNum} completed`);
                } catch (err) {
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
            const finalStatus: RpaTaskStatus = this.cancelTokens.get(taskId) ? 'cancelled' : 'completed';
            this.updateTask(taskId, {
                status: finalStatus,
                progress: finalStatus === 'completed' ? 100 : undefined,
                endTime: new Date().toISOString(),
            });
            this.log(taskId, template.steps.length, 'success', `Task ${finalStatus}`);

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
    ): Promise<void> {
        switch (step.action) {
            case 'navigate':
                await this.actionNavigate(sessionId, step, variables);
                break;
            case 'click':
                await this.actionClick(sessionId, step, variables);
                break;
            case 'type':
                await this.actionType(sessionId, step, variables);
                break;
            case 'scroll':
                await this.actionScroll(sessionId, step);
                break;
            case 'wait':
                await this.sleep(step.waitMs || 3000);
                break;
            case 'extract':
                await this.actionExtract(sessionId, step);
                break;
            case 'loop':
                // Loop is handled at template level via iterations
                break;
            default:
                // Unsupported action — skip
                break;
        }
    }

    // --- Step Actions (CDP wrappers) ---

    private async actionNavigate(
        sessionId: string,
        step: ExecutableStep,
        variables: Record<string, string | number | boolean>,
    ): Promise<void> {
        let url = step.url || '';
        // Replace template variables {{varName}}
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
            await this.waitForSelector(sessionId, step.waitForSelector, step.timeout || 10000);
        }
    }

    private async actionClick(
        sessionId: string,
        step: ExecutableStep,
        variables: Record<string, string | number | boolean>,
    ): Promise<void> {
        if (step.jsExpression) {
            const js = this.replaceVariables(step.jsExpression, variables);
            await invoke('rpa_evaluate_js', { sessionId, expression: js });
            return;
        }

        const selector = step.selector;
        if (!selector) return;

        // Wait for element, then click
        await this.waitForSelector(sessionId, selector, step.timeout || 10000);

        const js = `
            (() => {
                const selectors = ${JSON.stringify([selector, ...(step.fallbackSelectors || [])])};
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el) { el.click(); return 'clicked: ' + sel; }
                }
                return 'no element found';
            })()
        `;
        await invoke('rpa_evaluate_js', { sessionId, expression: js });
    }

    private async actionType(
        sessionId: string,
        step: ExecutableStep,
        variables: Record<string, string | number | boolean>,
    ): Promise<void> {
        if (step.jsExpression) {
            const js = this.replaceVariables(step.jsExpression, variables);
            await invoke('rpa_evaluate_js', { sessionId, expression: js });
            return;
        }

        const selector = step.selector;
        const value = this.replaceVariables(step.value || '', variables);
        if (!selector || !value) return;

        await this.waitForSelector(sessionId, selector, step.timeout || 10000);

        // Type each character with small delays to mimic human typing
        const js = `
            (() => {
                const el = document.querySelector(${JSON.stringify(selector)});
                if (!el) return 'element not found';
                el.focus();
                el.value = '';
                const chars = ${JSON.stringify(value)};
                for (const c of chars) {
                    el.value += c;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return 'typed: ' + chars.length + ' chars';
            })()
        `;
        await invoke('rpa_evaluate_js', { sessionId, expression: js });

        // Press Enter if the selector is a search input
        if (selector.includes('search') || step.description.toLowerCase().includes('search')) {
            await this.sleep(500);
            const enterJs = `
                (() => {
                    const el = document.querySelector(${JSON.stringify(selector)});
                    if (el) {
                        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
                        el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', bubbles: true }));
                        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
                        // Also try form submit
                        const form = el.closest('form');
                        if (form) form.submit();
                    }
                    return 'enter pressed';
                })()
            `;
            await invoke('rpa_evaluate_js', { sessionId, expression: enterJs });
        }
    }

    private async actionScroll(sessionId: string, step: ExecutableStep): Promise<void> {
        if (step.jsExpression) {
            await invoke('rpa_evaluate_js', { sessionId, expression: step.jsExpression });
            return;
        }

        // Default: scroll down by random amount 3-5 times
        const scrollCount = step.iterations || 3;
        for (let i = 0; i < scrollCount; i++) {
            const scrollAmount = 300 + Math.floor(Math.random() * 500);
            await invoke('rpa_evaluate_js', {
                sessionId,
                expression: `window.scrollBy({ top: ${scrollAmount}, behavior: 'smooth' })`,
            });
            await this.sleep(1000 + Math.random() * 2000);
        }
    }

    private async actionExtract(sessionId: string, step: ExecutableStep): Promise<void> {
        if (step.jsExpression) {
            await invoke('rpa_evaluate_js', { sessionId, expression: step.jsExpression });
        }
    }

    // --- Helpers ---

    private async waitForSelector(sessionId: string, selector: string, timeoutMs: number): Promise<void> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const result = await invoke<{ type: string; value: unknown }>('rpa_evaluate_js', {
                sessionId,
                expression: `!!document.querySelector(${JSON.stringify(selector)})`,
            });
            if (result?.value === true) return;
            await this.sleep(500);
        }
        // Don't throw — just log and continue (selector might not exist on this page version)
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
