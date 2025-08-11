import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { FileUploadModule } from 'primeng/fileupload';
import { ButtonModule } from 'primeng/button';

import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style } from 'ol/style';
import { Select } from 'primeng/select';
import { MapService } from '../../services/map.service';
import { GeoserverService } from '../../services/geoserver.service';
import { ToastService } from '../../services/toast.service';
import { Router } from '@angular/router';
import * as GeoTIFF from 'geotiff';

import Draw, { createBox } from 'ol/interaction/Draw';
import Polygon from 'ol/geom/Polygon';
import { toLonLat, transformExtent } from 'ol/proj';

import { HttpClient } from '@angular/common/http';
import { saveAs } from 'file-saver';
import { RasterAnalysisService } from '../../services/rasteranalysis.service';
import ImageLayer from 'ol/layer/Image';
import Static from 'ol/source/ImageStatic';
@Component({
  selector: 'app-raster-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, TabsModule, Select, FileUploadModule, ButtonModule],
  templateUrl: './raster-analysis.component.html',
  styleUrls: ['./raster-analysis.component.scss'],
})
export class RasterAnalysisComponent implements OnInit, AfterViewInit, OnDestroy {
  demFile: File | null = null;
  demAnalysisTypes = [
    { label: 'Elevation at Point', value: 'point' },
    { label: 'Elevation Profile', value: 'profile' },
    { label: 'Slope Map', value: 'slope' },
    { label: 'Aspect Map', value: 'aspect' },
    { label: 'Hillshade', value: 'hillshade' },
    { label: 'Watershed', value: 'watershed' },
  ];
  demTypes = [
    { label: 'SRTMGL1 (30m)', value: 'SRTMGL1' },
    { label: 'SRTMGL3 (90m)', value: 'SRTMGL3' },
    { label: 'AW3D30 (30m)', value: 'AW3D30' },
    { label: 'COP30 (30m)', value: 'COP30' },
  ];
colorRamps = [
  { label: 'Grayscale', value: 'grayscale' },
  { label: 'Terrain (ArcGIS)', value: 'terrain' },
  { label: 'Elevation (Topographic)', value: 'elevation' },
  { label: 'NDVI (Vegetation)', value: 'ndvi' },
  { label: 'Viridis', value: 'viridis' },
  { label: 'Plasma', value: 'plasma' },
  { label: 'DEM Standard', value: 'dem' },
  { label: 'Thermal', value: 'thermal' }
];
  selectedDemType: string = 'SRTMGL1';
  selectedColorRamp: string = 'grayscale';

  selectedDemAnalysis: string | null = null;

  map!: Map;
  draw!: Draw;
  vectorSource = new VectorSource();
  vectorLayer!: VectorLayer;

  bbox: number[] | null = null;


  constructor(
    private mapService: MapService,
    private geoserverService: GeoserverService,
    private toastService: ToastService,
    private router: Router,
    private http: HttpClient,
    private rasterService: RasterAnalysisService
  ) { }
  reRenderDEM() {
    if (this.demFile) {
      this.visualizeTiff(this.demFile);
    }
  }

  ngOnInit(): void { }


applyColorRamp(value: number, ramp: string): [number, number, number] {
  // Normalize value between 0 and 1
  const normValue = Math.max(0, Math.min(1, value));
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

  // Declare gray variable once at the start
  let gray: number;

  switch (ramp) {
    // Elevation/Topographic
    case 'elevation':
      if (normValue < 0.1) return [0, 77, 168];       // Deep water
      if (normValue < 0.2) return [0, 112, 255];      // Shallow water
      if (normValue < 0.3) return [191, 242, 255];    // Shoreline
      if (normValue < 0.4) return [85, 170, 0];       // Lowlands (green)
      if (normValue < 0.5) return [139, 139, 0];      // Plains (yellow-green)
      if (normValue < 0.6) return [180, 140, 50];     // Hills (brown)
      if (normValue < 0.7) return [150, 100, 50];     // Mountains (dark brown)
      if (normValue < 0.8) return [130, 80, 40];      // High mountains
      if (normValue < 0.9) return [100, 60, 30];      // Higher mountains
      return [255, 255, 255];                         // Snow caps

    // Terrain (similar to ArcGIS Terrain)
    case 'terrain':
      if (normValue < 0.2) return [51, 102, 153];     // Deep water
      if (normValue < 0.3) return [86, 153, 204];     // Shallow water
      if (normValue < 0.4) return [171, 205, 227];    // Wetlands
      if (normValue < 0.5) return [191, 191, 127];    // Lowlands
      if (normValue < 0.6) return [166, 166, 97];     // Plains
      if (normValue < 0.7) return [153, 140, 66];     // Hills
      if (normValue < 0.8) return [140, 115, 51];     // Mountains
      if (normValue < 0.9) return [115, 89, 38];      // High mountains
      return [179, 179, 179];                         // Snow

    // NDVI (Vegetation index)
    case 'ndvi':
      if (normValue < 0.2) return [165, 0, 38];       // Red - No vegetation
      if (normValue < 0.4) return [215, 48, 39];      // Light red
      if (normValue < 0.5) return [244, 109, 67];     // Orange
      if (normValue < 0.6) return [253, 174, 97];     // Light orange
      if (normValue < 0.7) return [254, 224, 139];    // Yellow
      if (normValue < 0.8) return [217, 239, 139];    // Light green
      if (normValue < 0.9) return [166, 217, 106];    // Medium green
      return [102, 189, 99];                          // Dark green - Dense vegetation

    // Viridis (perceptually uniform)
    case 'viridis':
      return [
        clamp(68 + normValue * 187),
        clamp(1 + normValue * 254),
        clamp(84 + (1 - normValue) * 171)
      ];

    // Plasma (another perceptually uniform)
    case 'plasma':
      return [
        clamp(13 + normValue * 242),
        clamp(8 + (1 - Math.pow(normValue - 0.5, 2)) * 247),
        clamp(135 + (1 - normValue) * 120)
      ];

    // Grayscale
    case 'grayscale':
      gray = clamp(normValue * 255);
      return [gray, gray, gray];

    // DEM (standard elevation)
    case 'dem':
      if (normValue < 0.25) return [0, 0, 255];       // Blue - water
      if (normValue < 0.5) return [0, 255, 0];        // Green - lowlands
      if (normValue < 0.75) return [165, 42, 42];     // Brown - mountains
      return [255, 255, 255];                         // White - snow

    // Thermal (heat map)
    case 'thermal':
      if (normValue < 0.2) return [0, 0, 0];          // Black
      if (normValue < 0.4) return [128, 0, 128];      // Purple
      if (normValue < 0.6) return [255, 0, 0];        // Red
      if (normValue < 0.8) return [255, 255, 0];      // Yellow
      return [255, 255, 255];                         // White

    default:
      gray = clamp(normValue * 255);
      return [gray, gray, gray];
  }
}



  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void { }

  initMap() {
    this.map = this.mapService.getMap();

    this.vectorLayer = new VectorLayer({
      source: this.vectorSource,
      style: new Style({
        stroke: new Stroke({
          color: '#f00',
          width: 2,
        }),
        fill: new Fill({
          color: 'rgba(255,0,0,0.2)',
        }),
      }),
    });

    this.map.addLayer(this.vectorLayer);
    this.addDrawInteraction();
  }
  addDrawInteraction() {
    debugger
    if (this.draw) {
      this.map.removeInteraction(this.draw);
    }
    this.vectorSource.clear();

    this.draw = new Draw({
      source: this.vectorSource,
      type: 'Circle',
      geometryFunction: createBox(),
      style: new Style({
        stroke: new Stroke({ color: '#f00', width: 2 }),
        fill: new Fill({ color: 'rgba(255,0,0,0.2)' }),
      }),
    });

    this.draw.on('drawstart', () => {
      this.vectorSource.clear();
    });

    this.draw.on('drawend', (event) => {
      const feature = event.feature;
      const geometry = feature.getGeometry();
      if (geometry && geometry instanceof Polygon) {
        const coordinates = geometry.getCoordinates()[0];
        const lonLatCoords = coordinates.map((coord) => toLonLat(coord));
        const lons = lonLatCoords.map((c) => c[0]);
        const lats = lonLatCoords.map((c) => c[1]);
        this.bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
        console.log('Selected bounding box:', this.bbox);
      }

      this.map.removeInteraction(this.draw);
      // Optionally restore click listeners here
    });

    this.map.addInteraction(this.draw);
  }
  async onDemFileUpload(event: any) {
    const file = event.files[0];
    if (!file) return;

    this.demFile = file;
    console.log('DEM file uploaded:', file.name);

    try {
      await this.visualizeTiff(file);
      this.toastService.showSuccess('DEM visualized successfully!');
    } catch (error) {
      console.error('Error visualizing uploaded DEM:', error);
      this.toastService.showError('Failed to visualize uploaded DEM.');
    }
  }

  runDemAnalysis() {
    if (!this.demFile || !this.selectedDemAnalysis) {
      alert('Upload DEM file and select analysis type.');
      return;
    }
    console.log('Running DEM analysis for:', this.demFile.name, 'Type:', this.selectedDemAnalysis);
    // TODO: Implement backend call here
  }

  async downloadOpenTopographyDem() {
    if (!this.bbox) {
      alert('Draw a rectangle on the map to select area.');
      return;
    }
    if (!this.selectedDemType) {
      alert('Select a DEM type before downloading.');
      return;
    }

    try {
      const blob = await this.rasterService.downloadDemTile(this.bbox, this.selectedDemType).toPromise();

      if (!blob) throw new Error('No data returned from download service');

      saveAs(blob, `dem_tile_${this.selectedDemType}.tif`);
      await this.visualizeTiff(blob);

      this.toastService.showSuccess('DEM tile downloaded and displayed!');
    } catch (err) {
      console.error('Error downloading DEM:', err);
      this.toastService.showError('Failed to download DEM tile.');
    }
  }

  private async visualizeTiff(input: File | Blob): Promise<void> {
    try {
      // Remove existing DEM layer if present
      this.map.getLayers().getArray()
        .filter(layer => layer.get('name') === 'demLayer')
        .forEach(layer => this.map.removeLayer(layer));

      const arrayBuffer = await (input instanceof File
        ? input.arrayBuffer()
        : input.arrayBuffer());

      const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
      const image = await tiff.getImage();

      // Get dimensions and bounding box
      const width = image.getWidth();
      const height = image.getHeight();
      const extent4326 = image.getBoundingBox();
      const extent3857 = transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');

      // Read raster data
      const rasterData = await image.readRasters();
      const values = rasterData[0];

      // Find min/max without spreading large arrays
      let min = Infinity;
      let max = -Infinity;

      if (typeof values === 'number') {
        min = max = values;
      } else {
        const length = values.length;
        for (let i = 0; i < length; i++) {
          const val = values[i];
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }

      // Create canvas for visualization
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.createImageData(width, height);

      // Fill image data with color values based on selected ramp
      if (typeof values === 'number') {
        const norm = (values - min) / (max - min);
        const [r, g, b] = this.applyColorRamp(norm, this.selectedColorRamp);
        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i] = r;     // R
          imageData.data[i + 1] = g; // G
          imageData.data[i + 2] = b; // B
          imageData.data[i + 3] = 255;  // A
        }
      } else {
        const length = Math.min(values.length, width * height);
        for (let i = 0; i < length; i++) {
          const norm = (values[i] - min) / (max - min);
          const [r, g, b] = this.applyColorRamp(norm, this.selectedColorRamp);
          const idx = i * 4;
          imageData.data[idx] = r;     // R
          imageData.data[idx + 1] = g; // G
          imageData.data[idx + 2] = b; // B
          imageData.data[idx + 3] = 255;  // A
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // Create and add image layer to map with a name
      const imageLayer = new ImageLayer({
        source: new Static({
          url: canvas.toDataURL(),
          imageExtent: extent3857,
          projection: 'EPSG:3857'
        }),
        opacity: 0.7,
        properties: {
          name: 'demLayer' // Add a name property for easy identification
        }
      });

      this.map.addLayer(imageLayer);
      this.map.getView().fit(extent3857, { padding: [50, 50, 50, 50] });
    } catch (error) {
      console.error('Error visualizing DEM:', error);
      throw error;
    }
  }

  private async visualizeTiffCopy(input: File | Blob): Promise<void> {
    try {
      const arrayBuffer = await (input instanceof File
        ? input.arrayBuffer()
        : input.arrayBuffer());

      const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
      const image = await tiff.getImage();

      // Get dimensions and bounding box
      const width = image.getWidth();
      const height = image.getHeight();
      const extent4326 = image.getBoundingBox();
      const extent3857 = transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');

      // Read raster data
      const rasterData = await image.readRasters();
      const values = rasterData[0];

      // Find min/max without spreading large arrays
      let min = Infinity;
      let max = -Infinity;

      if (typeof values === 'number') {
        min = max = values;
      } else {
        // Handle both TypedArrays and regular arrays
        const length = values.length;
        for (let i = 0; i < length; i++) {
          const val = values[i];
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }

      // Create canvas for visualization
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.createImageData(width, height);

      // Fill image data with grayscale values
      if (typeof values === 'number') {
        const norm = ((values - min) / (max - min)) * 255;
        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i] = norm;     // R
          imageData.data[i + 1] = norm; // G
          imageData.data[i + 2] = norm; // B
          imageData.data[i + 3] = 255;  // A
        }
      } else {
        const length = Math.min(values.length, width * height);
        for (let i = 0; i < length; i++) {
          const norm = ((values[i] - min) / (max - min)) * 255;
          const idx = i * 4;
          imageData.data[idx] = norm;     // R
          imageData.data[idx + 1] = norm; // G
          imageData.data[idx + 2] = norm; // B
          imageData.data[idx + 3] = 255;  // A
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // Create and add image layer to map
      const imageLayer = new ImageLayer({
        source: new Static({
          url: canvas.toDataURL(),
          imageExtent: extent3857,
          projection: 'EPSG:3857'
        }),
        opacity: 0.7
      });

      this.map.addLayer(imageLayer);
      this.map.getView().fit(extent3857, { padding: [50, 50, 50, 50] });
    } catch (error) {
      console.error('Error visualizing DEM:', error);
      throw error;
    }
  }

}
