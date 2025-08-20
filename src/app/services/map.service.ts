import { Injectable } from '@angular/core';
import Map from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileWMS from 'ol/source/TileWMS';
import View from 'ol/View';
import { fromLonLat } from 'ol/proj';
import { BehaviorSubject } from 'rxjs';

declare global {
  interface Window {
    map: Map;
  }
}
interface RasterLayerItem {
  name: string;
  visible: boolean;
  layer: any;
  bbox?: any;
}
interface RasterGroup {
  type: string;
  layers: RasterLayerItem[];
}
@Injectable({
  providedIn: 'root'
})
export class MapService {
  private _map!: Map;
  private currentBaseLayer: TileLayer | null = null;
  private wmsLayers: { [key: string]: TileLayer<TileWMS> } = {};
  mode$ = new BehaviorSubject<'2D' | '3D'>('2D');
  private readonly INDIA_CENTER = [80.9629, 20.5937];
  private readonly INDIA_ZOOM = 4.7;

  setMap(map: Map): void {
    this._map = map;
    window.map = this._map;
    this.setDefaultIndiaView();
    this.addBasemap('osm');
  }

  getMap(): Map {
    return this._map;
  }
  setMode(mode: '2D' | '3D'): void {
    this.mode$.next(mode);
  }


  private setDefaultIndiaView(): void {
    if (!this._map) return;

    const view = this._map.getView();
    if (view) {
      view.setCenter(fromLonLat(this.INDIA_CENTER));
      view.setZoom(this.INDIA_ZOOM);
    } else {
      this._map.setView(new View({
        center: fromLonLat(this.INDIA_CENTER),
        zoom: this.INDIA_ZOOM
      }));
    }
  }

  /** Add a basemap layer */
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

  /** Remove the current basemap */
  removeCurrentBasemap(): void {
    if (this._map && this.currentBaseLayer) {
      this._map.removeLayer(this.currentBaseLayer);
      this.currentBaseLayer = null;
    }
  }

  /** Update CQL filter for a WMS layer */
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

  /** Reset all WMS layer filters */
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

  /** Zoom to WMS layer extent */
  zoomToLayerExtent(layerName: string, extent: number[]): void {
    const layer = this.wmsLayers[layerName];
    if (layer && this._map && extent) {
      this._map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 1000
      });
    }
  }
  private rasterGroupsSubject = new BehaviorSubject<RasterGroup[]>([]);
  rasterGroups$ = this.rasterGroupsSubject.asObservable();

  /** Add a new raster layer to a group */
  addRasterLayer(groupType: string, layer: RasterLayerItem): void {
    const currentGroups = this.rasterGroupsSubject.getValue();
    const groupIndex = currentGroups.findIndex(g => g.type === groupType);

    if (groupIndex !== -1) {
      currentGroups[groupIndex].layers.push(layer);
    } else {
      currentGroups.push({ type: groupType, layers: [layer] });
    }

    this.rasterGroupsSubject.next([...currentGroups]);
  }
  setRasterGroups(groups: RasterGroup[]): void {
    this.rasterGroupsSubject.next(groups);
  }
  /** Toggle layer visibility */
  toggleRasterVisibility(groupType: string, layerName: string, visible: boolean): void {
    debugger
    const currentGroups = this.rasterGroupsSubject.getValue();

    currentGroups.forEach(group => {
      if (group.type === groupType) {
        group.layers.forEach(layer => {
          if (layer.name === layerName) {
            layer.visible = visible;
            if (layer.layer) {
              layer.layer.setVisible(visible);
            }
          }
        });
      }
    });

    this.rasterGroupsSubject.next([...currentGroups]);
  }
}
