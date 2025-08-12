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
import { CesiumService } from '../../services/cesium.service';
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
    // Basic analysis
    { label: 'Elevation at Point', value: 'point' },
    { label: 'Elevation Profile', value: 'profile' },
    
    // Terrain derivatives
    { label: 'Slope Map', value: 'slope', 
      description: 'Calculates slope steepness in degrees or percent' },
    { label: 'Aspect Map', value: 'aspect', 
      description: 'Calculates slope orientation (0-360 degrees)' },
    { label: 'Hillshade', value: 'hillshade', 
      description: 'Creates shaded relief from elevation data' },
    { label: 'Curvature', value: 'curvature', 
      description: 'Calculates profile and planimetric curvature' },
    { label: 'Roughness', value: 'roughness', 
      description: 'Measures surface texture variability' },
    { label: 'TPI (Topographic Position Index)', value: 'tpi', 
      description: 'Compares elevation to local mean' },
    
    // Hydrological analysis
    { label: 'Watershed Delineation', value: 'watershed', 
      description: 'Delineates drainage basins' },
    { label: 'Flow Accumulation', value: 'flow_accumulation', 
      description: 'Calculates upstream contributing area' },
    { label: 'Flow Direction', value: 'flow_direction', 
      description: 'Determines drainage direction (D8 algorithm)' },
    { label: 'Wetness Index', value: 'wetness', 
      description: 'Topographic wetness index (ln(a/tanβ))' },
    { label: 'Stream Network', value: 'stream_network', 
      description: 'Extracts channel network from flow accumulation' },
    
    // Advanced terrain analysis
    { label: 'Viewshed Analysis', value: 'viewshed', 
      description: 'Calculates visible areas from observer points' },
    { label: 'Solar Radiation', value: 'solar', 
      description: 'Models incoming solar radiation' },
    { label: 'Terrain Ruggedness', value: 'tri', 
      description: 'Terrain Ruggedness Index' },
    { label: 'Morphometric Features', value: 'morphometry', 
      description: 'Identifies peaks, pits, ridges, etc.' },
    
    // Specialized analyses
    { label: 'Volume Calculation', value: 'volume', 
      description: 'Calculates cut/fill volumes between surfaces' },
    { label: 'Hydrologic Corrected DEM', value: 'hydro_corrected', 
      description: 'Enforces hydrologic consistency' },
    { label: 'Channel Network Distance', value: 'channel_distance', 
      description: 'Distance to nearest stream channel' },
    { label: 'Topographic Wetness', value: 'topo_wetness', 
      description: 'Combines slope and upslope area' },
    
    // Visualization
    { label: '3D Surface Model', value: '3d_surface', 
      description: 'Generates 3D visualization of terrain' },
    { label: 'Contour Lines', value: 'contours', 
      description: 'Generates elevation contour lines' },
    { label: 'Color Relief', value: 'color_relief', 
      description: 'Applies color ramp to elevation values' }
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
    private toastService: ToastService,
    private rasterService: RasterAnalysisService,
        private cesiumService:CesiumService

  ) { }
  reRenderDEM() {
    debugger
    if (this.demFile) {
      //this.visualizeDemIn3d()
      this.visualizeTiff(this.demFile);

    }
  }

  ngOnInit(): void { }
// Add to RasterAnalysisComponent


async visualizeDemIn3d() {
  if (!this.demFile) {
    this.toastService.showError('No DEM file uploaded');
    return;
  }

  try {
    const arrayBuffer = await this.demFile.arrayBuffer();
    const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();
    
    // Get DEM bounds
    const bbox = image.getBoundingBox();
    
    // Read raster data
    const rasterData = await image.readRasters();
    const values = rasterData[0];
    
    // Prepare DEM data for Cesium
    const demData = {
      values,
      width: image.getWidth(),
      height: image.getHeight()
    };
    
    // Add to Cesium
    await this.cesiumService.addDemLayer(demData, {
      name: 'Uploaded DEM',
      bounds: {
        west: bbox[0],
        south: bbox[1],
        east: bbox[2],
        north: bbox[3]
      }
    });
    
    this.toastService.showSuccess('DEM displayed in 3D view');
  } catch (error) {
    console.error('Error displaying DEM in 3D:', error);
    this.toastService.showError('Failed to display DEM in 3D view');
  }
}

  applyColorRamp(value: number, ramp: string): [number, number, number] {
    const normValue = Math.max(0, Math.min(1, value));
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
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
  }
  startDraw() {
  this.addDrawInteraction();
}

ngAfterViewInit(): void {
  setTimeout(() => {
    this.initMap();
    this.addDrawInteraction();
    this.map.updateSize();
  }, 0);
}

addDrawInteraction() {
  if (!this.map) {
    console.error('Map not initialized yet');
    return;
  }

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
    const geometry = event.feature.getGeometry();
    if (geometry instanceof Polygon) {
      const coordinates = geometry.getCoordinates()[0];
      const lonLatCoords = coordinates.map(coord => toLonLat(coord));
      const lons = lonLatCoords.map(c => c[0]);
      const lats = lonLatCoords.map(c => c[1]);
      this.bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
      console.log('Selected bounding box:', this.bbox);
    }
    this.map.removeInteraction(this.draw);
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
      //this.visualizeDemIn3d();
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
