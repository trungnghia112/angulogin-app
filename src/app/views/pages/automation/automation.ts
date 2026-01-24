import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-automation',
    templateUrl: './automation.html',
    styleUrl: './automation.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [],
})
export class Automation { }
