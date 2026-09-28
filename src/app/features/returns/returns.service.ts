import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response';
import { CreateReturnRequest, SalesReturn } from './returns.model';

@Injectable({ providedIn: 'root' })
export class ReturnsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/returns`;

  getReturns(filters: { customerId?: string; invoiceId?: string } = {}): Observable<SalesReturn[]> {
    return this.http
      .get<ApiResponse<SalesReturn[]>>(this.url, { params: new HttpParams({ fromObject: filters }) })
      .pipe(map(({ data }) => data));
  }

  getReturn(id: string): Observable<SalesReturn> {
    return this.http.get<ApiResponse<SalesReturn>>(`${this.url}/${id}`).pipe(map(({ data }) => data));
  }

  createReturn(data: CreateReturnRequest): Observable<SalesReturn> {
    return this.http.post<ApiResponse<SalesReturn>>(this.url, data).pipe(map(({ data }) => data));
  }

  cancelReturn(id: string, reason: string): Observable<SalesReturn> {
    return this.http
      .patch<ApiResponse<SalesReturn>>(`${this.url}/${id}/cancel`, { reason })
      .pipe(map(({ data }) => data));
  }
}
