import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat, toLonLat } from 'ol/proj';
import { MapService } from '../../components/services/map.service';
import { ObjectEvent } from 'ol/Object';

@Component({
  selector: 'app-map',
  standalone: true,
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements AfterViewInit, OnDestroy {
  map!: Map;

  constructor(private mapService: MapService) {}

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.saveViewToLocalStorage();
    }
  }

  private initializeMap(): void {
    const savedView = localStorage.getItem('mapView');
    let center = fromLonLat([78.9629, 20.5937]); // Default: India
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

    // ✅ Use type-safe event subscription
    view.on('change:center', (event: ObjectEvent) => this.saveViewToLocalStorage());
    view.on('change:resolution', (event: ObjectEvent) => this.saveViewToLocalStorage());

    this.mapService.setMap(this.map);
    this.mapService.addBasemap('osm'); // Default base layer
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
}
