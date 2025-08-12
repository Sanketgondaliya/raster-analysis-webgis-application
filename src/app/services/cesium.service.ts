

import { Injectable } from '@angular/core';
import * as Cesium from "cesium";

@Injectable({
  providedIn: 'root'
})
export class CesiumService {
  private readonly accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzMWY0ZDZiZi0yMmM3LTQxYmEtYjBmZS1mN2Q2MjFjMmZkMWIiLCJpZCI6NzQ5Niwic2NvcGVzIjpbImFzciIsImdjIl0sImlhdCI6MTU0OTUzMDU2OX0.lHpaQQTdTCKDFVqoU2cHZqUtHr1EItUWx3kUhbIyz_0';
  private viewer: Cesium.Viewer | null = null;
  private containerId = 'cesiumContainer';

  constructor() {
    Cesium.Ion.defaultAccessToken = this.accessToken;
    (window as any).CESIUM_BASE_URL = '/assets/cesium';
  }

  async initCesium(containerId?: string): Promise<boolean> {
    try {
      if (containerId) {
        this.containerId = containerId;
      }

      if (this.viewer) {
        console.warn('Cesium already initialized');
        return true;
      }

      if (!document.getElementById(this.containerId)) {
        throw new Error(`Container element with id ${this.containerId} not found`);
      }

      let terrainProvider;
      try {
        terrainProvider = await Cesium.createWorldTerrainAsync({
          requestWaterMask: true,
          requestVertexNormals: true
        });
      } catch (terrainError) {
        console.warn('Failed to load Cesium terrain, using default:', terrainError);
        terrainProvider = new Cesium.EllipsoidTerrainProvider();
      }

      this.viewer = new Cesium.Viewer(this.containerId, {
        terrainProvider,
        baseLayerPicker: false,
        timeline: false,
        animation: false,
        geocoder: false,
        fullscreenButton: false
      });

      // Remove default imagery
      this.viewer.imageryLayers.removeAll();

      // ✅ Add Esri World Imagery (high-resolution)
      this.viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        })
      );

      // Fly to India
      // this.viewer.camera.flyTo({
      //   destination: Cesium.Rectangle.fromDegrees(68, 6, 98, 37)
      // });

      // Slight tilt
      // this.viewer.camera.setView({
      //   destination: Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 500000),
      //   orientation: {
      //     heading: Cesium.Math.toRadians(0),
      //     pitch: Cesium.Math.toRadians(-30)
      //   }
      // });
      // First try to restore exact view from storage
      const restored = await this.restoreExactViewFromStorage();

      // If no stored view or restoration failed, use default
      if (!restored) {
        this.setDefaultIndiaView();
      }


      // Load sample model
      this.loadSampleModel();

      return true;
    } catch (error) {
      console.error('Failed to initialize Cesium:', error);
      return false;
    }
  }

  private async restoreExactViewFromStorage(): Promise<boolean> {
    if (!this.viewer) return false;

    try {
      const savedView = localStorage.getItem('mapView');
      if (savedView) {
        const { lon, lat, zoom, rotation } = JSON.parse(savedView);

        if (lon == null || lat == null || zoom == null) {
          throw new Error('Incomplete view data');
        }

        const height = this.calculateHeightFromZoom(zoom);
        const heading = (-(rotation) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

        await this.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
          orientation: {
            heading,
            pitch: Cesium.Math.toRadians(-90), // exact top-down match to OL
            roll: 0
          },
          duration: 0 // instant for testing
        });

        return true;
      }
    } catch (e) {
      console.warn('Failed to restore 3D view:', e);
    }
    return false;
  }

  private setDefaultIndiaView(): void {
    if (!this.viewer) return;

    // More precise India bounding rectangle
    const indiaWest = 68.1766451354;
    const indiaSouth = 6.755;
    const indiaEast = 97.4025614766;
    const indiaNorth = 35.6745207159;

    this.viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(indiaWest, indiaSouth, indiaEast, indiaNorth),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-30),
        roll: 0.0
      }
    });
  }

  private calculateHeightFromZoom(zoom: number): number {
    const resolution = 156543.03392804097 / Math.pow(2, zoom);
    const groundDistance = resolution * 256;
    return groundDistance * 1.5;
  }


  private loadSampleModel(): void {
    if (!this.viewer) return;

    const position = Cesium.Cartesian3.fromDegrees(77.5946, 12.9716, 100); // Bangalore
    const heading = Cesium.Math.toRadians(135);
    const pitch = 0;
    const roll = 0;
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(
      position,
      new Cesium.HeadingPitchRoll(heading, pitch, roll)
    );

    this.viewer.entities.add({
      name: 'Sample 3D Model',
      position,
      orientation,
      model: {
        uri: 'https://assets.cesium.com/1456982/CesiumAir.glb',
        scale: 2.0
      }
    });

    console.log('Sample 3D model loaded');
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
  async addDemLayer(demData: any, options: {
    name: string;
    bounds: { west: number, south: number, east: number, north: number };
    minHeight?: number;
    maxHeight?: number;
  }): Promise<void> {
    if (!this.viewer) {
      throw new Error('Cesium viewer not initialized');
    }

    try {
      // Create a terrain provider from the DEM data
      const terrainProvider = await this.createTerrainFromDem(demData, options);

      // Either replace the main terrain provider or add as a custom layer
      this.viewer.terrainProvider = terrainProvider;

      // Zoom to the DEM bounds
      await this.zoomToDemArea(options.bounds);

      console.log(`DEM layer "${options.name}" added successfully`);
    } catch (error) {
      console.error('Error adding DEM layer:', error);
      throw error;
    }
  }

  private async zoomToDemArea(bounds: {
    west: number,
    south: number,
    east: number,
    north: number
  }): Promise<void> {
    if (!this.viewer) return;

    // Convert degrees to radians for Cesium
    const west = Cesium.Math.toRadians(bounds.west);
    const south = Cesium.Math.toRadians(bounds.south);
    const east = Cesium.Math.toRadians(bounds.east);
    const north = Cesium.Math.toRadians(bounds.north);

    // Create a rectangle from the bounds
    const rectangle = new Cesium.Rectangle(west, south, east, north);

    // Calculate the best camera position to view the entire area
    try {
      // First try to fly to the rectangle
      await this.viewer.camera.flyTo({
        destination: rectangle,
        orientation: {
          heading: 0.0,
          pitch: -Cesium.Math.PI_OVER_FOUR, // 45 degree angle view
          roll: 0.0
        },
        duration: 2 // Animation duration in seconds
      });

      // Then adjust the view to ensure the entire area is visible
      await this.viewer.camera.flyTo({
        destination: rectangle,
        orientation: {
          heading: 0.0,
          pitch: -Cesium.Math.PI_OVER_FOUR,
          roll: 0.0
        },
        duration: 1,
        complete: () => {
          // Adjust the view to make sure everything is visible
          this.viewer?.camera.zoomOut(0.5); // Zoom out slightly to add padding
        }
      });
    } catch (error) {
      console.warn('Error flying to DEM area:', error);
      // Fallback to simple view
      this.viewer.camera.setView({
        destination: rectangle
      });
    }
  }

  private async createTerrainFromDem(demData: any, options: {
    bounds: { west: number, south: number, east: number, north: number };
    minHeight?: number;
    maxHeight?: number;
  }): Promise<Cesium.TerrainProvider> {
    // For actual DEM data processing, you would:
    // 1. Process the DEM data into terrain tiles
    // 2. Upload to Cesium ion or serve from your own server
    // 3. Create a terrain provider pointing to those tiles

    // For this example, we'll use Cesium World Terrain as a placeholder
    return await Cesium.createWorldTerrainAsync({
      requestWaterMask: true,
      requestVertexNormals: true
    });

    // In a real implementation with custom DEM data:
    // return new Cesium.CesiumTerrainProvider({
    //   url: 'https://your-terrain-server.com/tiles',
    //   requestVertexNormals: true,
    //   requestWaterMask: true
    // });
  }

}
