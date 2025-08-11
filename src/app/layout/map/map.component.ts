import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat, toLonLat } from 'ol/proj';
import { MapService } from '../../services/map.service';
import { ObjectEvent } from 'ol/Object';
import TileLayer from 'ol/layer/Tile';
import { TileWMS } from 'ol/source';
import Overlay from 'ol/Overlay';
import { CommonModule } from '@angular/common';
import { NgFor, KeyValuePipe } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { CesiumService } from '../../services/cesium.service';

interface PopupTab {
  title: string;
  data: any;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, NgFor, KeyValuePipe, TabsModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements AfterViewInit {
  map!: Map;
  popupOverlay!: Overlay;
  popupContentEl!: HTMLElement;
  popupCloserEl!: HTMLElement;
  mapMode: 'ol' | 'cesium' = 'ol';

  popupTabs: PopupTab[] = [];
  selectedTab: string | number = '';
  modeSub: any;
  constructor(
    private mapService: MapService,
    private cesiumService: CesiumService
  ) { }

  ngAfterViewInit(): void {
    this.mapService.mode$.subscribe(mode => {
      this.mapMode = mode === '2D' ? 'ol' : 'cesium';
      this.switchModeInternal();
    });
  }

  private switchModeInternal(): void {
    if (this.mapMode === 'ol') {
      this.initializeMap();
    } else {
     /// this.destroyOlMap();
      this.cesiumService.initCesium();
    }
  }

  private destroyOlMap() {
    if (this.map) {
      this.map.setTarget('');
      this.map = null as any;
    }
  }


  onTabChange(value: string | number) {
    this.selectedTab = String(value); // Convert to string if needed
  }

  private initPopupOverlay(): void {
    this.popupContentEl = document.getElementById('popup-content') as HTMLElement;
    this.popupCloserEl = document.getElementById('popup-closer') as HTMLElement;

    if (!this.popupContentEl || !this.popupCloserEl) {
      console.warn('Popup elements not found in DOM.');
      return;
    }

    this.popupOverlay = new Overlay({
      element: document.getElementById('popup') as HTMLElement,
      autoPan: {
        animation: { duration: 250 }
      }
    });

    this.map.addOverlay(this.popupOverlay);

    this.popupCloserEl.onclick = () => {
      this.popupOverlay.setPosition(undefined);
      this.popupCloserEl.blur();
      return false;
    };
  }


  private initializeMap(): void {
    const savedView = localStorage.getItem('mapView');
    let center = fromLonLat([78.9629, 20.5937]);
    let zoom = 5;

    if (savedView) {
      try {
        const view = JSON.parse(savedView);
        center = fromLonLat([view.lon, view.lat]);
        zoom = view.zoom;
      } catch (e) {
        console.warn('Failed to parse saved map view.', e);
      }
    }

    const view = new View({ center, zoom });

    this.map = new Map({
      target: 'map',
      view
    });

    view.on('change:center', () => this.saveViewToLocalStorage());
    view.on('change:resolution', () => this.saveViewToLocalStorage());

    this.mapService.setMap(this.map);
    this.initPopupOverlay();
    this.setupWmsFeatureInfo();

    this.mapService.addBasemap('osm');
  }

  private setupWmsFeatureInfo(): void {
    this.map.on('singleclick', async (evt) => {
      this.popupTabs = [];
      this.popupOverlay.setPosition(undefined);

      const view = this.map.getView();
      const viewResolution = view.getResolution();
      const projection = view.getProjection();

      const layers = this.map.getLayers().getArray()
        .filter(layer =>
          (layer as TileLayer).getSource?.() instanceof TileWMS &&
          layer.getVisible()
        ) as TileLayer<TileWMS>[];

      const requests = layers.map(async (layer) => {
        const source = layer.getSource();
        const layerName = source?.getParams()?.LAYERS ?? 'Unknown';

        const url = source?.getFeatureInfoUrl(evt.coordinate, viewResolution!, projection, {
          'INFO_FORMAT': 'application/json',
          'QUERY_LAYERS': source.getParams().LAYERS
        });

        if (!url) return null;

        try {
          const res = await fetch(url);
          const json = await res.json();

          if (json.features && json.features.length > 0) {
            return {
              title: layerName.toString(),
              data: json.features[0].properties
            };
          }
        } catch (e) {
          console.warn(`Error fetching info from ${layerName}`, e);
        }

        return null;
      });

      const results = (await Promise.all(requests)).filter(r => r !== null) as PopupTab[];
      this.popupTabs = results.length > 0
        ? results.map(r => ({
          title: String(r.title), // Ensure title is always a string
          data: r.data
        }))
        : [{ title: 'Info', data: { message: 'No features found.' } }];


      this.selectedTab = this.popupTabs[0]?.title || '';
      this.popupOverlay.setPosition(evt.coordinate);
    });
  }

  private saveViewToLocalStorage(): void {
    const view = this.map.getView();
    const center = toLonLat(view.getCenter()!);
    const zoom = view.getZoom();

    const viewData = {
      lon: center[0],
      lat: center[1],
      zoom: zoom
    };

    localStorage.setItem('mapView', JSON.stringify(viewData));
  }
   private destroyMap(): void {
    if (this.map) {
      this.map.setTarget(undefined);
    }
  }
  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.destroyMap();
  }
}
