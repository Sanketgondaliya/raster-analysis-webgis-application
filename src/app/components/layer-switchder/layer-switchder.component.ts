import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { AccordionModule } from 'primeng/accordion';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { RadioButtonModule } from 'primeng/radiobutton';

import Map from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';

import { ToastService } from '../services/toast.service';
import { GeoserverService } from '../services/geoserver.service';
import { MapService } from '../services/map.service';
import { transformExtent } from 'ol/proj';

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

interface DataStore {
  name: string;
  tables: { name: string; bbox: any }[];
}

@Component({
  selector: 'app-layer-switchder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TabsModule,
    AccordionModule,
    CheckboxModule,
    RadioButtonModule
  ],
  templateUrl: './layer-switchder.component.html',
  styleUrls: ['./layer-switchder.component.scss']
})
export class LayerSwitchderComponent {
  value: number = 0;
  selectedProject = '';
  selectedBasemap: string = 'OSM';
  map!: Map;

  datastorelist: DataStore[] = [];
  wmsLayers: { [key: string]: TileLayer<TileWMS> } = {};
  checkedTables: { [key: string]: { checked: boolean; bbox: any } } = {};

  tabs: Tab[] = [
    {
      label: 'Basemap',
      value: 0,
      items: [
        { name: 'OSM', id: 'osm', checked: true },
        { name: 'Google', id: 'google', checked: false },
        { name: 'ESRI', id: 'esri', checked: false }
      ]
    },
    {
      label: 'Operational',
      value: 1,
      items: []
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

  constructor(
    private toastService: ToastService,
    private geoserverService: GeoserverService,
    private cdr: ChangeDetectorRef,
    private mapService: MapService
  ) {
    this.selectedProject = localStorage.getItem('selectedProject') || '';
  }

 ngOnInit(): void {
  this.map = this.mapService.getMap();

  const storedTables = localStorage.getItem('checkedTables');
  if (storedTables) {
    this.checkedTables = JSON.parse(storedTables);
  }

  this.loadAllLayers();
}


 loadAllLayers(): void {
  if (!this.selectedProject) return;

  for (const ds of this.datastorelist) {
    for (const table of ds.tables) {
      const key = `${ds.name}.${table.name}`;
      const layerName = `${this.selectedProject}:${table.name}`;

      if (this.wmsLayers[key]) continue;

      const wmsLayer = new TileLayer({
        source: new TileWMS({
          url: `http://192.168.20.49:8080/geoserver/${this.selectedProject}/wms`,
          params: {
            'LAYERS': layerName,
            'TILED': true,
            'FORMAT': 'image/png',
            'TRANSPARENT': true,
            'srs': 'EPSG:4326'
          },
          serverType: 'geoserver',
          transition: 0
        }),
        visible: this.checkedTables[key]?.checked || false,
        zIndex: 999
      });

      this.wmsLayers[key] = wmsLayer;

      if (!this.checkedTables[key]) {
        this.checkedTables[key] = { checked: false, bbox: table.bbox };
      }

      this.map.addLayer(wmsLayer);
    }
  }

  this.cdr.detectChanges();
}


  onItemClick(tableName: string, datastoreName: string): void {
    const key = `${datastoreName}.${tableName}`;
    const tableInfo = this.checkedTables[key];
    const isChecked = tableInfo?.checked;

    const layer = this.wmsLayers[key];
    if (layer) {
      layer.setVisible(isChecked);
    }

    // Save state to localStorage
    localStorage.setItem('checkedTables', JSON.stringify(this.checkedTables));

    // Zoom to layer extent if checked and bbox exists
    if (isChecked && tableInfo?.bbox) {
      const extent4326 = [
        tableInfo.bbox.minx,
        tableInfo.bbox.miny,
        tableInfo.bbox.maxx,
        tableInfo.bbox.maxy
      ];

      const extent3857 = transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');

      this.map.getView().fit(extent3857, {
        duration: 1000,
        padding: [50, 50, 50, 50]
      });
    }
  }


  onBasemapChange(selected: string): void {
    this.mapService.removeCurrentBasemap();
    this.mapService.addBasemap(selected);
  }

  onTabChange(index: number | string): void {
    this.value = typeof index === 'string' ? parseInt(index, 10) : index;
    if (this.value === 1) {
      this.getDatastoreList();
    }
  }

  getDatastoreList(): void {
    if (!this.selectedProject) {
      this.toastService.showInfo('Please select a project first.');
      return;
    }

    this.geoserverService.geoserverLayerList(this.selectedProject).subscribe({
      next: (response) => {
        const dataStores = response?.datastores || [];
        if (dataStores.length === 0) {
          this.toastService.showInfo('No datastores found. Please create one.');
          this.datastorelist = [];
        } else {
          this.datastorelist = dataStores;
          this.loadAllLayers();
        }
      },
      error: (err) => {
        console.error('Error fetching datastore list:', err);
      }
    });
  }
}
