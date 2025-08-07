import { Injectable } from '@angular/core';
import Map from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileWMS from 'ol/source/TileWMS';

declare global {
  interface Window {
    map: Map;
  }
}

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private _map!: Map;
  private currentBaseLayer: TileLayer | null = null;
  private wmsLayers: { [key: string]: TileLayer<TileWMS> } = {};




  setMap(map: Map): void {
    this._map = map;
    window.map = this._map;

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

    if (this.currentBaseLayer) {
      this._map.removeLayer(this.currentBaseLayer);
    }

    if (layer) {
      this._map.addLayer(layer);
      this.currentBaseLayer = layer;
    }
  }

  removeCurrentBasemap(): void {
    if (this._map && this.currentBaseLayer) {
      this._map.removeLayer(this.currentBaseLayer);
      this.currentBaseLayer = null;
    }
  }

  updateLayerFilter(layerName: string, cqlFilter: string | null): void {
    const layers = this._map.getLayers();
    layers.forEach(layer => {
      if (layer.getClassName() === layerName && layer instanceof TileLayer) {
        const source = layer.getSource();
        if (source instanceof TileWMS) {
          source.updateParams({ 'CQL_FILTER': cqlFilter });
          source.refresh();
        }
      }
    });
  }

  resetAllLayerFilters(): void {
    const layers = this._map.getLayers();
    layers.forEach(layer => {
      if (layer instanceof TileLayer) {
        const source = layer.getSource();
        if (source instanceof TileWMS) {
          source.updateParams({ 'CQL_FILTER': null });
          source.refresh();
        }
      }
    });
  }

  getWmsLayer(layerName: string): TileLayer<TileWMS> | undefined {
    return this.wmsLayers[layerName];
  }

  // Method to zoom to layer extent
  zoomToLayerExtent(layerName: string, extent: number[]): void {
    const layer = this.wmsLayers[layerName];
    if (layer && this._map && extent) {
      this._map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 1000
      });
    }
  }
}