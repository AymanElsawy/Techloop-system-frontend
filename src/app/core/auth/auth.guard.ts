import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () =>
  inject(AuthService).isAuthenticated() || inject(Router).createUrlTree(['/login']);

/** Keeps signed-in users away from /login. */
export const guestGuard: CanActivateFn = () =>
  !inject(AuthService).isAuthenticated() || inject(Router).createUrlTree(['/dashboard']);
