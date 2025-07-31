import { Component } from '@angular/core';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { MapComponent } from '../map/map.component';
import { FooterComponent } from '../footer/footer.component';
import { NgIf } from '@angular/common';
import { Toast } from "primeng/toast";
import { ToastModule } from "primeng/toast"
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [HeaderComponent, SidebarComponent, MapComponent, FooterComponent, NgIf, ToastModule, Toast],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent {
  sidebarVisible = false;
  selectedPanel: string | null = null;
  ngOnInit(): void {
    this.sidebarVisible = true;
  }

  toggleSidebar() {
    this.sidebarVisible = true;
  }

  handlePanelSelect(panel: string) {
    this.selectedPanel = panel;
    this.sidebarVisible = true;
  }
}
