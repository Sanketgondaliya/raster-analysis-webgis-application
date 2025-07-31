import { Injectable } from '@angular/core';
import Map from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private _map!: Map;
  private currentBaseLayer: TileLayer | null = null;

  setMap(map: Map): void {
    this._map = map;
  }

  getMap(): Map {
    return this._map;
  }

  addBasemap(type: string): void {
    if (!this._map) return;

    let layer: TileLayer | null = null;

    switch (type.toLowerCase()) {
      case 'osm':
        layer = new TileLayer({
          source: new OSM()
        });
        break;

      case 'google':
        layer = new TileLayer({
          source: new XYZ({
            url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
          })
        });
        break;

      case 'esri':
        layer = new TileLayer({
          source: new XYZ({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          })
        });
        break;

      default:
        console.warn(`Unknown basemap type: ${type}`);
        return;
    }

    this._map.addLayer(layer);
    this.currentBaseLayer = layer;
  }

  removeCurrentBasemap(): void {
    if (this._map && this.currentBaseLayer) {
      this._map.removeLayer(this.currentBaseLayer);
      this.currentBaseLayer = null;
    }
  }
}
