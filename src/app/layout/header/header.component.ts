import { Component, ComponentRef, EventEmitter, Output, ViewChild, ViewContainerRef } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DrawerModule } from 'primeng/drawer';
import { ProfileComponent } from '../../components/profile/profile.component';
import { filter } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ApplicationSettingService } from '../../services/application-setting.service';
import { MapService } from '../../services/map.service';
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ButtonModule, InputTextModule, DrawerModule, ProfileComponent, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() panelSelect = new EventEmitter<string>();
  isUserPanelVisible: boolean = false;
  currentRoute: string = '';
  selectedProject: string = '';
  constructor(private router: Router,
    public applicationSettingService: ApplicationSettingService,
    private mapService: MapService // hypothetical
  ) {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.currentRoute = this.router.url;
      });
    this.selectedProject = this.applicationSettingService.projectName

  }

  isSearchDrawerVisible = false;

  openSearchDrawer() {
    this.isSearchDrawerVisible = true;
  }
  is3DView = false; // default 2D
  toggle2D3D() {
    this.is3DView = !this.is3DView;
    this.mapService.setMode(this.is3DView ? '3D' : '2D');
  }

  openPanel(panel: string) {
    this.panelSelect.emit(panel);
    this.router.navigate(['/' + panel]);
    this.toggleSidebar.emit();
  }

  openUserPanel() {
    this.isUserPanelVisible = true;
  }
  resetApp() {
    // Preserve keys
    const databaseConfig = localStorage.getItem('databaseConfig');
    const geoserverConfig = localStorage.getItem('geoserverConfig');

    // Clear everything
    localStorage.clear();

    // Restore only the preserved keys
    if (databaseConfig) {
      localStorage.setItem('databaseConfig', databaseConfig);
    }
    if (geoserverConfig) {
      localStorage.setItem('geoserverConfig', geoserverConfig);
    }

    // Reload the app
    location.reload();
  }


  menuButtons = [
    { label: 'Layer Switcher', path: 'layer-switcher' },
    { label: 'Dashboard', path: 'dashboard' },
    { label: 'Attribute Table', path: 'attribute-table' },
    { label: 'Query Module', path: 'query-module' },
    { label: 'App-Configuration', path: 'appconfig' },
    { label: 'raster-analysis', path: 'raster-analysis' },
    { label: 'Vector Data Mangemnent', path: 'Vector-DataManagement' }
    

  ];

  isActive(path: string): boolean {
    return this.currentRoute.includes(path);
  }

}
