import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response';

export type GroupBy = 'product' | 'governorate' | 'rep';

export const GROUP_LABELS: Record<GroupBy, string> = { product: 'الصنف', governorate: 'المحافظة', rep: 'المندوب' };

export interface SalesRow {
  id: string;
  name: string;
  quantity: number;
  invoices: number;
  sales: number;
  returns: number;
  net: number;
  cost: number;
  profit: number;
  /** Some lines had no purchase price (cost counted as 0). */
  costMissing: boolean;
}

export interface SalesReport {
  groupBy: GroupBy;
  from: string;
  to: string;
  rows: SalesRow[];
  totals: { invoices: number; sales: number; returns: number; net: number; cost: number; profit: number };
}

export interface AgingReport {
  buckets: string[]; // لم يستحق, 0-30, 31-60, 61-90, 90+ (days past due)
  rows: {
    customer: { id: string; name: string; governorate: string; phone: string | null };
    debt: number;
    pending: number;
    buckets: number[];
    oldestDays: number;
  }[];
  totals: { debt: number; pending: number; buckets: number[] };
}

export interface PurchasesReport {
  from: string | null;
  to: string | null;
  /** One row per product + supplier, cheapest average first within a product. */
  rows: {
    product: { id: string; name: string };
    supplier: { id: string; name: string };
    receipts: number;
    quantity: number;
    total: number;
    avgCost: number;
    minCost: number;
    maxCost: number;
    lastCost: number;
    lastAt: string;
    currentAvgCost: number | null;
  }[];
  totals: { quantity: number; total: number };
}

export type SalesQuery = { groupBy: GroupBy; from: string; to: string };

/** Managers only. `format=csv` gives the same report as an Excel-ready file. */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/reports`;

  getSales(q: SalesQuery): Observable<SalesReport> {
    return this.http
      .get<ApiResponse<SalesReport>>(`${this.url}/sales`, { params: new HttpParams({ fromObject: q }) })
      .pipe(map(({ data }) => data));
  }

  getAging(): Observable<AgingReport> {
    return this.http.get<ApiResponse<AgingReport>>(`${this.url}/aging`).pipe(map(({ data }) => data));
  }

  /** Empty dates = all purchases. */
  getPurchases(from: string, to: string): Observable<PurchasesReport> {
    return this.http
      .get<ApiResponse<PurchasesReport>>(`${this.url}/purchases`, { params: this.dates(from, to) })
      .pipe(map(({ data }) => data));
  }

  dates(from: string, to: string): Record<string, string> {
    return { ...(from && { from }), ...(to && { to }) };
  }

  /** Downloads the report as a CSV file (opens in Excel). */
  download(
    report: 'sales' | 'aging' | 'purchases',
    filename: string,
    q: Partial<SalesQuery> = {},
  ): Observable<void> {
    return this.http
      .get(`${this.url}/${report}`, {
        params: new HttpParams({ fromObject: { ...q, format: 'csv' } }),
        responseType: 'blob',
      })
      .pipe(
        map((blob) => {
          const href = URL.createObjectURL(blob);
          Object.assign(document.createElement('a'), { href, download: filename }).click();
          URL.revokeObjectURL(href);
        }),
      );
  }
}
