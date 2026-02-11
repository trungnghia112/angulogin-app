import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
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
})
export class Pages implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  protected readonly navService = inject(NavigationService);
  private routeSub?: Subscription;

  // Feature 6.9: Zen Mode
  protected readonly zenMode = this.navService.zenMode;

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // ⌘+\ (Mac) or Ctrl+\ (Win/Linux) toggles Zen Mode
    if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
      event.preventDefault();
      this.navService.toggleZenMode();
    }
  }

  ngOnInit(): void {
    // Sync navigation state with current route
    this.updateActiveFeatureFromRoute(this.router.url);

    // Listen to route changes
    this.routeSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.updateActiveFeatureFromRoute((event as NavigationEnd).urlAfterRedirects);
      });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
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

