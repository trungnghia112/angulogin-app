import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-privacy',
    templateUrl: './privacy.html',
    styleUrl: './privacy.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'block min-h-screen' },
    imports: [RouterLink],
})
export class Privacy { }
