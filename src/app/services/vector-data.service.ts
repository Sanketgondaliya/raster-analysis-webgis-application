// vector-data.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import KML from 'ol/format/KML';
import GPX from 'ol/format/GPX';

@Injectable({
  providedIn: 'root'
})
export class VectorDataService {
  private features: Feature[] = [];

  constructor(private http: HttpClient) {}

  /**
   * Upload shapefile to backend
   */
  uploadShapefile(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    // ⚠️ Adjust API URL based on your backend
    return this.http.post('/api/upload-shapefile', formData);
  }

  /**
   * Add features
   */
  addFeatures(newFeatures: Feature[]): void {
    this.features.push(...newFeatures);
  }

  /**
   * Replace current features with a new set
   */
  setFeatures(newFeatures: Feature[]): void {
    this.features = [...newFeatures];
  }

  /**
   * Get all features
   */
  getFeatures(): Feature[] {
    return this.features;
  }

  /**
   * Remove a feature
   */
  removeFeature(feature: Feature): void {
    this.features = this.features.filter(f => f !== feature);
  }

  /**
   * Clear all features
   */
  clearFeatures(): void {
    this.features = [];
  }

  /**
   * Export features to GeoJSON, KML, GPX
   */
  exportFeatures(format: 'geojson' | 'kml' | 'gpx'): string | null {
    if (!this.features.length) return null;

    let writer;
    if (format === 'geojson') {
      writer = new GeoJSON();
      return writer.writeFeatures(this.features);
    } else if (format === 'kml') {
      writer = new KML();
      return writer.writeFeatures(this.features);
    } else if (format === 'gpx') {
      writer = new GPX();
      return writer.writeFeatures(this.features);
    }
    return null;
  }

  /**
   * Import features from a file (GeoJSON, KML, GPX)
   */
  importFromFile(file: File): Promise<Feature[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e: ProgressEvent<FileReader>) => {
        const result = e.target?.result;
        if (!result || typeof result !== 'string') {
          reject('Invalid file content');
          return;
        }

        let format;
        if (file.name.toLowerCase().endsWith('.geojson') || file.name.toLowerCase().endsWith('.json')) {
          format = new GeoJSON();
        } else if (file.name.toLowerCase().endsWith('.kml')) {
          format = new KML();
        } else if (file.name.toLowerCase().endsWith('.gpx')) {
          format = new GPX();
        } else {
          reject('Unsupported format');
          return;
        }

        try {
          const features = format.readFeatures(result, {
            featureProjection: 'EPSG:3857' // Web Mercator
          });
          this.addFeatures(features);
          resolve(features);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject('File reading failed');
      reader.readAsText(file);
    });
  }
}