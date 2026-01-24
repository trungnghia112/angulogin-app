import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
    selector: 'app-extensions',
    templateUrl: './extensions.html',
    styleUrl: './extensions.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonModule],
})
export class Extensions { }
