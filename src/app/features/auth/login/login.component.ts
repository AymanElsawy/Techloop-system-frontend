import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { httpErrorMessage } from '../../../core/http/http-error';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(this.loginErrorMessage(err));
      },
    });
  }

  private loginErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 401) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      if (err.status === 403) return 'هذا الحساب موقوف. تواصل مع الإدارة.';
    }
    return httpErrorMessage(err);
  }
}
