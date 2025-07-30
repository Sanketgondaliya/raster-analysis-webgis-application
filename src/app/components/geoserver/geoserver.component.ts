import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { FormsModule } from '@angular/forms';

interface Tab {
  label: string;
  value: number;
}

@Component({
  selector: 'app-geoserver',
  standalone: true,
  imports: [CommonModule, FormsModule, TabsModule],
  templateUrl: './geoserver.component.html',
  styleUrl: './geoserver.component.scss'
})
export class GeoserverComponent {
  value: number = 0;

  tabs: Tab[] = [
    { label: 'Workspace', value: 0 },
    { label: 'Datastore', value: 1 },
    { label: 'Upload Layer', value: 2 },
    // { label: 'Style', value: 3 }
  ];

  onTabChange(index: number | string): void {
    this.value = typeof index === 'string' ? parseInt(index, 10) : index;
    console.log('Tab Changed:', index);
  }
}
