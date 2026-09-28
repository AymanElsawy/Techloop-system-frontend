import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response';
import { User, UserRole } from '../../core/auth/auth.models';

export interface ManagedUser extends User {
  isActive: boolean;
  /** Sales rep's warehouse id. */
  warehouse: string | null;
  lastLoginAt?: string;
  createdAt: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole.ADMIN | UserRole.SALES_REP;
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

  setPassword(id: string, password: string): Observable<ManagedUser> {
    return this.http
      .patch<ApiResponse<ManagedUser>>(`${this.url}/${id}`, { password })
      .pipe(map(({ data }) => data));
  }
}
