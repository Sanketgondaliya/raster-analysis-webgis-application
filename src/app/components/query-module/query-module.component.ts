import {
  ChangeDetectorRef,
  Component,
  AfterViewInit,
  AfterViewChecked,
  NgZone,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG Modules
import { TabsModule } from 'primeng/tabs';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';

// Services
import { GeoserverService } from '../../services/geoserver.service';
import { ToastService } from '../../services/toast.service';
import { MapService } from '../../services/map.service';

// OpenLayers
import { WKB } from 'ol/format';

interface Table {
  tableName: string;
  columns: { field: string; header: string }[];
  data: any[];
}

interface Tab {
  label: string;
  value: string;
  tables: Table[];
}

// interface Attribute {
//   label: string;
//   value: string;
// }

interface Condition {
  label: string;
  value: string;
}

@Component({
  selector: 'app-attribute-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TabsModule,
    TableModule,
    AutoCompleteModule,
    InputTextModule,
    ButtonModule,
    RippleModule,
    SelectModule

  ],
  templateUrl: './query-module.component.html',
  styleUrls: ['./query-module.component.scss']
})
export class QueryModuleComponent implements OnInit, AfterViewInit, AfterViewChecked {
  // Project and datastore related properties
  selectedProject: string = '';
  ProjectNameList: { label: string; value: string }[] = [];
  checkedTables: { [key: string]: { checked: boolean; bbox: any } } = {};

  // Tab management
  tabs: Tab[] = [];
  selectedTab: string = '';
  selectedTableTab: { [datastore: string]: string } = {};
  tabsLoaded: boolean = false;

  // Query related properties
  selectedTable: Table | null = null;
  selectedAttribute: any;
  selectedCondition: any;// | null = null;
  queryValue: string = '';
  attributes: any[] = [];
  conditions: Condition[] = [];
  valueInputType: string = 'text';
  filteredData: any[] = [];
  columnTypes: { [key: string]: string } = {};

  // Error handling
  errorMessage: string = '';

  constructor(
    private geoserverService: GeoserverService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private mapService: MapService
  ) {
    this.selectedProject = localStorage.getItem('selectedProject') || '';
  }

  ngOnInit(): void {
    const storedCheckedTables = localStorage.getItem('checkedTables');
    if (storedCheckedTables) {
      this.checkedTables = JSON.parse(storedCheckedTables);
    }
    this.getDatastoreList();
  }

  ngAfterViewInit(): void {
    if (this.tabsLoaded && this.tabs.length > 0) {
      this.setInitialTabSelection();
      this.cdr.detectChanges();
    }
  }

  ngAfterViewChecked(): void {
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

  fetchTablesForDatastore(tab: Tab): void {
    const geoserverConfig = JSON.parse(localStorage.getItem('geoserverConfig') || '{}');
    const databaseConfig = JSON.parse(localStorage.getItem('databaseConfig') || '{}');

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
          tab.tables = response.tables
            .filter((table: any) => {
              const key = `${tab.value}.${table.tableName}`;
              return this.checkedTables[key]?.checked;
            })
            .map((table: any) => ({
              tableName: table.tableName,
              columns: Object.keys(table.data[0] || {})
                .filter((key) => key !== 'geom')
                .map((key) => ({
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

  updateAttributes(): void {
    if (!this.selectedTable) return;

    this.attributes = this.selectedTable.columns.map((col) => ({
      label: col.header,
      value: col.field
    }));

    // Reset other fields
    this.selectedAttribute = null;
    this.selectedCondition = null;
    this.queryValue = '';
    this.conditions = [];
    this.valueInputType = 'text';
    this.filteredData = [];

    // Fetch column types for all columns in the table
    this.fetchColumnTypes();
  }

  fetchColumnTypes(): void {
    if (!this.selectedTable || !this.selectedTab) return;

    const geoserverConfig = JSON.parse(localStorage.getItem('geoserverConfig') || '{}');
    const databaseConfig = JSON.parse(localStorage.getItem('databaseConfig') || '{}');

    const payload = {
      projectName: this.selectedProject,
      geoserverurl: geoserverConfig.geoserverurl,
      username: geoserverConfig.geoserverUsername,
      password: geoserverConfig.geoserverPassword,
      host: databaseConfig.databaseHost,
      port: databaseConfig.databasePort,
      user: databaseConfig.databaseUsername,
      dbpassword: databaseConfig.databasePassword,
      database: databaseConfig.databaseDefaultDb,
      schemaName: this.selectedTab,
      tableName: this.selectedTable.tableName
    };

    this.geoserverService.getColumnTypes(payload).subscribe({
      next: (response) => {
        if (response.success) {
          this.columnTypes = response.columnTypes || {};
        }
      },
      error: (err) => {
        console.error('Error fetching column types:', err);
      }
    });
  }

  updateConditionOptions(): void {
    if (!this.selectedAttribute) return;
    const columnType = this.columnTypes[this.selectedAttribute]
    this.conditions = [];

    // More precise type detection
    const isNumeric = columnType.includes('int') ||
      columnType.includes('numeric') ||
      columnType.includes('decimal') ||
      columnType.includes('float') ||
      columnType.includes('double') ||
      columnType.includes('precision');

    const isDate = columnType.includes('date') || columnType.includes('time');

    if (isNumeric) {
      this.conditions = [
        { label: 'Equals', value: '=' },
        { label: 'Not equal', value: '!=' },
        { label: 'Greater than', value: '>' },
        { label: 'Less than', value: '<' },
        { label: 'Greater than or equal', value: '>=' },
        { label: 'Less than or equal', value: '<=' }
      ];
      this.valueInputType = 'number';
    }
    else if (isDate) {
      this.conditions = [
        { label: 'Equals', value: '=' },
        { label: 'Not equal', value: '!=' },
        { label: 'After', value: '>' },
        { label: 'Before', value: '<' },
        { label: 'On or after', value: '>=' },
        { label: 'On or before', value: '<=' }
      ];
      this.valueInputType = 'date';
    }
    else {
      this.conditions = [
        { label: 'Equals', value: '=' },
        { label: 'Not equal', value: '!=' },
        { label: 'Contains', value: 'contains' },
        { label: 'Starts with', value: 'startsWith' },
        { label: 'Ends with', value: 'endsWith' },
        { label: 'Is empty/null', value: 'isNull' },
        { label: 'Is not empty/null', value: 'isNotNull' }
      ];
      this.valueInputType = 'text';
    }

    this.selectedCondition = null;
    this.queryValue = '';
  }



  applyCqlFilterToLayer(): void {
    var me = this;
    debugger
    if (!this.selectedTable || !this.selectedTab || !this.selectedAttribute || !this.selectedCondition) return;

    const layerName = `${this.selectedTab}.${this.selectedTable.tableName}`;
    const map = this.mapService.getMap();

    if (!map) {
      console.error('Map is not initialized');
      return;
    }

    let cqlFilter: string | null = null;

    if (this.selectedCondition === 'isNull') {
      cqlFilter = `${this.selectedAttribute} IS NULL`;
    } else if (this.selectedCondition === 'isNotNull') {
      cqlFilter = `${this.selectedAttribute} IS NOT NULL`;
    } else if (this.queryValue) {
      switch (this.selectedCondition) {
        case '=':
          cqlFilter = `${this.selectedAttribute} = '${this.queryValue}'`;
          break;
        case '!=':
          cqlFilter = `NOT ${this.selectedAttribute} = '${this.queryValue}'`;
          break;
        case '>':
        case '<':
        case '>=':
        case '<=':
          cqlFilter = `${this.selectedAttribute}${this.selectedCondition}${parseFloat(this.queryValue)}`;
          break;
        case 'contains':
          cqlFilter = `${this.selectedAttribute} ILIKE '%${this.queryValue}%'`;
          break;
        case 'startsWith':
          cqlFilter = `${this.selectedAttribute} ILIKE '${this.queryValue}%'`;
          break;
        case 'endsWith':
          cqlFilter = `${this.selectedAttribute} ILIKE '%${this.queryValue}'`;
          break;
      }
    }

    this.mapService.updateLayerFilter(layerName, cqlFilter);
  }

  resetQuery(): void {
    this.selectedTable = null;
    this.selectedAttribute = null;
    this.selectedCondition = null;
    this.queryValue = '';
    this.attributes = [];
    this.conditions = [];
    this.valueInputType = 'text';
    this.filteredData = [];

    // Reset all layer filters
    this.mapService.resetAllLayerFilters();
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
    this.resetQuery();
  }

  onTableTabChange(datastore: string, value: string | number): void {
    this.selectedTableTab[datastore] = String(value);
  }
}