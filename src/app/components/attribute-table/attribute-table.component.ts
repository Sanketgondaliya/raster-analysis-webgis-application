import { ChangeDetectorRef, Component, AfterViewInit, AfterViewChecked, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { TableModule } from 'primeng/table';
import { GeoserverService } from '../services/geoserver.service';
import { ToastService } from '../services/toast.service';
import { MapService } from '../services/map.service';
import { WKB } from 'ol/format';  // Import the WKB format for parsing

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
    this.getDatastoreList();
  }

  ngAfterViewInit() {
    // Ensure tabs are loaded after the component initializes
    if (this.tabsLoaded && this.tabs.length > 0) {
      // Set the first tab and table on initial load
      this.setInitialTabSelection();
      this.cdr.detectChanges(); // Trigger change detection manually to ensure updates are reflected
    }
  }

  ngAfterViewChecked() {
    if (this.tabsLoaded && this.tabs.length > 0 && !this.selectedTab) {
      // Ensure that if the tab is not selected, we select the first one
      this.setInitialTabSelection();
      this.cdr.detectChanges(); // Trigger change detection after setting the tab
    }
  }

  getDatastoreList(): void {
    if (!this.selectedProject) {
      this.toastService.showInfo('Please select a project first.');
      return;
    }

    this.geoserverService.geoserverDataStoreList(this.selectedProject).subscribe({
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
            tables: [] // Initialize tables array for each datastore
          }));

          // Fetch tables for each datastore
          this.tabs.forEach(tab => {
            this.fetchTablesForDatastore(tab);
          });
        }
      },
      error: (error) => {
        console.error('Error fetching datastores:', error);
        this.toastService.showError('Error fetching datastore list');
      }
    });
  }

  fetchTablesForDatastore(tab: any): void {
    this.geoserverService.getTables(this.selectedProject, tab.value).subscribe({
      next: (response) => {
        if (response.success) {
          // Map the tables, but exclude the "geom" column from the columns
          tab.tables = response.tables.map((table: any) => ({
            tableName: table.tableName,
            // Filter out the "geom" column from the columns array
            columns: Object.keys(table.data[0] || {}).filter((key) => key !== 'geom').map((key) => ({
              field: key,
              header: key
            })),
            // Keep the "geom" column in the data (without showing it in the table)
            data: table.data.map((row: any) => {
              const { geom, ...rest } = row; // Destructure to remove the "geom" field for display
              return { ...rest, geom }; // Keep the "geom" field for zoom functionality
            })
          }));

          // Mark tabs as loaded and apply change detection manually
          this.tabsLoaded = true;
          this.ngZone.run(() => {
            this.setInitialTabSelection();
            this.cdr.detectChanges(); // Ensure Angular triggers change detection
          });
        } else {
          this.errorMessage = response.message || `Failed to fetch tables for datastore ${tab.label}`;
        }
      },
      error: (err) => {
        this.errorMessage = err.message || `Error occurred while fetching tables for datastore ${tab.label}`;
      }
    });
  }

  // Method to zoom to feature when a row is clicked
  zoomToFeature(geom: any): void {
    if (!geom) {
      console.error('Geometry data is missing!');
      return;
    }

    const map = this.mapService.getMap();  // Use map service to get the map instance

    if (!map) {
      console.error('Map is not initialized.');
      return;
    }

    try {
      // Create a new WKB format object to read the WKB geometry
      const wkbFormat = new WKB();

      // Convert the WKB string to a feature
      const feature = wkbFormat.readFeature(geom, {
        dataProjection: 'EPSG:4326', // Ensure your geometry is in the right projection
        featureProjection: map.getView().getProjection()  // Use the map's projection for proper alignment
      });

      // Get the geometry of the feature
      const geometry = feature.getGeometry();

      // Check if geometry is undefined or invalid
      if (!geometry) {
        console.error('Feature geometry is undefined or invalid.');
        return;
      }

      const extent = geometry.getExtent();

      // Zoom to the feature's extent
      map.getView().fit(extent, {
        size: map.getSize(),
        padding: [50, 50, 50, 50], // Padding around the feature
        duration: 1000 // Animation duration in milliseconds
      });
    } catch (error) {
      console.error('Error parsing geometry or zooming to feature', error);
    }
  }

  // Set initial tab selection and ensure the first table is loaded
  setInitialTabSelection(): void {
    if (this.tabs.length > 0 && !this.selectedTab) {
      // Set the first tab and first table on initial load
      this.selectedTab = this.tabs[0].value;

      // Ensure the first table is selected for each datastore
      this.tabs.forEach(tab => {
        if (tab.tables.length > 0 && !this.selectedTableTab[tab.value]) {
          this.selectedTableTab[tab.value] = tab.tables[0].tableName;
        }
      });
    }
  }

  // Triggered when the datastore tab is changed
  onTabChange(value: string | number): void {
    this.selectedTab = String(value);
  }

  // Triggered when the table tab is changed within a datastore tab
  onTableTabChange(datastore: string, value: string | number): void {
    this.selectedTableTab[datastore] = String(value);
  }
}
