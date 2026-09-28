import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response';
import { Supplier, SupplierInput } from '../models/supplier.model';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/suppliers`;

  getSuppliers(filters: { search?: string; active?: boolean } = {}): Observable<Supplier[]> {
    const params = new HttpParams({ fromObject: { ...filters } });
    return this.http.get<ApiResponse<Supplier[]>>(this.url, { params }).pipe(map(({ data }) => data));
  }

  getSupplier(id: string): Observable<Supplier> {
    return this.http.get<ApiResponse<Supplier>>(`${this.url}/${id}`).pipe(map(({ data }) => data));
  }

  createSupplier(data: SupplierInput): Observable<Supplier> {
    return this.http.post<ApiResponse<Supplier>>(this.url, data).pipe(map(({ data }) => data));
  }

  updateSupplier(id: string, data: Partial<SupplierInput & { isActive: boolean }>): Observable<Supplier> {
    return this.http.patch<ApiResponse<Supplier>>(`${this.url}/${id}`, data).pipe(map(({ data }) => data));
  }
}
