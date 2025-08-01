import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { catchError, Observable, throwError } from "rxjs";
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GeoserverService {
  private apiUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) { }

  // Existing methods
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

}
