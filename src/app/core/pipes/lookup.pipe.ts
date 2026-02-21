import { Pipe, PipeTransform } from '@angular/core';

/**
 * Generic pipe that looks up a value from a Record or transforms it via a function.
 * Angular Pure Pipe caching ensures transform() only re-evaluates when input changes.
 *
 * Usage with Record:
 *   {{ 'facebook' | lookup:platformColorMap }}
 *   {{ 'launch' | lookup:typeIconMap:'pi-question' }}
 *
 * Usage with function:
 *   {{ someValue | lookup:transformFn }}
 *
 * @param value     - The input value to look up
 * @param mapSource - A Record<string, T> or (value) => T
 * @param fallback  - Optional fallback when key not found (default: value itself)
 */
@Pipe({ name: 'lookup' })
export class LookupPipe implements PipeTransform {
    transform<T>(value: any, mapSource: Record<string, T> | ((v: any) => T), fallback?: T): T | any {
        if (value == null) return fallback ?? value;

        if (typeof mapSource === 'function') {
            return mapSource(value);
        }

        return mapSource[value] ?? fallback ?? value;
    }
}
