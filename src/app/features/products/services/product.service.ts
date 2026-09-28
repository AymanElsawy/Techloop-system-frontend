import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response';
import { Product, ProductFilters, ProductInput } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/products`;

  getProducts(filters: ProductFilters = {}): Observable<Product[]> {
    const params = new HttpParams({ fromObject: { ...filters } });
    return this.http.get<ApiResponse<Product[]>>(this.url, { params }).pipe(map(({ data }) => data));
  }

  getProduct(id: string): Observable<Product> {
    return this.http.get<ApiResponse<Product>>(`${this.url}/${id}`).pipe(map(({ data }) => data));
  }

  createProduct(data: ProductInput): Observable<Product> {
    return this.http.post<ApiResponse<Product>>(this.url, data).pipe(map(({ data }) => data));
  }

  updateProduct(id: string, data: Partial<ProductInput>): Observable<Product> {
    return this.http.patch<ApiResponse<Product>>(`${this.url}/${id}`, data).pipe(map(({ data }) => data));
  }
}
