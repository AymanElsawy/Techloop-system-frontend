import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response';
import { GeoLocation } from '../../../core/services/geolocation';
import { CompleteVisitRequest, CreateVisitRequest, Visit, VisitFilters } from '../models/visit.model';

@Injectable({ providedIn: 'root' })
export class VisitService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/visits`;

  getVisits(filters: VisitFilters = {}): Observable<Visit[]> {
    const params = new HttpParams({ fromObject: { ...filters } });
    return this.http.get<ApiResponse<Visit[]>>(this.url, { params }).pipe(map(({ data }) => data));
  }

  getVisit(id: string): Observable<Visit> {
    return this.http.get<ApiResponse<Visit>>(`${this.url}/${id}`).pipe(map(({ data }) => data));
  }

  createVisit(data: CreateVisitRequest): Observable<Visit> {
    return this.http.post<ApiResponse<Visit>>(this.url, data).pipe(map(({ data }) => data));
  }

  startVisit(id: string, location: GeoLocation | null): Observable<Visit> {
    return this.http
      .post<ApiResponse<Visit>>(`${this.url}/${id}/start`, location ?? {})
      .pipe(map(({ data }) => data));
  }

  completeVisit(id: string, data: CompleteVisitRequest): Observable<Visit> {
    return this.http
      .post<ApiResponse<Visit>>(`${this.url}/${id}/complete`, data)
      .pipe(map(({ data }) => data));
  }

  cancelVisit(id: string, reason?: string): Observable<Visit> {
    return this.http
      .post<ApiResponse<Visit>>(`${this.url}/${id}/cancel`, { reason: reason || null })
      .pipe(map(({ data }) => data));
  }
}
