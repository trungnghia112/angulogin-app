import { Component, ChangeDetectionStrategy, output, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { type ProtectionLevel } from '../../../core/services/settings.service';

@Component({
    selector: 'app-onboarding-dialog',
    templateUrl: './onboarding-dialog.html',
    styleUrl: './onboarding-dialog.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TitleCasePipe, ButtonModule],
})
export class OnboardingDialog {
    readonly complete = output<ProtectionLevel>();
    readonly dismiss = output<void>();

    protected readonly currentStep = signal(0);
    protected readonly selectedLevel = signal<ProtectionLevel>('standard');

    protected readonly protectionOptions = [
        {
            value: 'off' as ProtectionLevel,
            label: 'Off',
            description: 'No fingerprint protection. Uses default browser settings.',
            icon: 'pi pi-ban',
            iconClass: 'text-surface-400',
            bgClass: 'bg-surface-100 dark:bg-surface-800',
        },
        {
            value: 'standard' as ProtectionLevel,
            label: 'Standard',
            description: 'Canvas noise, WebGL protection, and timezone masking.',
            icon: 'pi pi-shield',
            iconClass: 'text-blue-500',
            bgClass: 'bg-blue-50 dark:bg-blue-950/50',
        },
        {
            value: 'maximum' as ProtectionLevel,
            label: 'Maximum',
            description: 'Full antidetect engine with hardware-level spoofing.',
            icon: 'pi pi-verified',
            iconClass: 'text-green-500',
            bgClass: 'bg-green-50 dark:bg-green-950/50',
        },
    ];

    protected readonly steps = [
        { title: 'Welcome', icon: 'pi pi-sparkles' },
        { title: 'Protection', icon: 'pi pi-shield' },
        { title: 'Ready', icon: 'pi pi-check-circle' },
    ];

    selectLevel(level: ProtectionLevel): void {
        this.selectedLevel.set(level);
    }

    next(): void {
        if (this.currentStep() < 2) {
            this.currentStep.update(s => s + 1);
        }
    }

    back(): void {
        if (this.currentStep() > 0) {
            this.currentStep.update(s => s - 1);
        }
    }

    finish(): void {
        this.complete.emit(this.selectedLevel());
    }

    skip(): void {
        this.dismiss.emit();
    }
}
