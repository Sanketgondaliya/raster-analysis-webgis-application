import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { AccordionModule } from 'primeng/accordion';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';

interface TabItem {
  name: string;
  id: string;
  checked: boolean;
}

interface Tab {
  label: string;
  value: number;
  items: TabItem[];
}

@Component({
  selector: 'app-layer-switchder',
  standalone: true,
  imports: [CommonModule, FormsModule, TabsModule, AccordionModule, CheckboxModule],
  templateUrl: './layer-switchder.component.html',
  styleUrls: ['./layer-switchder.component.scss']
})
export class LayerSwitchderComponent {
  value: number = 0;

  tabs: Tab[] = [
    {
      label: 'Basemap',
      value: 0,
      items: [
        { name: 'OSM', id: 'osm', checked: false },
        { name: 'Google', id: 'google', checked: false },
        { name: 'ESRI', id: 'esri', checked: false }
      ]
    },
    {
      label: 'Operational',
      value: 1,
      items: [
        { name: 'India', id: 'india', checked: false },
        { name: 'State', id: 'state', checked: false },
        { name: 'District', id: 'district', checked: false }
      ]
    },
    {
      label: 'Temporal',
      value: 2,
      items: [
        { name: '2020', id: '2020', checked: false },
        { name: '2021', id: '2021', checked: false },
        { name: '2022', id: '2022', checked: false }
      ]
    }
  ];

  onTabChange(index: number | string): void {
    this.value = typeof index === 'string' ? parseInt(index, 10) : index;
    console.log('Tab Changed:', index);
  }

  onItemClick(item: TabItem): void {
    console.log('Clicked on item:', item);
  }
}
