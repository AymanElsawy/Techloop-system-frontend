import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response';
import { Deposit, DepositDetails, Payment, TreasurySummary } from '../models/treasury.model';

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
    notes: string | null;
  }): Observable<DepositDetails> {
    return this.http.post<ApiResponse<DepositDetails>>(`${this.url}/deposits`, data).pipe(map(({ data }) => data));
  }
}
