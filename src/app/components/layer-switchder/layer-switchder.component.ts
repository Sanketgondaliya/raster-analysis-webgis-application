import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { AccordionModule } from 'primeng/accordion';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { RadioButtonModule } from 'primeng/radiobutton';
import { RippleModule } from 'primeng/ripple';
import { TooltipModule } from 'primeng/tooltip';

import Map from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';

import { ToastService } from '../../services/toast.service';
import { GeoserverService } from '../../services/geoserver.service';
import { MapService } from '../../services/map.service';
import { transformExtent } from 'ol/proj';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import KML from 'ol/format/KML';
import GML from 'ol/format/GML';
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';
import { ButtonModule } from 'primeng/button';
interface TabItem {
  name: string;
  id: string;
  checked: boolean;
}
// Add this interface at the top of your component
interface UploadedLayer {
  id: string;
  name: string;
  visible: boolean;
  layer: VectorLayer<VectorSource>;
  projection: string; // Add this line
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
    RadioButtonModule,
    ButtonModule,
    ButtonModule,
    RippleModule,
    TooltipModule
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
      items: []
    }

  ];
  uploadedFileNames: string[] = [];

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

    const storedBasemap = localStorage.getItem('selectedBasemap');
    if (storedBasemap) {
      this.selectedBasemap = storedBasemap;
      this.mapService.addBasemap(storedBasemap);
    } else {
      this.mapService.addBasemap(this.selectedBasemap);
    }

    const storedTables = localStorage.getItem('checkedTables');
    if (storedTables) {
      this.checkedTables = JSON.parse(storedTables);
    }
  }

  zoomToLayer(layerName: string, groupName: string, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }

    let bbox: any;

    if (groupName === 'Temporal') {
      // Default extent for temporal layers
      bbox = { 
        minx: -180, 
        miny: -90, 
        maxx: 180, 
        maxy: 90,
        crs: 'EPSG:4326' 
      };
    } else {
      // For operational layers
      const key = `${groupName}.${layerName}`;
      if (this.checkedTables[key]?.bbox) {
        bbox = this.checkedTables[key].bbox;
      }
    }

    if (!bbox) {
      this.toastService.showInfo('No extent information available for this layer');
      return;
    }

    const sourceCRS = typeof bbox.crs === 'string' 
      ? bbox.crs 
      : bbox.crs?.$ || 'EPSG:4326';
    
    const extent = [bbox.minx, bbox.miny, bbox.maxx, bbox.maxy];

    try {
      const transformedExtent = transformExtent(extent, sourceCRS, 'EPSG:3857');
      this.map.getView().fit(transformedExtent, {
        duration: 1000,
        padding: [50, 50, 50, 50]
      });
    } catch (error) {
      console.error('Error transforming extent:', error);
      this.toastService.showError('Failed to zoom to layer extent');
    }
  }

  loadAllLayers(): void {
    if (!this.selectedProject) return;

    const geoserverConfig = JSON.parse(localStorage.getItem('geoserverConfig') || '{}');
    const geoserverUrl = geoserverConfig.geoserverurl || 'http://localhost:8080/geoserver/';

    for (const ds of this.datastorelist) {
      for (const table of ds.tables) {
        const key = `${ds.name}.${table.name}`;

        if (this.wmsLayers[key]) continue;

        const layerName = `${this.selectedProject}:${table.name}`;

        const wmsLayer = new TileLayer({
          className: key,
          source: new TileWMS({
            url: `${geoserverUrl}${this.selectedProject}/wms`,
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
          this.checkedTables[key] = {
            checked: false,
            bbox: table.bbox
          };
        }

        const alreadyAdded = this.map.getLayers().getArray()
          .some(l => l.getClassName?.() === key);
        if (!alreadyAdded) {
          this.map.addLayer(wmsLayer);
        }
      }
    }

    this.cdr.detectChanges();
  }

  onItemClick(event: any, tableName: string, datastoreName: string): void {
    const key = `${datastoreName}.${tableName}`;
    const tableInfo = this.checkedTables[key];
    const itemChecked = event.checked;
    let allLayers = this.map.getAllLayers();
    for (let dataCount = 0; dataCount < allLayers.length; dataCount++) {
      const element = allLayers[dataCount];
      if(element.getClassName() === key){
      if (element.getClassName() === key) {
        element.setVisible(itemChecked)
      }

    }
    
    if (this.checkedTables[key]) {
      this.checkedTables[key].checked = itemChecked;
    }
    localStorage.setItem('checkedTables', JSON.stringify(this.checkedTables));
    
  }

  onBasemapChange(selected: string): void {
    this.selectedBasemap = selected;
    localStorage.setItem('selectedBasemap', selected);
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
    const selectedProject = localStorage.getItem('selectedProject') || '';
    if (!selectedProject) {
      this.toastService.showInfo('Please select a project first.');
      return;
    }

    const geoserverConfig = JSON.parse(localStorage.getItem('geoserverConfig') || '{}');
    const databaseConfig = JSON.parse(localStorage.getItem('databaseConfig') || '{}');

    const ProjectPayload = {
      workspaceName: selectedProject,
      geoserverurl: geoserverConfig.geoserverurl,
      username: geoserverConfig.geoserverUsername,
      password: geoserverConfig.geoserverPassword,
      host: databaseConfig.databaseHost,
      port: databaseConfig.databasePort,
      user: databaseConfig.databaseUsername,
      dbpassword: databaseConfig.databasePassword,
      database: databaseConfig.databaseDefaultDb
    };

    this.geoserverService.geoserverLayerList(ProjectPayload).subscribe({
      next: (response) => {
        this.datastorelist = response?.datastores || [];
        for (const ds of this.datastorelist) {
          for (const table of ds.tables) {
            const key = `${ds.name}.${table.name}`;
            if (!this.checkedTables[key]) {
              this.checkedTables[key] = {
                checked: false,
                bbox: table.bbox
              };
            }
          }
        }
        localStorage.setItem('checkedTables', JSON.stringify(this.checkedTables));
        this.loadAllLayers();
      },
      error: (err) => {
        console.error('Error fetching datastore list:', err);
        this.toastService.showError('Failed to fetch datastore list.');
      }
    });
  }
}
