import { Component, ChangeDetectionStrategy, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { MainNav } from '../components/main-nav/main-nav';
import { NavigationService } from '../../services/navigation.service';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-pages',
  imports: [RouterOutlet, MainNav, ButtonModule, TooltipModule],
  templateUrl: './pages.html',
  styleUrl: './pages.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeyDown($event)' },
})
export class Pages implements OnInit {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly navService = inject(NavigationService);

  // Feature 6.9: Zen Mode
  protected readonly zenMode = this.navService.zenMode;

  onKeyDown(event: KeyboardEvent): void {
    // Cmd+\ (Mac) or Ctrl+\ (Win/Linux) toggles Zen Mode
    if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
      event.preventDefault();
      this.navService.toggleZenMode();
    }
  }

  ngOnInit(): void {
    // Sync navigation state with current route
    this.updateActiveFeatureFromRoute(this.router.url);

    // Listen to route changes
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.updateActiveFeatureFromRoute((event as NavigationEnd).urlAfterRedirects);
      });
  }

  protected exitZenMode(): void {
    this.navService.toggleZenMode();
  }

  private updateActiveFeatureFromRoute(url: string): void {
    const path = url.split('/')[1] || 'browsers';
    const feature = this.navService.features().find((f) => f.route === `/${path}`);
    if (feature) {
      this.navService.setActiveFeature(feature.id);
    }
  }
}

