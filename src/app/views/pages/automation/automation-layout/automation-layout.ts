import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';

interface AutomationMenuItem {
    id: string;
    label: string;
    icon: string;
    route: string;
    badge?: string;
}

@Component({
    selector: 'app-automation-layout',
    templateUrl: './automation-layout.html',
    styleUrl: './automation-layout.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex min-h-0 overflow-hidden' },
    imports: [RouterOutlet, RouterLink, RouterLinkActive, TooltipModule],
})
export class AutomationLayout {
    protected readonly menuItems: AutomationMenuItem[] = [
        { id: 'marketplace', label: 'Marketplace', icon: 'pi-shop', route: './marketplace' },
        { id: 'process', label: 'Process', icon: 'pi-sitemap', route: './process' },
        { id: 'my-templates', label: 'My Templates', icon: 'pi-file-edit', route: './my-templates' },
        { id: 'task', label: 'Task', icon: 'pi-play-circle', route: './task' },
        { id: 'api-docs', label: 'API Docs', icon: 'pi-book', route: './api-docs' },
        { id: 'task-log', label: 'Task Log', icon: 'pi-history', route: './task-log', badge: 'Soon' },
    ];

    protected readonly sidebarCollapsed = signal(false);

    toggleSidebar(): void {
        this.sidebarCollapsed.update(v => !v);
    }
}
