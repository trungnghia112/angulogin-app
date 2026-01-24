import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
    selector: 'app-extensions',
    templateUrl: './extensions.html',
    styleUrl: './extensions.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'flex-1 flex flex-col min-h-0 overflow-hidden' },
    imports: [ButtonModule],
})
export class Extensions { }
