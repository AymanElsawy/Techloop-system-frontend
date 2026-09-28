import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();
  const isApi = req.url.startsWith(environment.apiUrl);

  // Only attach the token to our own API, never to third-party URLs.
  const request = token && isApi ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // Expired/revoked token mid-session: drop the session and go to /login.
      if (error.status === 401 && isApi && auth.isAuthenticated()) auth.logout();
      return throwError(() => error);
    }),
  );
};
