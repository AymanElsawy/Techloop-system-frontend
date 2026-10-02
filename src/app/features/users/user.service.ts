import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response';
import { User, UserRole } from '../../core/auth/auth.models';
import { PaymentMethod } from '../invoices/models/invoice.model';

export interface ManagedUser extends User {
  isActive: boolean;
  /** Sales rep's warehouse id. */
  warehouse: string | null;
  lastLoginAt?: string;
  createdAt: string;
}

/** ?month=YYYY-MM or ?year=YYYY. */
export type TargetPeriod = { month: string } | { year: string };

/** Monthly (salesTarget / collectionTarget) and yearly targets; null = none. */
export interface RepTargets {
  salesTarget: number | null;
  collectionTarget: number | null;
  yearlySalesTarget: number | null;
  yearlyCollectionTarget: number | null;
  salesCommissionRate: number;
  collectionCommissionRate: number;
}

/**
 * GET /users/targets: a rep's month (or year) against that period's target (*Goal).
 * Progress is % of the goal, null = no target for the period.
 */
export interface TargetRow extends RepTargets {
  id: string;
  salesGoal: number | null;
  collectionGoal: number | null;
  name: string;
  isActive: boolean;
  sales: number;
  returns: number;
  netSales: number;
  collected: number;
  salesProgress: number | null;
  collectionProgress: number | null;
  salesCommission: number;
  collectionCommission: number;
  commission: number;
}

type Doc = { id: string; createdAt: string; customer: { id: string; name: string } };

export interface TargetReport {
  period: 'MONTH' | 'YEAR';
  key: string; // YYYY-MM or YYYY
  reps: TargetRow[];
}

/** GET /users/targets/:id: one rep's month (or year) and the documents behind it. */
export interface RepTargetReport {
  period: 'MONTH' | 'YEAR';
  key: string;
  rep: TargetRow;
  invoices: (Doc & { invoiceNumber: string; total: number; paidAmount: number; paymentMethod: PaymentMethod | null; chequeStatus: string | null })[];
  collections: (Doc & { receiptNumber: string; amount: number; paymentMethod: PaymentMethod; chequeNumber: string | null; chequeStatus: string | null })[];
  returns: (Doc & { number: number; total: number; invoice: { id: string; invoiceNumber: string } })[];
}

export interface CreateUserRequest {
  name: string;
  username: string;
  role: UserRole.ADMIN | UserRole.SALES_REP | UserRole.WAREHOUSE_REP;
  governorates?: string[];
  warehouse?: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/users`;

  getUsers(): Observable<ManagedUser[]> {
    return this.http.get<ApiResponse<ManagedUser[]>>(this.url).pipe(map(({ data }) => data));
  }

  createUser(data: CreateUserRequest): Observable<ManagedUser> {
    return this.http.post<ApiResponse<ManagedUser>>(this.url, data).pipe(map(({ data }) => data));
  }

  setGovernorates(id: string, governorates: string[]): Observable<ManagedUser> {
    return this.http
      .patch<ApiResponse<ManagedUser>>(`${this.url}/${id}`, { governorates })
      .pipe(map(({ data }) => data));
  }

  setWarehouse(id: string, warehouse: string | null): Observable<ManagedUser> {
    return this.http
      .patch<ApiResponse<ManagedUser>>(`${this.url}/${id}`, { warehouse })
      .pipe(map(({ data }) => data));
  }

  getTargets(params: TargetPeriod): Observable<TargetReport> {
    return this.http
      .get<ApiResponse<TargetReport>>(`${this.url}/targets`, { params })
      .pipe(map(({ data }) => data));
  }

  getRepTargets(id: string, params: TargetPeriod): Observable<RepTargetReport> {
    return this.http
      .get<ApiResponse<RepTargetReport>>(`${this.url}/targets/${id}`, { params })
      .pipe(map(({ data }) => data));
  }

  setTargets(id: string, targets: RepTargets): Observable<ManagedUser> {
    return this.http.patch<ApiResponse<ManagedUser>>(`${this.url}/${id}`, targets).pipe(map(({ data }) => data));
  }

  setPassword(id: string, password: string): Observable<ManagedUser> {
    return this.http
      .patch<ApiResponse<ManagedUser>>(`${this.url}/${id}`, { password })
      .pipe(map(({ data }) => data));
  }
}
