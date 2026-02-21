import { Pipe, PipeTransform } from '@angular/core';

/**
 * Generic pipe that maps a value through a Record lookup or function.
 * Angular Pure Pipe caching ensures transform() only re-evaluates when input changes.
 *
 * Usage with Record:
 *   {{ 'facebook' | map:platformColorMap }}
 *   {{ 'launch' | map:typeIconMap:'pi-question' }}
 *
 * Usage with function:
 *   {{ someValue | map:transformFn }}
 *
 * @param value     - The input value to map
 * @param mapSource - A Record<string, T> or (value) => T
 * @param fallback  - Optional fallback when key not found (default: value itself)
 */
@Pipe({ name: 'map' })
export class MapPipe implements PipeTransform {
    transform<T>(value: any, mapSource: Record<string, T> | ((v: any) => T), fallback?: T): T | any {
        if (value == null) return fallback ?? value;

        if (typeof mapSource === 'function') {
            return mapSource(value);
        }

        return mapSource[value] ?? fallback ?? value;
    }
}
