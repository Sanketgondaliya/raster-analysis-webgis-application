import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj';
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
    this.modeSub = this.mapService.mode$.subscribe(mode => {
      this.mapMode = mode === '2D' ? 'ol' : 'cesium';
      this.switchModeInternal();
    });
  }

  private switchModeInternal(): void {
    if (this.mapMode === 'ol') {
      this.cesiumService.destroyCesium();
     this.initializeMap()
    } else {
      this.destroyOlMap();
      setTimeout(() => this.cesiumService.initCesium('cesiumContainer'), 0);
    }
  }


  private destroyOlMap(): void {
    if (this.map) {
      this.map.setTarget(undefined); 
      this.map = null as any;
    }
  }

  private destroyMap(): void {
    if (this.mapMode === 'ol') {
      this.destroyOlMap();
    } else {
      this.cesiumService.destroyCesium();
    }
  }

  ngOnDestroy(): void {
    this.modeSub?.unsubscribe();
    this.destroyMap();
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
  console.log('*');
  
  const savedView = localStorage.getItem('mapView');

  let center = fromLonLat([78.9629, 20.5937]); // Default India center
  let zoom = 5;
  let rotation = 0;

  if (savedView) {
    try {
      const view = JSON.parse(savedView);
      if (view.lon !== undefined && view.lat !== undefined) {
        center = fromLonLat([view.lon, view.lat]);
      }
      if (view.zoom !== undefined) {
        zoom = view.zoom;
      }
      if (view.rotation !== undefined) {
        rotation = view.rotation;
      }
    } catch (e) {
      console.warn('Error reading saved map view:', e);
    }
  }

  const olView = new View({ center, zoom, rotation });

  this.map = new Map({
    target: 'map',
    view: olView
  });

  // // Save only if something changed
  // this.map.on('moveend', () => {
  //   const view = this.map.getView();
  //   const currentCenter = toLonLat(view.getCenter()!);
  //   const currentZoom = view.getZoom();

  //   const stored = savedView ? JSON.parse(savedView) : {};
  //   if (
  //     stored.lon !== currentCenter[0] ||
  //     stored.lat !== currentCenter[1] ||
  //     stored.zoom !== currentZoom
  //   ) {
  //     this.saveViewToLocalStorage();
  //   }
  // });
  this.mapService.setMap(this.map);
  this.initPopupOverlay();
  //this.setupWmsFeatureInfo();
  this.mapService.addBasemap('osm');
}

  private setupWmsFeatureInfo(): void {
    this.map.on('singleclick', async (evt) => {
      this.popupTabs = [];
      console.log("pour point");
      let a =toLonLat(evt.coordinate)
      console.log(a);
      
      
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
  const center = toLonLat(view.getCenter()!); // already EPSG:4326
  const zoom = view.getZoom();
  const rotation = view.getRotation();

  // Get extent in map projection
  const extent = view.calculateExtent();

  // Convert extent to EPSG:4326
  const extent4326 = transformExtent(extent, view.getProjection(), 'EPSG:4326');

  const viewData = {
    lon: center[0],
    lat: center[1],
    zoom,
    rotation,
    extent: extent4326
  };

  localStorage.setItem('mapView', JSON.stringify(viewData));
}



}
