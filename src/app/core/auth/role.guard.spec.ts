import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { authGuard } from './auth.guard';
import { UserRole } from './auth.models';
import { AuthService } from './auth.service';
import { roleGuard } from './role.guard';

describe('auth guards', () => {
  const run = (guard: typeof authGuard) =>
    TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

  function loginAs(role: UserRole) {
    TestBed.inject(AuthService).login({ email: 'a@b.co', password: 'Password123!' }).subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/auth/login'))
      .flush({ success: true, data: { accessToken: 't', user: { id: '1', name: 'A', email: 'a@b.co', role } } });
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  });

  it('redirects anonymous users to /login', () => {
    expect((run(authGuard) as UrlTree).toString()).toBe('/login');
  });

  it('lets owners into management routes', () => {
    loginAs(UserRole.OWNER);
    expect(run(authGuard)).toBe(true);
    expect(run(roleGuard(UserRole.OWNER, UserRole.ADMIN))).toBe(true);
  });

  it('sends sales reps from management routes to /dashboard', () => {
    loginAs(UserRole.SALES_REP);
    expect((run(roleGuard(UserRole.OWNER, UserRole.ADMIN)) as UrlTree).toString()).toBe('/dashboard');
  });
});
