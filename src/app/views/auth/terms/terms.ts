import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-terms',
    templateUrl: './terms.html',
    styleUrl: './terms.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'block min-h-screen' },
    imports: [RouterLink],
})
export class Terms { }
