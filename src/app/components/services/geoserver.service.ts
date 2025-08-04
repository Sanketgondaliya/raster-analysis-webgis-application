import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { catchError, Observable, of, throwError } from "rxjs";
import { environment } from '../../environments/environment';

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
  getTables(dbName: string, schemaName: string): Observable<any> {
    const payload = {
      dbName: dbName,
      schemaName: schemaName
    };

    // Assuming this.apiUrl is already the correct base URL
    const url = `${this.apiUrl}/get-tables`;

    return this.http.post<any>(url, payload).pipe(
      catchError((error) => {
        // Handle errors if the API call fails
        console.error('Error fetching tables:', error);
        return throwError(() => new Error('Failed to fetch tables.'));
      })
    );
  }
  // geoserver.service.ts
  getColumnsByTable(dbName: string, schemaName: string, tableName: string): Observable<any> {
    const payload = { dbName, schemaName, tableName };
    const url = `${this.apiUrl}/get-columns`;

    return this.http.post<any>(url, payload).pipe(
      catchError((error) => {
        console.error('Error fetching columns:', error);
        return throwError(() => new Error('Failed to fetch columns.'));
      })
    );
  }
  getChartData(dbName: string, schemaName: string, tableName: string, xColumn: string, yColumn: string, chartType: string, analysisType: string): Observable<any[]> {
    const payload = {
      dbName,
      schemaName,
      tableName,
      xColumn,
      yColumn,
      chartType,
      analysisType
    };
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
        return throwError(() => error); // 🔁 Pass full error to component
      })
    );
  }
  testGeoServerConnection(payload: any): Observable<any> {
  return this.http.post<any>(`${this.apiUrl}/test-geoserver-connection`, payload).pipe(
    catchError((error) => {
      console.error('GeoServer connection test failed:', error);
      return throwError(() => error); // Preserve error for display
    })
  );
}


}
