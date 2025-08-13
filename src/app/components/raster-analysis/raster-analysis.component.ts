import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { FileUploadModule } from 'primeng/fileupload';
import { ButtonModule } from 'primeng/button';
import { ReactiveFormsModule } from '@angular/forms';

import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style } from 'ol/style';
import { Select } from 'primeng/select';
import { MapService } from '../../services/map.service';
import { ToastService } from '../../services/toast.service';
import * as GeoTIFF from 'geotiff';

import Draw, { createBox } from 'ol/interaction/Draw';
import Polygon from 'ol/geom/Polygon';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj';

import { saveAs } from 'file-saver';
import { RasterAnalysisService } from '../../services/rasteranalysis.service';
import ImageLayer from 'ol/layer/Image';
import Static from 'ol/source/ImageStatic';
import { CesiumService } from '../../services/cesium.service';
import { InputNumberModule } from 'primeng/inputnumber';
import Feature from 'ol/Feature';
import { InputTextModule } from 'primeng/inputtext';
import { OptionsService } from './options.service';
import { RasterGlobalMethodService } from './raster-global-method.service';
interface Extent {
  west: number | null;
  east: number | null;
  south: number | null;
  north: number | null;
}
import { FormBuilder, FormGroup, Validators } from '@angular/forms';



@Component({
  selector: 'app-raster-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, TabsModule, ReactiveFormsModule, Select, FileUploadModule, InputNumberModule, InputTextModule, ButtonModule],
  templateUrl: './raster-analysis.component.html',
  styleUrls: ['./raster-analysis.component.scss'],
})
export class RasterAnalysisComponent implements OnInit {
  demFile: File | null = null;
  slopeForm!: FormGroup;
  aspectForm!: FormGroup;
  hillshadeForm!: FormGroup;
  selectedFile: File | null = null;
  slopeOptions: any = [];
  flatAreaHandlingOptions: any = [];
  aspectOptions: any = [];
  zFactorOptions: any = [];
  demAnalysisTypes: any = [];
  demTypes: any = [];
  slopeLegend: any = [];
  colorRamps: any = [];
  selectedDemType: string = 'SRTMGL1';
  selectedColorRamp: string = 'grayscale';
  extent: Extent = {
    west: null,
    east: null,
    south: null,
    north: null
  };

  selectedDemAnalysis: string | null = null;

  map!: Map;
  draw!: Draw;
  vectorSource = new VectorSource();
  vectorLayer!: VectorLayer;

  bbox: number[] | null = null;
  _extent: any;

  constructor(
    private mapService: MapService,
    private toastService: ToastService,
    private rasterService: RasterAnalysisService,
    private cesiumService: CesiumService,
    private fb: FormBuilder,
    private optionsService: OptionsService,
    private rasterGlobalMethodService: RasterGlobalMethodService

  ) {
    this.slopeForm = this.fb.group({
      slopeType: [null],      // optional
      zFactor: [null],        // optional
      demFile: [null, Validators.required] // only this is required
    });
    this.aspectForm = this.fb.group({
      outputformat: [null],      // optional
      FlatAreasHandling: [null],        // optional
      demFile: [null, Validators.required] // only this is required
    });
    this.hillshadeForm = this.fb.group({
      demFile: [null],
      z_factor: [1.0, [Validators.required, Validators.min(0.1)]],
      azimuth: [315.0, [Validators.required, Validators.min(0), Validators.max(360)]],
      altitude: [45.0, [Validators.required, Validators.min(0), Validators.max(90)]]
    });

  }
  onFileSelect(event: any) {
    if (event.files && event.files.length > 0) {
      this.selectedFile = event.files[0];
      console.log('Selected file:', this.selectedFile);
      this.slopeForm.patchValue({ demFile: this.selectedFile });
      this.slopeForm.get('demFile')?.markAsTouched();
    }
  }


  onSlopeSubmit() {
    if (this.slopeForm?.valid && this.selectedFile) {
      const { slopeType, zFactor } = this.slopeForm.value;
      this.rasterGlobalMethodService.calculateSlope(this.selectedFile, slopeType, zFactor)
        .subscribe(res => {
          console.log('Slope metadata:', res.parameters);
          const byteCharacters = atob(res.file_base64);
          const byteNumbers = Array.from(byteCharacters, c => c.charCodeAt(0));
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/tiff' });
          this.visualizeTiff(blob, 'slope');
        });
    } else {
      console.warn('Form invalid or file not selected');
    }
  }
  onAspectSubmit() {
    if (this.slopeForm?.valid && this.selectedFile) {
      const { FlatAreasHandling, outputformat } = this.slopeForm.value;
      this.rasterGlobalMethodService.calculateAspect(this.selectedFile, FlatAreasHandling, outputformat)
        .subscribe(res => {
          console.log('Slope metadata:', res.parameters);
          const byteCharacters = atob(res.file_base64);
          const byteNumbers = Array.from(byteCharacters, c => c.charCodeAt(0));
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/tiff' });
          this.visualizeTiff(blob, 'aspect');
        });
    } else {
      console.warn('Form invalid or file not selected');
    }
  }
  onHillshadeSubmit() {
    if (this.hillshadeForm?.valid && this.selectedFile) {
      const { z_factor, azimuth, altitude } = this.hillshadeForm.value;

      this.rasterGlobalMethodService
        .calculateHillshade(this.selectedFile, z_factor, azimuth, altitude)
        .subscribe(res => {
          console.log('Hillshade metadata:', res.parameters);

          const byteCharacters = atob(res.file_base64);
          const byteNumbers = Array.from(byteCharacters, c => c.charCodeAt(0));
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/tiff' });

          this.visualizeTiff(blob, 'hillshade');
        });
    } else {
      console.warn('Hillshade form invalid or file not selected');
    }
  }


  reRenderDEM() {
    if (this.demFile) {
      this.visualizeTiff(this.demFile, this.selectedColorRamp);
    }
  }

  ngOnInit(): void {
    this.initMap();
    this.slopeOptions = this.optionsService.slopeOptions;
    this.aspectOptions = this.optionsService.aspectOptions;
    this.flatAreaHandlingOptions = this.optionsService.flatAreaHandlingOptions;
    this.zFactorOptions = this.optionsService.zFactorOptions;
    this.demAnalysisTypes = this.optionsService.demAnalysisTypes;
    this.demTypes = this.optionsService.demTypes;
    this.slopeLegend = this.optionsService.slopeLegend;
    this.colorRamps = this.optionsService.colorRamps;
  }
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
    this.initMap();
    this.addDrawInteraction();
    this.map.updateSize();
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

        // Store bbox
        this.bbox = [
          Math.min(...lons),
          Math.min(...lats),
          Math.max(...lons),
          Math.max(...lats)
        ];

        // Update extent inputs
        this.extent = {
          west: this.bbox[0],
          south: this.bbox[1],
          east: this.bbox[2],
          north: this.bbox[3]
        };

        console.log('Selected bounding box:', this.bbox);
      }
      this.map.removeInteraction(this.draw);
    });

    this.map.addInteraction(this.draw);
  }
  drawRectangleFromExtent() {
    if (!this.map || !this.vectorSource) return;

    const { west, east, south, north } = this.extent;
    if (west == null || east == null || south == null || north == null) {
      console.warn("Extent values missing");
      return;
    }

    // Clear previous shapes
    this.vectorSource.clear();

    // Create rectangle geometry
    const coords = [
      [west, south],
      [west, north],
      [east, north],
      [east, south],
      [west, south] // Close polygon
    ].map(coord => fromLonLat(coord));

    const polygon = new Polygon([coords]);

    // Add to vector source
    const feature = new Feature(polygon);
    feature.setStyle(new Style({
      stroke: new Stroke({ color: '#f00', width: 2 }),
      fill: new Fill({ color: 'rgba(255,0,0,0.2)' }),
    }));

    this.vectorSource.addFeature(feature);

    // Zoom to rectangle
    this.map.getView().fit(polygon, { padding: [20, 20, 20, 20] });
  }
  drawRectangleFromDirectExtent() {
    if (!this.map || !this.vectorSource) return;

    if (!this._extent || typeof this._extent !== 'string') return;

    // Parse the comma-separated string
    const parts = this._extent.split(',').map(v => parseFloat(v.trim()));

    if (parts.length !== 4 || parts.some(isNaN)) {
      console.warn("Invalid extent format. Expected: south,west,north,east");
      return;
    }

    const [south, west, north, east] = parts; // Adjust order if needed

    // Clear previous shapes
    this.vectorSource.clear();

    // Create rectangle geometry
    const coords = [
      [west, south],
      [west, north],
      [east, north],
      [east, south],
      [west, south]
    ].map(coord => fromLonLat(coord));

    const polygon = new Polygon([coords]);
    const feature = new Feature(polygon);

    feature.setStyle(new Style({
      stroke: new Stroke({ color: '#f00', width: 2 }),
      fill: new Fill({ color: 'rgba(255,0,0,0.2)' }),
    }));

    this.vectorSource.addFeature(feature);
    this.map.getView().fit(polygon, { padding: [20, 20, 20, 20] });
  }
  async onDemFileUpload(event: any) {
    const file = event.files[0];
    if (!file) return;
    this.demFile = file;
    console.log('DEM file uploaded:', file.name);
    try {
      await this.visualizeTiff(file, this.selectedColorRamp);
      //this.visualizeDemIn3d();
      this.toastService.showSuccess('DEM visualized successfully!');
    } catch (error) {
      console.error('Error visualizing uploaded DEM:', error);
      this.toastService.showError('Failed to visualize uploaded DEM.');
    }
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
      await this.visualizeTiff(blob, 'dem');

      this.toastService.showSuccess('DEM tile downloaded and displayed!');
    } catch (err) {
      console.error('Error downloading DEM:', err);
      this.toastService.showError('Failed to download DEM tile.');
    }
  }
  private async visualizeTiff(input: File | Blob, style: string): Promise<void> {
    try {
      var layerNm = 'demLayer';
      this.map.getLayers().getArray()
        .filter(layer => layer.get('name') === 'demLayer')
        .forEach(layer => this.map.removeLayer(layer));
      const arrayBuffer = await (input instanceof File
        ? input.arrayBuffer()
        : input.arrayBuffer());
      const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
      const image = await tiff.getImage();
      const width = image.getWidth();
      const height = image.getHeight();
      const extent4326 = image.getBoundingBox();
      const extent3857 = transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');
      const rasterData = await image.readRasters();
      const values = rasterData[0];
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
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.createImageData(width, height);
      if (typeof values === 'number') {
        const norm = (values - min) / (max - min);
        const [r, g, b] = this.rasterGlobalMethodService.applyColorRamp(norm, style);
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
          const [r, g, b] = this.rasterGlobalMethodService.applyColorRamp(norm, style);
          const idx = i * 4;
          imageData.data[idx] = r;     // R
          imageData.data[idx + 1] = g; // G
          imageData.data[idx + 2] = b; // B
          imageData.data[idx + 3] = 255;  // A
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const imageLayer = new ImageLayer({
        zIndex: 9999,
        className: layerNm,
        source: new Static({
          url: canvas.toDataURL(),
          imageExtent: extent3857,
          projection: 'EPSG:3857'
        }),
        opacity: 0.7,
        properties: {
          name: layerNm
        }
      });
      this.map.addLayer(imageLayer);
      this.map.getView().fit(extent3857, { padding: [50, 50, 50, 50] });
    } catch (error) {
      console.error('Error visualizing DEM:', error);
      throw error;
    }
  }
}
