import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-teams',
    templateUrl: './teams.html',
    styleUrl: './teams.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [],
})
export class Teams { }
