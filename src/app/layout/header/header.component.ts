import { Component, ComponentRef, EventEmitter, Output, ViewChild, ViewContainerRef } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DrawerModule } from 'primeng/drawer';
import { ProfileComponent } from '../../components/profile/profile.component';
import { filter } from 'rxjs';
import { CommonModule } from '@angular/common';
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

  constructor(private router: Router) {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.currentRoute = this.router.url;
      });
  }

  openPanel(panel: string) {
    this.panelSelect.emit(panel);
    this.router.navigate(['/' + panel]);
    this.toggleSidebar.emit();
  }

  openUserPanel() {
    this.isUserPanelVisible = true;
  }

  menuButtons = [
    { label: 'Layer Switcher', path: 'layer-switcher' },
    { label: 'Dashboard', path: 'dashboard' },
    { label: 'Attribute Table', path: 'attribute-table' },
    { label: 'Query Module', path: 'query-module' },
    { label: 'Geoserver', path: 'geoserver' }
  ];

  isActive(path: string): boolean {
    return this.currentRoute.includes(path);
  }

}