import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { FileUploadModule } from 'primeng/fileupload';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';

import { DividerModule } from 'primeng/divider';

import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { Geometry } from 'ol/geom';
import { Fill, Stroke, Style, Circle } from 'ol/style';
import Draw, { DrawEvent, createBox } from 'ol/interaction/Draw';

import Modify from 'ol/interaction/Modify';
import Select from 'ol/interaction/Select';
import * as olEventsCondition from 'ol/events/condition';
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import { GeoJSON, KML, GPX } from 'ol/format';
import { getArea, getLength } from 'ol/sphere';
import { MapService } from '../../services/map.service';
import { VectorDataService } from '../../services/vector-data.service';

import MultiPoint from 'ol/geom/MultiPoint';
import MultiLineString from 'ol/geom/MultiLineString';
import MultiPolygon from 'ol/geom/MultiPolygon';


enum GeometryType {
  POINT = 'Point',
  LINE_STRING = 'LineString',
  POLYGON = 'Polygon',
  MULTI_POINT = 'MultiPoint',
  MULTI_LINE_STRING = 'MultiLineString',
  MULTI_POLYGON = 'MultiPolygon',
  CIRCLE = 'Circle',
  RECTANGLE = 'Rectangle'
}

@Component({
  selector: 'app-vector-data-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FileUploadModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    ToastModule,
    TabsModule,
    CardModule,
    ProgressBarModule,
    DividerModule
  ],
  templateUrl: './vector-data-management.component.html',
  styleUrls: ['./vector-data-management.component.scss'],
  providers: [MessageService]
})
export class VectorDataManagementComponent implements OnInit, OnDestroy {
  map!: Map;
  vectorSource: VectorSource = new VectorSource();
  vectorLayer!: VectorLayer<VectorSource>;
  draw!: Draw;
  modify!: Modify;
  select!: Select;

  activeTabIndex: number = 0;
  drawingType: string = '';
  isDrawing: boolean = false;
  displayAttributeDialog: boolean = false;
  selectedFeature: Feature | null = null;
  attributeData: any = {};

  uploadedFiles: File[] = [];
  uploadProgress: number = 0;
  isUploading: boolean = false;

  vectorLayers: any[] = [];
  selectedLayer: any = null;
  multiFeatures: Feature[] = [];


  defaultValue: any = '';
  layerStyles: any = {
    point: new Style({
      image: new Circle({
        radius: 7,
        fill: new Fill({ color: 'red' }),
        stroke: new Stroke({ color: 'white', width: 2 })
      })
    }),
    line: new Style({
      stroke: new Stroke({
        color: 'blue',
        width: 3
      })
    }),
    polygon: new Style({
      fill: new Fill({
        color: 'rgba(0, 255, 0, 0.2)'
      }),
      stroke: new Stroke({
        color: 'green',
        width: 2
      })
    })
  };

  acceptedFileTypes = '.shp,.kml,.gpx,.geojson,.json,.zip';

  // Dynamic attribute management
  attributeTemplates: any[] = [
    { name: 'name', type: 'string', label: 'Name' },
    { name: 'description', type: 'string', label: 'Description' },
    { name: 'type', type: 'string', label: 'Type' }
  ];

  dataTypes: any[] = [
    { label: 'Text', value: 'string' },
    { label: 'Number', value: 'number' },
    { label: 'Boolean', value: 'boolean' },
    { label: 'Date', value: 'date' }
  ];

  newAttributeName: string = '';
  newAttributeValue: string = '';

  constructor(
    private mapService: MapService,
    private vectorDataService: VectorDataService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.initializeMap();
    this.setupInteractions();

    // Load saved attribute templates if any
    this.loadAttributeTemplates();
  }

  ngOnDestroy(): void {
    this.cleanUpInteractions();
  }

  initializeMap(): void {
    this.map = this.mapService.getMap();

    this.vectorLayer = new VectorLayer({
      source: this.vectorSource,
      style: (feature) => {
        return this.getStyleForFeature(feature as Feature);
      }
    });

    this.map.addLayer(this.vectorLayer);
  }

  getStyleForFeature(feature: Feature): Style {
    const geometry = feature.getGeometry();
    const type = geometry?.getType();

    const customStyle = feature.get('style');
    if (customStyle) return customStyle;

    if (type === 'Point' || type === 'MultiPoint') {
      return this.layerStyles.point;
    } else if (type === 'LineString' || type === 'MultiLineString') {
      return this.layerStyles.line;
    } else if (type === 'Polygon' || type === 'MultiPolygon') {
      return this.layerStyles.polygon;
    }

    return new Style({
      fill: new Fill({ color: 'rgba(255, 0, 0, 0.2)' }),
      stroke: new Stroke({ color: 'red', width: 2 })
    });
  }

  setupInteractions(): void {
    this.modify = new Modify({
      source: this.vectorSource
    });
    this.map.addInteraction(this.modify);
    this.modify.setActive(false);

    this.select = new Select({
      condition: olEventsCondition.click,
      style: (feature) => {
        const style = this.getStyleForFeature(feature as Feature);
        const imageStyle = style.getImage();
        const strokeStyle = style.getStroke();

        if (imageStyle && imageStyle instanceof Circle) {
          const circleFill = imageStyle.getFill();
          return new Style({
            image: new Circle({
              radius: imageStyle.getRadius() + 2,
              fill: circleFill ? circleFill : undefined,
              stroke: new Stroke({ color: 'yellow', width: 3 })
            })
          });
        } else if (strokeStyle) {
          const strokeWidth = strokeStyle.getWidth() || 1;
          const fillStyle = style.getFill();
          return new Style({
            stroke: new Stroke({
              color: 'yellow',
              width: strokeWidth + 2
            }),
            fill: fillStyle ? fillStyle : undefined
          });
        }
        return style;
      }
    });
    this.map.addInteraction(this.select);

    this.select.on('select', (event) => {
      if (event.selected.length > 0) {
        this.selectedFeature = event.selected[0] as Feature;
        this.attributeData = { ...this.selectedFeature.getProperties() };
        delete this.attributeData.geometry;
        delete this.attributeData.style;
      } else {
        this.selectedFeature = null;
        this.attributeData = {};
      }
    });
  }

  cleanUpInteractions(): void {
    if (this.draw) this.map.removeInteraction(this.draw);
    if (this.modify) this.map.removeInteraction(this.modify);
    if (this.select) this.map.removeInteraction(this.select);
  }

  startDrawing(type: string): void {
    this.cleanUpInteractions();
    this.drawingType = type;
    this.isDrawing = true;

    let geometryType: GeometryType | 'Circle' = GeometryType.POINT;

    switch (type) {
      case 'point': geometryType = GeometryType.POINT; break;
      case 'multiPoint': geometryType = GeometryType.MULTI_POINT; break;
      case 'line': geometryType = GeometryType.LINE_STRING; break;
      case 'multiLine': geometryType = GeometryType.MULTI_LINE_STRING; break;
      case 'polygon': geometryType = GeometryType.POLYGON; break;
      case 'multiPolygon': geometryType = GeometryType.MULTI_POLYGON; break;
      case 'circle': geometryType = 'Circle'; break;
      case 'rectangle': geometryType = 'Circle'; break;
      default: return;
    }

    const drawOptions: any = {
      source: this.vectorSource,
      type: geometryType,
      style: this.getDrawingStyle(type)
    };

    if (type === 'rectangle') {
      drawOptions.geometryFunction = createBox();
    }

    this.draw = new Draw(drawOptions);
    this.map.addInteraction(this.draw);

    this.draw.on('drawend', (event: DrawEvent) => {
      if (['multiPoint', 'multiLine', 'multiPolygon'].includes(type)) {
        // Collect the drawn feature but don't stop immediately
        this.multiFeatures.push(event.feature);

        // Allow user to keep drawing until they click "Stop"
        setTimeout(() => this.startDrawing(type), 50);
      } else {
        // Single geometry → finish normally
        this.featureDrawn(event.feature);
        this.isDrawing = false;
      }
    });

  }

  getDrawingStyle(type: string): Style {
    switch (type) {
      case 'point':
      case 'multiPoint':
        return new Style({
          image: new Circle({
            radius: 7,
            fill: new Fill({ color: 'rgba(255, 0, 0, 0.5)' }),
            stroke: new Stroke({ color: 'red', width: 2 })
          })
        });
      case 'line':
      case 'multiLine':
        return new Style({
          stroke: new Stroke({
            color: 'rgba(0, 0, 255, 0.5)',
            width: 3
          })
        });
      case 'polygon':
      case 'multiPolygon':
        return new Style({
          fill: new Fill({ color: 'rgba(0, 255, 0, 0.2)' }),
          stroke: new Stroke({ color: 'green', width: 2 })
        });
      case 'circle':
      case 'rectangle':
        return new Style({
          fill: new Fill({ color: 'rgba(255, 165, 0, 0.2)' }),
          stroke: new Stroke({ color: 'orange', width: 2 })
        });
      default:
        return new Style();
    }
  }

  featureDrawn(feature: Feature): void {
    // Set default values from attribute templates
    this.attributeTemplates.forEach(template => {
      if (!feature.get(template.name)) {
        let defaultValue: string | number | boolean = '';

        switch (template.type) {
          case 'number': defaultValue = 0; break;
          case 'boolean': defaultValue = false; break;
          case 'date': defaultValue = new Date().toISOString(); break;
          default: defaultValue = ''; break;
        }

        feature.set(template.name, defaultValue);
      }
    });


    // Calculate geometry properties
    const geometry = feature.getGeometry();
    if (geometry instanceof Polygon) {
      const area = getArea(geometry);
      feature.set('area', area);
      feature.set('area_km2', (area / 1_000_000).toFixed(2));
    } else if (geometry instanceof LineString) {
      const length = getLength(geometry);
      feature.set('length', length);
      feature.set('length_km', (length / 1000).toFixed(2));
    }

    this.selectedFeature = feature;
    this.attributeData = { ...feature.getProperties() };
    delete this.attributeData.geometry;
    delete this.attributeData.style;

    this.displayAttributeDialog = true;
    this.map.removeInteraction(this.draw);
    this.setupInteractions();
  }

  cancelDrawing(): void {
    if (this.draw) {
      this.map.removeInteraction(this.draw);
      this.draw = undefined as any;
    }
    this.isDrawing = false;
    this.drawingType = '';
    this.setupInteractions();
  }

  toggleDrawing(type: string): void {
    if (this.isDrawing && this.drawingType === type) {
      // User clicked stop → finalize multi features
      if (['multiPoint', 'multiLine', 'multiPolygon'].includes(type)) {
        this.finishMultiDrawing(type);
      } else {
        this.cancelDrawing();
      }
    } else {
      // Start new drawing
      this.multiFeatures = [];
      this.startDrawing(type);
    }
  }

  finishMultiDrawing(type: string): void {
  if (this.multiFeatures.length === 0) {
    this.cancelDrawing();
    return;
  }

  let geometry: Geometry | null = null;

  if (type === 'multiPoint') {
    const coords = this.multiFeatures.map(f => (f.getGeometry() as any).getCoordinates());
    geometry = new MultiPoint(coords);
  } else if (type === 'multiLine') {
    const coords = this.multiFeatures.map(f => (f.getGeometry() as any).getCoordinates());
    geometry = new MultiLineString(coords);
  } else if (type === 'multiPolygon') {
    const coords = this.multiFeatures.map(f => (f.getGeometry() as any).getCoordinates());
    geometry = new MultiPolygon(coords);
  }

  if (geometry) {
    const feature = new Feature({ geometry });
    this.vectorSource.addFeature(feature);
    this.featureDrawn(feature); // ✅ Opens Edit Attributes dialog
  }

  this.multiFeatures = [];
  this.isDrawing = false;
  this.drawingType = '';
  this.setupInteractions();
}

  // Get all property keys from a feature (excluding geometry and style)
  getFeaturePropertyKeys(feature: Feature): string[] {
    const properties = feature.getProperties();
    return Object.keys(properties).filter(key =>
      key !== 'geometry' && key !== 'style' && !key.startsWith('_')
    );
  }

  // Open attribute dialog with current feature properties
  openAttributeDialog(): void {
    if (this.selectedFeature) {
      // Get all properties except geometry and style
      this.attributeData = { ...this.selectedFeature.getProperties() };
      delete this.attributeData.geometry;
      delete this.attributeData.style;

      this.displayAttributeDialog = true;
    }
  }

  // Add a new attribute to the feature

  addNewAttribute(): void {
    if (this.newAttributeName && this.newAttributeValue) {
      // Add to the attributeData object
      this.attributeData[this.newAttributeName] = this.newAttributeValue;

      // Clear the input fields
      this.newAttributeName = '';
      this.newAttributeValue = '';

      // Create a new reference to trigger change detection
      this.attributeData = { ...this.attributeData };
    }

  }

  // Save all attributes (including new ones)
  saveAttributes(): void {
    if (this.selectedFeature) {
      // Remove geometry and style from attribute data before setting
      const attributesToSave = { ...this.attributeData };
      delete attributesToSave.geometry;
      delete attributesToSave.style;

      // Set all properties
      for (const key in attributesToSave) {
        if (attributesToSave.hasOwnProperty(key)) {
          this.selectedFeature.set(key, attributesToSave[key]);
        }
      }

      this.selectedFeature.changed();

      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Attributes saved successfully'
      });
    }
    this.displayAttributeDialog = false;
  }

  // Attribute template management
  addAttributeTemplate(): void {
    this.attributeTemplates.push({ name: '', type: 'string', label: '' });
  }

  removeAttributeTemplate(index: number): void {
    this.attributeTemplates.splice(index, 1);
  }

  saveAttributeTemplates(): void {
    // Save to localStorage or backend
    localStorage.setItem('attributeTemplates', JSON.stringify(this.attributeTemplates));

    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Attribute templates saved'
    });
  }

  loadAttributeTemplates(): void {
    const savedTemplates = localStorage.getItem('attributeTemplates');
    if (savedTemplates) {
      this.attributeTemplates = JSON.parse(savedTemplates);
    }
  }

  toggleEditMode(): void {
    if (this.modify) {
      const isActive = this.modify.getActive();
      this.modify.setActive(!isActive);

      this.messageService.add({
        severity: 'info',
        summary: isActive ? 'Edit Mode Off' : 'Edit Mode On',
        detail: isActive ? 'Editing disabled' : 'You can now edit features'
      });
    }
  }

  deleteSelectedFeature(): void {
    if (this.selectedFeature) {
      this.vectorSource.removeFeature(this.selectedFeature);
      this.selectedFeature = null;
      this.attributeData = {};

      this.messageService.add({
        severity: 'warn',
        summary: 'Deleted',
        detail: 'Feature deleted successfully'
      });
    }
  }

  onFileUpload(event: any): void {
    this.uploadedFiles = event.files;

    const files = event.files;
    if (files && files.length > 0) {
      const file = files[0];
      this.handleFileImport(file);
    }
  }

  handleFileImport(file: File): void {
    const fileName = file.name.toLowerCase();

    let format;
    if (fileName.endsWith('.kml')) {
      format = new KML();
    } else if (fileName.endsWith('.gpx')) {
      format = new GPX();
    } else if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
      format = new GeoJSON();
    } else if (fileName.endsWith('.zip')) {
      this.importShapefile(file);
      return;
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Unsupported file format'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const features = format.readFeatures(e.target.result, {
          dataProjection: 'EPSG:4326',
          featureProjection: this.map.getView().getProjection()
        });

        if (features.length > 0) {
          features.forEach((feature: Feature) => {
            const geometry = feature.getGeometry();
            if (geometry) {
              const type = geometry.getType();
              if (type === 'Point' || type === 'MultiPoint') {
                feature.setStyle(this.layerStyles.point);
              } else if (type === 'LineString' || type === 'MultiLineString') {
                feature.setStyle(this.layerStyles.line);
              } else if (type === 'Polygon' || type === 'MultiPolygon') {
                feature.setStyle(this.layerStyles.polygon);
              }
            }
            // Preserve all original properties from the imported file
          });

          this.vectorSource.addFeatures(features);
          const extent = this.vectorSource.getExtent();
          if (extent && extent[0] !== Infinity) {
            this.map.getView().fit(extent, { padding: [50, 50, 50, 50] });
          }
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `Imported ${features.length} features from ${file.name}`
          });
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: 'No Features',
            detail: 'The file does not contain any valid features'
          });
        }
      } catch (error) {
        console.error('Error parsing vector file:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to parse the vector file'
        });
      }
    };
    reader.readAsText(file);
  }

  importShapefile(file: File): void {
    this.isUploading = true;
    this.uploadProgress = 0;

    const progressInterval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += 10;
      }
    }, 300);

    this.vectorDataService.uploadShapefile(file).subscribe({
      next: (response: any) => {
        clearInterval(progressInterval);
        this.uploadProgress = 100;

        if (response.success && response.geoJSON && response.geoJSON.features) {
          const format = new GeoJSON();

          const possibleProjections = [
            'EPSG:32643', // UTM Zone 43N (based on your coordinates)
            'EPSG:4326',  // WGS84
            'EPSG:3857'   // Web Mercator
          ];

          let features: Feature[] = [];
          let projectionFound = false;

          // Try different projections
          for (const proj of possibleProjections) {
            try {
              features = format.readFeatures(response.geoJSON, {
                dataProjection: proj,
                featureProjection: this.map.getView().getProjection()
              });

              if (features.length > 0) {
                projectionFound = true;
                console.log(`Successfully read features with projection: ${proj}`);
                break;
              }
            } catch (error) {
              console.warn(`Failed with projection ${proj}:`, error);
              continue;
            }
          }

          if (!projectionFound) {
            // Fallback: try without specifying data projection
            try {
              features = format.readFeatures(response.geoJSON, {
                featureProjection: this.map.getView().getProjection()
              });
            } catch (error) {
              console.error('Failed to read features with any projection:', error);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Could not parse the uploaded file'
              });
              this.isUploading = false;
              return;
            }
          }

          // Apply styles
          features.forEach((feature: Feature) => {
            const geometry = feature.getGeometry();
            if (geometry) {
              const type = geometry.getType();
              if (type === 'Point' || type === 'MultiPoint') {
                feature.setStyle(this.layerStyles.point);
              } else if (type === 'LineString' || type === 'MultiLineString') {
                feature.setStyle(this.layerStyles.line);
              } else if (type === 'Polygon' || type === 'MultiPolygon') {
                feature.setStyle(this.layerStyles.polygon);
              }
            }
          });

          this.vectorSource.addFeatures(features);

          // Zoom to extent
          const extent = this.vectorSource.getExtent();
          if (extent && extent[0] !== Infinity && extent[1] !== Infinity) {
            this.map.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 18 });
          }

          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `Imported ${features.length} features from shapefile`
          });

          // Debug output
          console.log('Imported features:', features);

        }
        this.isUploading = false;
      },
      error: (error: any) => {
        clearInterval(progressInterval);
        this.isUploading = false;
        console.error('Error importing shapefile:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to import shapefile: ' + (error.message || 'Unknown error')
        });
      }
    });
  }

  exportData(format: string): void {
    const features = this.vectorSource.getFeatures();
    if (features.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No Data',
        detail: 'There are no features to export'
      });
      return;
    }

    // Clone features and transform coordinates to WGS84 for export
    const featuresToExport = features.map(feature => {
      const clonedFeature = feature.clone();
      const geometry = clonedFeature.getGeometry();

      if (geometry) {
        // Transform geometry to WGS84
        geometry.transform('EPSG:3857', 'EPSG:4326');
      }

      return clonedFeature;
    });

    let writer, output, mimeType, extension;
    if (format === 'geojson') {
      writer = new GeoJSON();
      output = writer.writeFeatures(featuresToExport);
      mimeType = 'application/json';
      extension = 'geojson';
    } else if (format === 'kml') {
      writer = new KML();
      output = writer.writeFeatures(featuresToExport);
      mimeType = 'application/vnd.google-earth.kml+xml';
      extension = 'kml';
    } else if (format === 'gpx') {
      writer = new GPX();
      output = writer.writeFeatures(featuresToExport);
      mimeType = 'application/gpx+xml';
      extension = 'gpx';
    } else {
      return;
    }

    const blob = new Blob([output], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vector_data.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.messageService.add({
      severity: 'success',
      summary: 'Exported',
      detail: `Data exported as ${extension.toUpperCase()}`
    });
  }

  clearAllData(): void {
    this.vectorSource.clear();
    this.selectedFeature = null;
    this.attributeData = {};
    this.messageService.add({
      severity: 'info',
      summary: 'Cleared',
      detail: 'All vector data has been cleared'
    });
  }

  // Debug method to check what's loaded
  debugFeatures(): void {
    const features = this.vectorSource.getFeatures();
    console.log('Current features in source:', features.length);
    console.log('Source extent:', this.vectorSource.getExtent());

    features.forEach((feature, index) => {
      const geometry = feature.getGeometry();
      console.log(`Feature ${index}:`, {
        type: geometry?.getType(),
        properties: feature.getProperties()
      });
    });
  }
}