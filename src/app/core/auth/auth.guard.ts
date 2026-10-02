import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/** A user still on the default password stays on /login, where the change-password popup is. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return (auth.isAuthenticated() && !auth.mustChangePassword()) || inject(Router).createUrlTree(['/login']);
};

/** Keeps signed-in users away from /login. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return !auth.isAuthenticated() || auth.mustChangePassword() || inject(Router).createUrlTree(['/dashboard']);
};
