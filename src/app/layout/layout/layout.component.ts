import { Component } from '@angular/core';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { MapComponent } from '../map/map.component';
import { FooterComponent } from '../footer/footer.component';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [HeaderComponent, SidebarComponent, MapComponent, FooterComponent, NgIf],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent {
  sidebarVisible = false;
  selectedPanel: string | null = null;

  toggleSidebar() {
    this.sidebarVisible = true; // force open
  }

  handlePanelSelect(panel: string) {
    this.selectedPanel = panel;
    this.sidebarVisible = true; // Force sidebar to open when panel changes
  }
}
