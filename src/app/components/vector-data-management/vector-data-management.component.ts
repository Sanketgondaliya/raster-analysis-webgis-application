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
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { Geometry } from 'ol/geom';
import { Fill, Stroke, Style, Circle } from 'ol/style';
import Draw, { DrawEvent } from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Select from 'ol/interaction/Select';
import * as olEventsCondition from 'ol/events/condition';
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import { GeoJSON, KML, GPX } from 'ol/format';
import { getArea, getLength } from 'ol/sphere';
import { transform } from 'ol/proj';

import { MapService } from '../../services/map.service';
import { VectorDataService } from '../../services/vector-data.service';

enum GeometryType {
  POINT = 'Point',
  LINE_STRING = 'LineString',
  POLYGON = 'Polygon',
  MULTI_POINT = 'MultiPoint',
  MULTI_LINE_STRING = 'MultiLineString',
  MULTI_POLYGON = 'MultiPolygon',
  CIRCLE = 'Circle'
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
    ProgressBarModule
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

  attributeFields: any[] = [
    { name: 'name', type: 'string', label: 'Name' },
    { name: 'description', type: 'string', label: 'Description' },
    { name: 'type', type: 'string', label: 'Type' }
  ];

  constructor(
    private mapService: MapService,
    private vectorDataService: VectorDataService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.initializeMap();
    this.setupInteractions();
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

    let geometryType: GeometryType;
    switch (type) {
      case 'point':
        geometryType = GeometryType.POINT;
        break;
      case 'line':
        geometryType = GeometryType.LINE_STRING;
        break;
      case 'polygon':
        geometryType = GeometryType.POLYGON;
        break;
      default:
        return;
    }

    this.draw = new Draw({
      source: this.vectorSource,
      type: geometryType as any,
      style: this.getDrawingStyle(type)
    });

    this.map.addInteraction(this.draw);

    this.draw.on('drawend', (event: DrawEvent) => {
      this.isDrawing = false;
      this.featureDrawn(event.feature);
    });
  }

  getDrawingStyle(type: string): Style {
    switch (type) {
      case 'point':
        return new Style({
          image: new Circle({
            radius: 7,
            fill: new Fill({ color: 'rgba(255, 0, 0, 0.5)' }),
            stroke: new Stroke({ color: 'red', width: 2 })
          })
        });
      case 'line':
        return new Style({
          stroke: new Stroke({
            color: 'rgba(0, 0, 255, 0.5)',
            width: 3
          })
        });
      case 'polygon':
        return new Style({
          fill: new Fill({
            color: 'rgba(0, 255, 0, 0.2)'
          }),
          stroke: new Stroke({
            color: 'green',
            width: 2
          })
        });
      default:
        return new Style();
    }
  }

  featureDrawn(feature: Feature): void {
    feature.set('name', `New ${this.drawingType}`);
    feature.set('description', '');
    feature.set('type', this.drawingType);

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

    this.displayAttributeDialog = true;
    this.map.removeInteraction(this.draw);
    this.setupInteractions();
  }

  cancelDrawing(): void {
    this.isDrawing = false;
    if (this.draw) {
      this.map.removeInteraction(this.draw);
    }
    this.setupInteractions();
  }

  saveAttributes(): void {
    if (this.selectedFeature) {
      for (const key in this.attributeData) {
        if (this.attributeData.hasOwnProperty(key)) {
          this.selectedFeature.set(key, this.attributeData[key]);
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
        
        // FIXED: Check the correct response structure
        if (response.success && response.geoJSON && response.geoJSON.features) {
          const format = new GeoJSON();
          
          // FIXED: Handle different projections - your data appears to be in UTM
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

    let writer, output, mimeType, extension;
    if (format === 'geojson') {
      writer = new GeoJSON();
      output = writer.writeFeatures(features);
      mimeType = 'application/json';
      extension = 'geojson';
    } else if (format === 'kml') {
      writer = new KML();
      output = writer.writeFeatures(features);
      mimeType = 'application/vnd.google-earth.kml+xml';
      extension = 'kml';
    } else if (format === 'gpx') {
      writer = new GPX();
      output = writer.writeFeatures(features);
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