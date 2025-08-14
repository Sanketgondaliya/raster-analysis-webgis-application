import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RasterGlobalMethodService {

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
        return [255, 255, 255];
      case 'ndvi':
        // Vegetation index: brown → yellow → green
        if (normValue < 0.2) return [165, 0, 38];       // Red - barren
        if (normValue < 0.4) return [215, 48, 39];      // Light red
        if (normValue < 0.5) return [244, 109, 67];     // Orange
        if (normValue < 0.6) return [253, 174, 97];     // Light orange
        if (normValue < 0.7) return [254, 224, 139];    // Yellow
        if (normValue < 0.8) return [217, 239, 139];    // Light green
        if (normValue < 0.9) return [166, 217, 106];    // Medium green
        return [102, 189, 99];                          // Dark green
      case 'ndbi':
        // Built-up index: brown → gray → white
        if (normValue < 0.2) return [84, 48, 5];        // Dark brown
        if (normValue < 0.4) return [140, 81, 10];      // Brown
        if (normValue < 0.6) return [191, 129, 45];     // Light brown
        if (normValue < 0.8) return [224, 224, 224];    // Light gray
        return [255, 255, 255];                         // White
      case 'ndwi':
        // Water index: brown → light blue → blue
        if (normValue < 0.2) return [165, 42, 42];      // Brown - dry
        if (normValue < 0.4) return [191, 239, 255];    // Light blue
        if (normValue < 0.6) return [125, 197, 255];    // Medium blue
        if (normValue < 0.8) return [49, 130, 189];     // Blue
        return [0, 77, 168];                            // Dark blue - water

      case 'hillshade':
        gray = clamp(normValue * 255);
        return [gray, gray, gray];

      // Aspect: value expected to be normalized from 0–1 (where 0=0°, 1=360°)
      // Uses HSV to RGB conversion for smooth circular coloring
      case 'aspect':
        const hue = normValue * 360; // degrees
        const c = 1; // full saturation
        const x = (1 - Math.abs(((hue / 60) % 2) - 1)) * c;
        let r = 0, g = 0, b = 0;

        if (hue < 60) { r = c; g = x; b = 0; }
        else if (hue < 120) { r = x; g = c; b = 0; }
        else if (hue < 180) { r = 0; g = c; b = x; }
        else if (hue < 240) { r = 0; g = x; b = c; }
        else if (hue < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }

        return [
          clamp(r * 255),
          clamp(g * 255),
          clamp(b * 255)
        ];// Snow caps
      case 'slope':
        // Typical slope color scheme: green (flat) → yellow → orange → red (steep)
        if (normValue < 0.1) return [0, 104, 55];     // Very gentle
        if (normValue < 0.2) return [26, 152, 80];    // Gentle
        if (normValue < 0.4) return [102, 189, 99];   // Moderate
        if (normValue < 0.6) return [255, 255, 191];  // Moderate-steep
        if (normValue < 0.8) return [253, 174, 97];   // Steep
        return [215, 25, 28];                         // Very steep

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


      // Roughness: smooth (blue/white) → rough (orange/red)
      case 'roughness':
        if (normValue < 0.2) return [230, 245, 255];  // Very smooth
        if (normValue < 0.4) return [171, 217, 233];  // Smooth
        if (normValue < 0.6) return [253, 174, 97];   // Moderate
        if (normValue < 0.8) return [244, 109, 67];   // Rough
        return [165, 0, 38];                          // Very rough


      case 'tpi':
        // Map 0–0.5 = valleys (blue), 0.5 = flat (tan), 0.5–1 = ridges (red)
        if (normValue < 0.25) return [49, 54, 149];   // Deep valleys
        if (normValue < 0.4) return [116, 173, 209]; // Low slope near valley
        if (normValue < 0.6) return [255, 255, 191]; // Flat/mid-slope
        if (normValue < 0.75) return [253, 174, 97];  // Low ridges
        return [215, 48, 39];                         // High ridges

      default:
        gray = clamp(normValue * 255);
        return [gray, gray, gray];
    }
  }
  private baseUrl = 'http://localhost:5000'; // Change to your FastAPI backend URL

  constructor(private http: HttpClient) { }

  /**
   * Upload DEM and calculate slope
   */
  calculateSlope(demFile: File, slopeType: string, zFactor: number): Observable<any> {
    const formData = new FormData();
    formData.append('file', demFile);
    formData.append('slope_type', slopeType);
    formData.append('z_factor', zFactor.toString());

    return this.http.post(`${this.baseUrl}/slope`, formData);
  }

  /**
   * Upload DEM and calculate aspect
   */
  calculateAspect(demFile: File, FlatAreasHandling: string, outputformat: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', demFile);
    formData.append('FlatAreasHandling', FlatAreasHandling);
    formData.append('outputformat', outputformat);
    return this.http.post(`${this.baseUrl}/aspect`, formData);
  }

  /**
   * Upload DEM and calculate hillshade
   */
  calculateHillshade(demFile: File, zFactor: number, azimuth: number, altitude: number): Observable<any> {
    const formData = new FormData();
    formData.append('file', demFile);
    formData.append('z_factor', zFactor.toString());
    formData.append('azimuth', azimuth.toString());
    formData.append('altitude', altitude.toString());
    return this.http.post(`${this.baseUrl}/hillshade`, formData);
  }


  /**
   * Upload DEM and calculate roughness
   */
  calculateRoughness(demFile: File, zFactor: number, scale: number): Observable<any> {
    const formData = new FormData();
    formData.append('file', demFile);
    formData.append('z_factor', zFactor.toString());
    formData.append('scale', scale.toString());
    return this.http.post(`${this.baseUrl}/roughness`, formData);
  }

  /**
   * Upload DEM and calculate TPI
   */
  calculateTPI(demFile: File, zFactor: number, scale: number): Observable<any> {
    const formData = new FormData();
    formData.append('file', demFile);
    formData.append('z_factor', zFactor.toString());
    formData.append('scale', scale.toString());
    return this.http.post(`${this.baseUrl}/tpi`, formData);
  }


  /**
   * Upload DEM and calculate countours
   */
  calculateContours(demFile: File, interval: number): Observable<any> {
    const formData = new FormData();
    formData.append('file', demFile);
    formData.append('interval', interval.toString());
    return this.http.post(`${this.baseUrl}/contours`, formData);
  }

  /**
   * Get elevation profile from points
   */
  getElevationProfile(demFile: File, lat1: number, lon1: number, lat2: number, lon2: number, samples: number): Observable<any> {
    const formData = new FormData();
    formData.append('dem', demFile);
    formData.append('Latitude1', lat1.toString());
    formData.append('Longitude1', lon1.toString());
    formData.append('Latitude2', lat2.toString());
    formData.append('Longitude2', lon2.toString());
    formData.append('samples', samples.toString());
    return this.http.post(`${this.baseUrl}/elevation_profile`, formData);
  }


  /**
   * Get elevation at a specific point
   */
  getElevationAtPoint(demFile: File, latitude: number, longitude: number): Observable<any> {
    const formData = new FormData();
    formData.append('file', demFile);
    formData.append('latitude', latitude.toString());
    formData.append('longitude', longitude.toString());
    return this.http.post(`${this.baseUrl}/elevation_point`, formData);
  }

  /**
  * Fetch raster index from backend
  * @param service NDVI | NDBI | NDWI
  * @param bbox string bbox "minLon,minLat,maxLon,maxLat"
  * @param startDate Date
  * @param endDate Date
  */
  fetchIndex(service: 'ndvi' | 'ndbi' | 'ndwi', bbox: string, startDate: Date, endDate: Date): Observable<Blob> {
    const time_start = startDate.toISOString().split('T')[0];
    const time_end = endDate.toISOString().split('T')[0];
    const url = `${this.baseUrl}/landsat_indices?service=${service}&bbox=${bbox}&time_start=${time_start}&time_end=${time_end}`;

    return this.http.get(url, { responseType: 'blob' });
  }
}
