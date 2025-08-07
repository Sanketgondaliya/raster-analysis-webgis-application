import {
  ChangeDetectorRef,
  Component,
  AfterViewInit,
  AfterViewChecked,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { TableModule } from 'primeng/table';

import { GeoserverService } from '../services/geoserver.service';
import { ToastService } from '../services/toast.service';
import { MapService } from '../services/map.service';
import { WKB } from 'ol/format';

@Component({
  selector: 'app-attribute-table',
  standalone: true,
  imports: [CommonModule, TabsModule, TableModule],
  templateUrl: './attribute-table.component.html',
  styleUrls: ['./attribute-table.component.scss']
})
export class AttributeTableComponent implements AfterViewInit, AfterViewChecked {
  tables: any[] = [];
  errorMessage: string = '';
  selectedProject = '';
  ProjectNameList: { label: string; value: string }[] = [];
  checkedTables: { [key: string]: { checked: boolean; bbox: any } } = {};

  tabs: {
    label: string;
    value: string;
    tables: {
      tableName: string;
      columns: { field: string; header: string }[];
      data: any[];
    }[];
  }[] = [];

  selectedTab = '';
  selectedTableTab: { [datastore: string]: string } = {};
  tabsLoaded = false;

  constructor(
    private geoserverService: GeoserverService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private mapService: MapService
  ) {
    this.selectedProject = localStorage.getItem('selectedProject') || '';
  }

  ngOnInit() {
    const storedCheckedTables = localStorage.getItem('checkedTables');
    if (storedCheckedTables) {
      this.checkedTables = JSON.parse(storedCheckedTables);
    }
    this.getDatastoreList();
  }

  ngAfterViewInit() {
    if (this.tabsLoaded && this.tabs.length > 0) {
      this.setInitialTabSelection();
      this.cdr.detectChanges();
    }
  }

  ngAfterViewChecked() {
    if (this.tabsLoaded && this.tabs.length > 0 && !this.selectedTab) {
      this.setInitialTabSelection();
      this.cdr.detectChanges();
    }
  }

  getDatastoreList(): void {
    if (!this.selectedProject) {
      this.toastService.showInfo('Please select a project first.');
      return;
    }
    const geoserverConfig = JSON.parse(localStorage.getItem('geoserverConfig') || '{}');
    const databaseConfig = JSON.parse(localStorage.getItem('databaseConfig') || '{}');
    this.toastService.showSuccess('Project Created!');
    const ProjectPayload = {
      projectName: this.selectedProject,
      geoserverurl: geoserverConfig.geoserverurl,
      username: geoserverConfig.geoserverUsername,
      password: geoserverConfig.geoserverPassword,
      host: databaseConfig.databaseHost,
      port: databaseConfig.databasePort,
      user: databaseConfig.databaseUsername,
      dbpassword: databaseConfig.databasePassword,
      database: databaseConfig.databaseDefaultDb
    };
    this.geoserverService.geoserverDataStoreList(ProjectPayload).subscribe({
      next: (response) => {
        const dataStores = response?.dataStores?.dataStore || [];

        if (dataStores.length === 0) {
          this.ProjectNameList = [];
          this.toastService.showInfo('No datastores found. Please create one.');
          localStorage.removeItem('selectedDataStore');
        } else {
          this.ProjectNameList = dataStores.map((ds: any) => ({
            label: ds.name,
            value: ds.name
          }));

          this.tabs = dataStores.map((ds: any) => ({
            label: ds.name,
            value: ds.name,
            tables: []
          }));

          this.tabs.forEach(tab => this.fetchTablesForDatastore(tab));
        }
      },
      error: (error) => {
        console.error('Error fetching datastores:', error);
        this.toastService.showError('Error fetching datastore list');
      }
    });
  }

  fetchTablesForDatastore(tab: any): void {
    const geoserverConfig = JSON.parse(localStorage.getItem('geoserverConfig') || '{}');
    const databaseConfig = JSON.parse(localStorage.getItem('databaseConfig') || '{}');
    this.toastService.showSuccess('Project Created!');
    const ProjectPayload = {
      projectName: this.selectedProject,
      geoserverurl: geoserverConfig.geoserverurl,
      username: geoserverConfig.geoserverUsername,
      password: geoserverConfig.geoserverPassword,
      host: databaseConfig.databaseHost,
      port: databaseConfig.databasePort,
      user: databaseConfig.databaseUsername,
      dbpassword: databaseConfig.databasePassword,
      database: databaseConfig.databaseDefaultDb,
      schemaName: tab.value,
      dbName: this.selectedProject
    };
    this.geoserverService.getTables(ProjectPayload).subscribe({
      next: (response) => {
        if (response.success) {
          debugger
          tab.tables = response.tables
            .filter((table: any) => {
              const key = `${tab.value}.${table.tableName}`;
              return this.checkedTables[key]?.checked;
            })
            .map((table: any) => ({
              tableName: table.tableName,
              columns: Object.keys(table.data[0] || {}).filter((key) => key !== 'geom').map((key) => ({
                field: key,
                header: key
              })),
              data: table.data.map((row: any) => {
                const { geom, ...rest } = row;
                return { ...rest, geom };
              })
            }));

          this.tabsLoaded = true;
          this.ngZone.run(() => {
            this.setInitialTabSelection();
            this.cdr.detectChanges();
          });
        } else {
          this.errorMessage = response.message || `Failed to fetch tables for ${tab.label}`;
        }
      },
      error: (err) => {
        this.errorMessage = err.message || `Error fetching tables for ${tab.label}`;
      }
    });
  }

  zoomToFeature(geom: any): void {
    if (!geom) {
      console.error('Missing geometry');
      return;
    }

    const map = this.mapService.getMap();
    if (!map) {
      console.error('Map is not initialized');
      return;
    }

    try {
      const wkbFormat = new WKB();
      const feature = wkbFormat.readFeature(geom, {
        dataProjection: 'EPSG:4326',
        featureProjection: map.getView().getProjection()
      });

      const geometry = feature.getGeometry();
      if (!geometry) {
        console.error('Invalid geometry');
        return;
      }

      const extent = geometry.getExtent();
      map.getView().fit(extent, {
        size: map.getSize(),
        padding: [50, 50, 50, 50],
        duration: 1000
      });
    } catch (error) {
      console.error('Error zooming to feature:', error);
    }
  }

  setInitialTabSelection(): void {
    if (this.tabs.length > 0 && !this.selectedTab) {
      this.selectedTab = this.tabs[0].value;

      this.tabs.forEach(tab => {
        if (tab.tables.length > 0 && !this.selectedTableTab[tab.value]) {
          this.selectedTableTab[tab.value] = tab.tables[0].tableName;
        }
      });
    }
  }

  onTabChange(value: string | number): void {
    this.selectedTab = String(value);
  }

  onTableTabChange(datastore: string, value: string | number): void {
    this.selectedTableTab[datastore] = String(value);
  }
}
