import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response';
import {
  ManualMovement,
  Movement,
  MovementFilters,
  MovementType,
  MyStock,
  StockItemInput,
  Warehouse,
  WarehouseDetails,
  WarehouseSummary,
} from '../models/inventory.model';

const MOVE_PATH: Record<ManualMovement, string> = {
  [MovementType.RECEIVE]: 'receive',
  [MovementType.ISSUE]: 'issue',
  [MovementType.RETURN]: 'return',
};

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/inventory`;

  getWarehouses(): Observable<WarehouseSummary[]> {
    return this.http.get<ApiResponse<WarehouseSummary[]>>(`${this.url}/warehouses`).pipe(map(({ data }) => data));
  }

  getWarehouse(id: string): Observable<WarehouseDetails> {
    return this.http.get<ApiResponse<WarehouseDetails>>(`${this.url}/warehouses/${id}`).pipe(map(({ data }) => data));
  }

  createWarehouse(data: { name: string; notes?: string | null }): Observable<Warehouse> {
    return this.http.post<ApiResponse<Warehouse>>(`${this.url}/warehouses`, data).pipe(map(({ data }) => data));
  }

  updateWarehouse(id: string, data: Partial<Pick<Warehouse, 'name' | 'notes' | 'isActive'>>): Observable<Warehouse> {
    return this.http.patch<ApiResponse<Warehouse>>(`${this.url}/warehouses/${id}`, data).pipe(map(({ data }) => data));
  }

  /** RECEIVE needs no rep; ISSUE and RETURN do. */
  move(
    warehouseId: string,
    type: ManualMovement,
    data: { repId?: string; supplierId?: string; items: StockItemInput[]; notes?: string | null },
  ): Observable<Movement> {
    return this.http
      .post<ApiResponse<Movement>>(`${this.url}/warehouses/${warehouseId}/${MOVE_PATH[type]}`, data)
      .pipe(map(({ data }) => data));
  }

  getMovements(filters: MovementFilters = {}): Observable<Movement[]> {
    const params = new HttpParams({ fromObject: { ...filters } });
    return this.http.get<ApiResponse<Movement[]>>(`${this.url}/movements`, { params }).pipe(map(({ data }) => data));
  }

  getMyStock(): Observable<MyStock> {
    return this.http.get<ApiResponse<MyStock>>(`${this.url}/my-stock`).pipe(map(({ data }) => data));
  }
}
