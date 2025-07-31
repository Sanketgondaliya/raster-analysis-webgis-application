import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GeoserverService {
  private apiUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) { }

  geoserverProjectList(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/geoserver/workspaces`,
    );
  }

  geoserverProject(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/geoserver/workspaces`,
      payload
    );
  }

  geoserverDataStore(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/geoserver/datastores`,
      payload
    );
  }


  geoserverDataStoreList(data: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/geoserver/workspaces/${data}/datastores`,
    );
  }
  geoserverLayerList(data: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/geoserver/workspaces/${data}/datastores`,
      {} 
    );
  }

  geoserverUploadfile(payload: FormData): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/import/publish-shp`,
      payload
    );
  }


}
