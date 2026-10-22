import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, Page, PageParams } from '../../../core/models/api-response';
import { getPage } from '../../../shared/paged';
import { Returnable, Supplier, SupplierInput, SupplierPayment, SupplierPaymentInput } from '../models/supplier.model';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/suppliers`;

  getSuppliers(filters: { search?: string; active?: boolean } = {}): Observable<Supplier[]> {
    const params = new HttpParams({ fromObject: { ...filters } });
    return this.http.get<ApiResponse<Supplier[]>>(this.url, { params }).pipe(map(({ data }) => data));
  }
  getSuppliersPage(query: { search?: string; active?: boolean } & PageParams): Observable<Page<Supplier>> {
    return getPage(this.http, this.url, query);
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

  /** مرتجع للمورد: what can still go back to this supplier; the server sets the price. */
  getReturnable(supplierId: string): Observable<Returnable[]> {
    return this.http.get<ApiResponse<Returnable[]>>(`${this.url}/${supplierId}/returnable`).pipe(map(({ data }) => data));
  }

  getPayments(supplierId: string): Observable<SupplierPayment[]> {
    return this.http
      .get<ApiResponse<SupplierPayment[]>>(`${this.url}/${supplierId}/payments`)
      .pipe(map(({ data }) => data));
  }

  createPayment(supplierId: string, data: SupplierPaymentInput): Observable<SupplierPayment> {
    return this.http
      .post<ApiResponse<SupplierPayment>>(`${this.url}/${supplierId}/payments`, data)
      .pipe(map(({ data }) => data));
  }

  cancelPayment(paymentId: string, reason: string): Observable<SupplierPayment> {
    return this.http
      .post<ApiResponse<SupplierPayment>>(`${this.url}/payments/${paymentId}/cancel`, { reason })
      .pipe(map(({ data }) => data));
  }
}
