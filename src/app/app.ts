import { Component, signal, viewChild, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { CommandPalette } from './views/components/command-palette/command-palette';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast, ConfirmDialog, CommandPalette],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(window:keydown)': 'handleGlobalKeydown($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = signal('chrome-profile-manager');
  protected readonly commandPalette = viewChild<CommandPalette>('commandPalette');
  private themeService = inject(ThemeService);

  handleGlobalKeydown(event: KeyboardEvent): void {
    // ⌘+K (Mac) or Ctrl+K (Windows/Linux)
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.commandPalette()?.toggle();
    }
  }
}
