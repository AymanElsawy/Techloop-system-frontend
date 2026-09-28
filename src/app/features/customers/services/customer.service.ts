import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response';
import { Customer, CustomerFilters, CustomerInput } from '../models/customer.model';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/customers`;

  getCustomers(filters: CustomerFilters = {}): Observable<Customer[]> {
    const params = new HttpParams({ fromObject: { ...filters } });
    return this.http.get<ApiResponse<Customer[]>>(this.url, { params }).pipe(map(({ data }) => data));
  }

  getCustomer(id: string): Observable<Customer> {
    return this.http.get<ApiResponse<Customer>>(`${this.url}/${id}`).pipe(map(({ data }) => data));
  }

  createCustomer(data: CustomerInput): Observable<Customer> {
    return this.http.post<ApiResponse<Customer>>(this.url, data).pipe(map(({ data }) => data));
  }

  updateCustomer(id: string, data: Partial<CustomerInput>): Observable<Customer> {
    return this.http.patch<ApiResponse<Customer>>(`${this.url}/${id}`, data).pipe(map(({ data }) => data));
  }

  approveCustomer(id: string): Observable<Customer> {
    return this.http.patch<ApiResponse<Customer>>(`${this.url}/${id}/approve`, {}).pipe(map(({ data }) => data));
  }

  rejectCustomer(id: string, reason: string): Observable<Customer> {
    return this.http
      .patch<ApiResponse<Customer>>(`${this.url}/${id}/reject`, { reason })
      .pipe(map(({ data }) => data));
  }
}
