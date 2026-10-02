import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, firstValueFrom, map, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response';
import { LoginRequest, LoginResponse, User, UserRole } from './auth.models';

// ponytail: token in localStorage (readable by XSS); move to HttpOnly cookie before production.
const TOKEN_KEY = 'accessToken';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly url = `${environment.apiUrl}/auth`;

  private readonly user = signal<User | null>(null);

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly mustChangePassword = computed(() => !!this.user()?.mustChangePassword);

  login(credentials: LoginRequest): Observable<User> {
    return this.http.post<ApiResponse<LoginResponse>>(`${this.url}/login`, credentials).pipe(
      tap(({ data }) => {
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        this.user.set(data.user);
      }),
      map(({ data }) => data.user),
    );
  }

  /** First-login password change. */
  changePassword(password: string): Observable<User> {
    return this.http.post<ApiResponse<User>>(`${this.url}/change-password`, { password }).pipe(
      map(({ data }) => data),
      tap((user) => this.user.set(user)),
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.user.set(null);
    this.router.navigateByUrl('/login');
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<ApiResponse<User>>(`${this.url}/me`).pipe(
      map(({ data }) => data),
      tap((user) => this.user.set(user)),
    );
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  hasRole(...roles: UserRole[]): boolean {
    const user = this.user();
    return !!user && roles.includes(user.role);
  }

  /** Called once at startup: validates a stored token via /auth/me. */
  restoreSession(): Promise<unknown> {
    if (!this.getToken()) return Promise.resolve();
    return firstValueFrom(
      this.getCurrentUser().pipe(
        catchError(() => {
          localStorage.removeItem(TOKEN_KEY);
          return of(null);
        }),
      ),
    );
  }
}
