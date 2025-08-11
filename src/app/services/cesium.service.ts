import { Injectable } from '@angular/core';
import * as Cesium from 'cesium';

@Injectable({
  providedIn: 'root'
})
export class CesiumService {
  private viewer: Cesium.Viewer | null = null;
  private containerId = 'cesiumContainer';

  constructor() {
    // Configure Cesium static assets path
    (window as any).CESIUM_BASE_URL = '/assets/cesium';
  }

  /**
   * Initialize Cesium viewer
   */
  async initCesium(containerId?: string): Promise<void> {
    if (containerId) {
      this.containerId = containerId;
    }

    if (this.viewer) {
      console.warn('Cesium already initialized');
      return;
    }

    // Load terrain
    const terrainProvider = await Cesium.createWorldTerrainAsync();

    // Create the viewer without imagery
    this.viewer = new Cesium.Viewer(this.containerId, {
      terrainProvider,
      baseLayerPicker: false,
      timeline: false,
      animation: false,
      geocoder: false,
      fullscreenButton: false
    });

    // Load imagery separately
    const imageryProvider = await Cesium.IonImageryProvider.fromAssetId(2);
    this.viewer.imageryLayers.addImageryProvider(imageryProvider);

    console.log('Cesium Viewer initialized');
  }

  getViewer(): Cesium.Viewer | null {
    return this.viewer;
  }

  destroyCesium(): void {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
      console.log('Cesium viewer destroyed');
    }
  }

  flyTo(lat: number, lon: number, height = 5000): void {
    if (!this.viewer) return;
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height)
    });
  }
}
