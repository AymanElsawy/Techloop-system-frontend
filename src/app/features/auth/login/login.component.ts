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
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  /** First login: the popup asks for a new password before entering the app. */
  protected readonly mustChangePassword = this.auth.mustChangePassword;
  protected readonly passwordForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', Validators.required],
  });

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.loading.set(false);
        if (!user.mustChangePassword) this.router.navigateByUrl('/dashboard');
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(this.loginErrorMessage(err));
      },
    });
  }

  protected changePassword(): void {
    const { password, confirm } = this.passwordForm.getRawValue();
    if (this.passwordForm.invalid || this.loading()) return;
    if (password !== confirm) {
      this.error.set('كلمتين المرور مش زي بعض.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    this.auth.changePassword(password).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(
          err instanceof HttpErrorResponse && err.status === 400
            ? 'اختار كلمة مرور غير الافتراضية (8 أحرف على الأقل).'
            : httpErrorMessage(err),
        );
      },
    });
  }

  protected logout(): void {
    this.passwordForm.reset();
    this.error.set(null);
    this.auth.logout();
  }

  private loginErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 401) return 'اسم الدخول أو كلمة المرور غير صحيحة.';
      if (err.status === 403) return 'هذا الحساب موقوف. تواصل مع الإدارة.';
    }
    return httpErrorMessage(err);
  }
}
