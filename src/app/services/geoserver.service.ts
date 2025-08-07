import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { catchError, Observable, of, throwError } from "rxjs";
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GeoserverService {
  private apiUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) { }

  // Existing methods
  geoserverProjectList(): Observable<any> {
    const config = JSON.parse(localStorage.getItem('geoserverConfig') || '{}');

    return this.http.post<any>(
      `${this.apiUrl}/geoserver/workspaces`,
      {
        geoserverurl: config.geoserverurl,
        username: config.geoserverUsername,
        password: config.geoserverPassword
      }
    );
  }

  geoserverProjectCreate(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/geoserver/createWorkspaces`,
      payload
    );
  }

  geoserverDataStoreList(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/geoserver/getDatastoreList`,
      payload
    );
  }

  geoserverDataStoreCreate(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/geoserver/createDatastore`,
      payload
    );
  }

  geoserverLayerList(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/geoserver/getDatastoreTable`,
      payload
    );
  }

  geoserverUploadfile(payload: FormData): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/import/publish-shp`,
      payload
    );
  }

  getTables(payload: any): Observable<any> {
    const url = `${this.apiUrl}/get-tables`;
    return this.http.post<any>(url, payload).pipe(
      catchError((error) => {
        console.error('Error fetching tables:', error);
        return throwError(() => new Error('Failed to fetch tables.'));
      })
    );
  }

  getColumnsByTable(payload: any): Observable<any> {
    const url = `${this.apiUrl}/get-columns`;
    return this.http.post<any>(url, payload).pipe(
      catchError((error) => {
        console.error('Error fetching columns:', error);
        return throwError(() => new Error('Failed to fetch columns.'));
      })
    );
  }

  // New method for query functionality
  getColumnTypes(payload: any): Observable<any> {
    const url = `${this.apiUrl}/get-column-types`;
    return this.http.post<any>(url, payload).pipe(
      catchError((error) => {
        console.error('Error fetching column types:', error);
        return throwError(() => new Error('Failed to fetch column types.'));
      })
    );
  }

  // New method for applying CQL filters
  applyLayerFilter(payload: any): Observable<any> {
    const url = `${this.apiUrl}/apply-layer-filter`;
    return this.http.post<any>(url, payload).pipe(
      catchError((error) => {
        console.error('Error applying layer filter:', error);
        return throwError(() => new Error('Failed to apply layer filter.'));
      })
    );
  }

  getChartData(payload: any): Observable<any[]> {
    const url = `${this.apiUrl}/get-chart-data`;
    return this.http.post<any[]>(url, payload).pipe(
      catchError((error) => {
        console.error('Error fetching chart data:', error);
        return throwError(() => new Error('Failed to fetch chart data.'));
      })
    );
  }

  testDatabaseConnection(payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/test-db-connection`, payload).pipe(
      catchError((error) => {
        console.error('📛 testDatabaseConnection error:', error);
        return throwError(() => error);
      })
    );
  }

  testGeoServerConnection(payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/test-geoserver-connection`, payload).pipe(
      catchError((error) => {
        console.error('GeoServer connection test failed:', error);
        return throwError(() => error);
      })
    );
  }
}