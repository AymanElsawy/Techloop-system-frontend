import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response';
import {
  CashBox,
  ChequeStatus,
  Deposit,
  DepositDetails,
  Payment,
  TreasuryEntry,
  TreasuryEntryType,
  TreasurySummary,
} from '../models/treasury.model';
import { PaymentMethod } from '../../invoices/models/invoice.model';

@Injectable({ providedIn: 'root' })
export class TreasuryService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/treasury`;

  private params(repId?: string) {
    return new HttpParams({ fromObject: repId ? { repId } : {} });
  }

  getSummary(): Observable<TreasurySummary> {
    return this.http.get<ApiResponse<TreasurySummary>>(`${this.url}/summary`).pipe(map(({ data }) => data));
  }

  /** Managers: pass a rep; reps always get their own. */
  getPending(repId?: string): Observable<Payment[]> {
    return this.http
      .get<ApiResponse<Payment[]>>(`${this.url}/pending`, { params: this.params(repId) })
      .pipe(map(({ data }) => data));
  }

  getDeposits(repId?: string): Observable<Deposit[]> {
    return this.http
      .get<ApiResponse<Deposit[]>>(`${this.url}/deposits`, { params: this.params(repId) })
      .pipe(map(({ data }) => data));
  }

  getDeposit(id: string): Observable<DepositDetails> {
    return this.http.get<ApiResponse<DepositDetails>>(`${this.url}/deposits/${id}`).pipe(map(({ data }) => data));
  }

  createDeposit(data: {
    repId: string;
    invoiceIds: string[];
    collectionIds: string[];
    expenseIds: string[];
    notes: string | null;
  }): Observable<DepositDetails> {
    return this.http.post<ApiResponse<DepositDetails>>(`${this.url}/deposits`, data).pipe(map(({ data }) => data));
  }

  /** Managers: all (filters optional). A rep: their own expenses. */
  getEntries(filters: { repId?: string; pending?: boolean } = {}): Observable<TreasuryEntry[]> {
    const params = new HttpParams({
      fromObject: { ...(filters.repId && { repId: filters.repId }), ...(filters.pending && { pending: 'true' }) },
    });
    return this.http.get<ApiResponse<TreasuryEntry[]>>(`${this.url}/entries`, { params }).pipe(map(({ data }) => data));
  }

  /** A rep: an expense paid from their cash box (always cash; waits for the handover). */
  createRepExpense(data: { amount: number; category: string | null; notes: string | null }): Observable<TreasuryEntry> {
    return this.http.post<ApiResponse<TreasuryEntry>>(`${this.url}/entries`, data).pipe(map(({ data }) => data));
  }

  /** A rep's own cash box. */
  getCashBox(): Observable<CashBox> {
    return this.http.get<ApiResponse<CashBox>>(`${this.url}/cash-box`).pipe(map(({ data }) => data));
  }

  createEntry(data: {
    type: TreasuryEntryType;
    amount: number;
    paymentMethod: PaymentMethod;
    category: string | null;
    notes: string | null;
  }): Observable<TreasuryEntry> {
    return this.http.post<ApiResponse<TreasuryEntry>>(`${this.url}/entries`, data).pipe(map(({ data }) => data));
  }

  cancelEntry(id: string, reason: string): Observable<TreasuryEntry> {
    return this.http
      .patch<ApiResponse<TreasuryEntry>>(`${this.url}/entries/${id}/cancel`, { reason })
      .pipe(map(({ data }) => data));
  }

  /** Received cheques in the treasury, not cashed or bounced yet. */
  getCheques(): Observable<Payment[]> {
    return this.http.get<ApiResponse<Payment[]>>(`${this.url}/cheques`).pipe(map(({ data }) => data));
  }

  setChequeStatus(p: Pick<Payment, 'kind' | 'id'>, status: ChequeStatus): Observable<unknown> {
    return this.http.patch(`${this.url}/cheques/${p.id}`, { kind: p.kind, status });
  }
}
