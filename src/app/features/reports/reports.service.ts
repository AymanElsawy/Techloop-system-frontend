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

export type PartyKind = 'customers' | 'suppliers';

/** One document in a customer / supplier report, oldest first. */
export interface ReportLine {
  kind: 'invoice' | 'return' | 'collection' | 'receipt' | 'payment';
  id: string;
  number: string;
  date: string;
  /** Customer: the sale. Supplier: the purchase. */
  debit: number;
  /** Customer: paid, collected or returned. Supplier: what the company paid. */
  credit: number;
  /** Payment method; null on an invoice = deferred. */
  method: string | null;
  /** Bounced cheque: listed, not counted as paid. */
  bounced: boolean;
  /** Paid, but the money is still with the rep (already deducted from the balance). */
  pending: boolean;
  /** Running balance after this line, like كشف الحساب. */
  balance: number;
}

export interface CustomersReport {
  from: string;
  to: string;
  rows: {
    customer: { id: string; name: string; governorate: string };
    invoices: number;
    sales: number;
    returns: number;
    net: number;
    profit: number;
    collected: number;
    /** Today's balance: positive = the customer owes. */
    balance: number;
  }[];
  totals: { invoices: number; sales: number; returns: number; net: number; profit: number; collected: number; balance: number };
}

export interface CustomerReport {
  from: string;
  to: string;
  customer: { id: string; name: string; governorate: string; phone: string | null; balance: number };
  /** Balance before `from` / after `to` (positive = the customer owes). */
  opening: number;
  closing: number;
  totals: { invoices: number; sales: number; returns: number; net: number; cost: number; profit: number; collected: number };
  products: SalesRow[];
  lines: ReportLine[];
}

export interface SuppliersReport {
  from: string;
  to: string;
  rows: {
    supplier: { id: string; name: string; phone: string | null };
    receipts: number;
    purchases: number;
    paid: number;
    /** Today's debt: what the company owes. */
    debt: number;
  }[];
  totals: { receipts: number; purchases: number; paid: number; debt: number };
}

export interface SupplierReport {
  from: string;
  to: string;
  supplier: { id: string; name: string; phone: string | null; debt: number };
  /** Debt before `from` / after `to` (what we owe). */
  opening: number;
  closing: number;
  totals: { receipts: number; purchases: number; paid: number };
  products: PurchasesReport['rows'];
  lines: ReportLine[];
}

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

  /** All customers / suppliers, or one of them (`id`), in [from, to] (empty = this month). */
  getParty<T>(path: string, from: string, to: string): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(`${this.url}/${path}`, { params: this.dates(from, to) })
      .pipe(map(({ data }) => data));
  }

  dates(from: string, to: string): Record<string, string> {
    return { ...(from && { from }), ...(to && { to }) };
  }

  /** Downloads the report as a CSV file (opens in Excel). */
  download(
    /** sales | aging | purchases | customers[/id] | suppliers[/id] */
    report: string,
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
