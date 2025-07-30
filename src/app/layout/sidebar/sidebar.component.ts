import { Component, Input, Output, SimpleChanges, EventEmitter } from '@angular/core';
import { NgIf, NgClass } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgIf, NgClass, ButtonModule, RouterOutlet],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  @Input() activePanel: string | null = null;
  @Output() close = new EventEmitter<void>();
  collapsed = false;

  toggleCollapse() {
    this.collapsed = !this.collapsed;
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activePanel'] && this.activePanel) {
      this.collapsed = false;
    }
  }

  closeSidebar() {
    this.close.emit();
  }
}
