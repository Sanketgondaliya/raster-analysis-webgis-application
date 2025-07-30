import { Component, EventEmitter, Output } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [ButtonModule, InputTextModule, RouterLink],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() panelSelect = new EventEmitter<string>();

  constructor(private router: Router) {}

  openPanel(panel: string) {
    this.panelSelect.emit(panel);
    this.router.navigate(['/' + panel]);
    this.toggleSidebar.emit();
  }
}
