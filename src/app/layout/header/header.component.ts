import { Component, ComponentRef, EventEmitter, Output, ViewChild, ViewContainerRef } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DrawerModule } from 'primeng/drawer';
import { ProfileComponent } from '../../components/profile/profile.component';
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [ButtonModule, InputTextModule, DrawerModule,ProfileComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() panelSelect = new EventEmitter<string>();
  isUserPanelVisible: boolean = false;
  constructor(private router: Router) { }
  openPanel(panel: string) {
    this.panelSelect.emit(panel);
    this.router.navigate(['/' + panel]);
    this.toggleSidebar.emit();
  }

  openUserPanel() {
    this.isUserPanelVisible = true;
  }

}