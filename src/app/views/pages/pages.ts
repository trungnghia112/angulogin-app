import { Component, ChangeDetectionStrategy, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { MainNav } from '../components/main-nav/main-nav';
import { Sidebar } from '../components/sidebar/sidebar';
import { NavigationService } from '../../services/navigation.service';
import { Folder } from '../../models/folder.model';

@Component({
  selector: 'app-pages',
  imports: [RouterOutlet, MainNav, Sidebar],
  templateUrl: './pages.html',
  styleUrl: './pages.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pages implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  protected readonly navService = inject(NavigationService);
  private routeSub?: Subscription;

  // Sidebar visibility based on active feature
  protected readonly hasSidebar = this.navService.hasSidebar;
  protected readonly sidebarType = this.navService.sidebarType;

  // Demo folders data (for browsers sidebar)
  protected readonly folders = signal<Folder[]>([
    { id: '1', name: 'Amazon', icon: 'pi-amazon', color: '#FF9900', profileCount: 5 },
    { id: '2', name: 'Crypto', icon: 'pi-wallet', color: '#71717a', profileCount: 3 },
    { id: '3', name: 'New Folder', icon: 'pi-folder', color: '#71717a', profileCount: 0 },
    { id: '4', name: 'Facebook', icon: 'pi-facebook', color: '#1877F2', profileCount: 2 },
  ]);

  protected readonly selectedFolderId = signal<string | null>('1');

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

  private updateActiveFeatureFromRoute(url: string): void {
    const path = url.split('/')[1] || 'browsers';
    const feature = this.navService.features().find((f) => f.route === `/${path}`);
    if (feature) {
      this.navService.setActiveFeature(feature.id);
    }
  }

  protected onFolderSelected(folderId: string | null): void {
    this.selectedFolderId.set(folderId);
  }

  protected onAddFolder(): void {
    console.log('Add folder clicked');
  }

  protected onSettings(): void {
    console.log('Settings clicked');
  }

  protected onFolderSettings(): void {
    console.log('Folder settings clicked');
  }
}
