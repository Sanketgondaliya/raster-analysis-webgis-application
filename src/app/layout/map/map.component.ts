import { Component, AfterViewInit } from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat } from 'ol/proj';
import { MapService } from '../../components/services/map.service';

@Component({
  selector: 'app-map',
  standalone: true,
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements AfterViewInit {
  map!: Map;

  constructor(private mapService: MapService) {}

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  private initializeMap(): void {
    this.map = new Map({
      target: 'map',
      view: new View({
        center: fromLonLat([78.9629, 20.5937]), // India center
        zoom: 5
      })
    });

    this.mapService.setMap(this.map);
    this.mapService.addBasemap('osm'); // default to OSM
  }
}
