import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, Page, PageParams } from '../../../core/models/api-response';
import { getPage } from '../../../shared/paged';
import {
  CustodyRequest,
  CustodyRequestStatus,
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
  [MovementType.TRANSFER]: 'transfer',
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
    data: {
      repId?: string;
      supplierId?: string;
      items: StockItemInput[];
      /** RECEIVE only: what's actually paid now; the rest becomes supplier debt. */
      paidAmount?: number;
      notes?: string | null;
    },
  ): Observable<Movement> {
    return this.http
      .post<ApiResponse<Movement>>(`${this.url}/warehouses/${warehouseId}/${MOVE_PATH[type]}`, data)
      .pipe(map(({ data }) => data));
  }

  getMovements(filters: MovementFilters = {}): Observable<Movement[]> {
    const params = new HttpParams({ fromObject: { ...filters } });
    return this.http.get<ApiResponse<Movement[]>>(`${this.url}/movements`, { params }).pipe(map(({ data }) => data));
  }
  getMovementsPage(query: MovementFilters & PageParams): Observable<Page<Movement>> {
    return getPage(this.http, `${this.url}/movements`, query);
  }


  getMovement(id: string): Observable<Movement> {
    return this.http.get<ApiResponse<Movement>>(`${this.url}/movements/${id}`).pipe(map(({ data }) => data));
  }

  getMyStock(): Observable<MyStock> {
    return this.http.get<ApiResponse<MyStock>>(`${this.url}/my-stock`).pipe(map(({ data }) => data));
  }

  // ---------- طلبات العهدة ----------

  /** Reps: their own; warehouse rep: their warehouse; managers: all. */
  getRequests(status?: CustodyRequestStatus): Observable<CustodyRequest[]> {
    const params = new HttpParams({ fromObject: status ? { status } : {} });
    return this.http.get<ApiResponse<CustodyRequest[]>>(`${this.url}/requests`, { params }).pipe(map(({ data }) => data));
  }

  /** Sales rep: ask their warehouse for goods. */
  createRequest(data: { items: StockItemInput[]; notes?: string | null }): Observable<CustodyRequest> {
    return this.http.post<ApiResponse<CustodyRequest>>(`${this.url}/requests`, data).pipe(map(({ data }) => data));
  }

  /** Warehouse rep / manager: issue it to the rep's custody; `items` = the quantities actually issued. */
  issueRequest(id: string, items: StockItemInput[]): Observable<CustodyRequest> {
    return this.http.post<ApiResponse<CustodyRequest>>(`${this.url}/requests/${id}/issue`, { items }).pipe(map(({ data }) => data));
  }

  rejectRequest(id: string, reason: string): Observable<CustodyRequest> {
    return this.http.post<ApiResponse<CustodyRequest>>(`${this.url}/requests/${id}/reject`, { reason }).pipe(map(({ data }) => data));
  }

  /** The rep withdraws their own pending request. */
  cancelRequest(id: string): Observable<CustodyRequest> {
    return this.http.post<ApiResponse<CustodyRequest>>(`${this.url}/requests/${id}/cancel`, {}).pipe(map(({ data }) => data));
  }

  /** تسوية جرد: the counted quantity per product; the backend records the difference. */
  adjust(warehouseId: string, data: { items: { productId: string; counted: number }[]; reason: string }): Observable<Movement> {
    return this.http
      .post<ApiResponse<Movement>>(`${this.url}/warehouses/${warehouseId}/adjust`, data)
      .pipe(map(({ data }) => data));
  }
}
