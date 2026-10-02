import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { UserRole } from './auth.models';
import { AuthService } from './auth.service';

/** UI-only gate. The backend is the real authority on permissions. */
export const roleGuard =
  (...roles: UserRole[]): CanActivateFn =>
  () =>
    inject(AuthService).hasRole(...roles) || inject(Router).createUrlTree(['/dashboard']);

/** Like roleGuard, but redirects failures to `redirectTo` instead of `/dashboard` (for roles with no dashboard). */
export const roleGuardTo =
  (redirectTo: string, ...roles: UserRole[]): CanActivateFn =>
  () =>
    inject(AuthService).hasRole(...roles) || inject(Router).createUrlTree([redirectTo]);
