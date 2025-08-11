import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class RasterAnalysisService {

  private apiKey = '50f76304204a9aac64cc54bef9b5fe6a';
  private baseUrl = 'https://portal.opentopography.org/API/globaldem';

  constructor(private http: HttpClient) {}

  downloadDemTile(bbox: number[], demType: string, format: string = 'GTiff'): Observable<Blob> {
    const [minLon, minLat, maxLon, maxLat] = bbox;

    const params = new HttpParams()
      .set('demtype', demType)
      .set('west', minLon.toString())
      .set('south', minLat.toString())
      .set('east', maxLon.toString())
      .set('north', maxLat.toString())
      .set('outputFormat', format)
      .set('API_Key', this.apiKey);

    return this.http.get(this.baseUrl, { params, responseType: 'blob' });
  }
}
