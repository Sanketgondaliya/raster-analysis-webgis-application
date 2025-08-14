import { Component } from '@angular/core';
import { LayoutComponent } from './layout/layout/layout.component';
import { LoadingService } from './services/loading.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LayoutComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'webgis';
  constructor(public loadingService: LoadingService) {}
}
