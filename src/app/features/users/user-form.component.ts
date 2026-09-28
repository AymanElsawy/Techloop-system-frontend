import { Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ROLE_LABELS, UserRole } from '../../core/auth/auth.models';
import { httpErrorMessage } from '../../core/http/http-error';
import { GovernoratePickerComponent } from '../../shared/components/governorate-picker/governorate-picker.component';
import { UserService } from './user.service';
import { InventoryService } from '../inventory/services/inventory.service';

@Component({
  selector: 'app-user-form',
  imports: [GovernoratePickerComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './user-form.component.html',
})
export class UserFormComponent {
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly inventory = inject(InventoryService);

  // OWNER is seed-only; the backend rejects it too.
  protected readonly roles = [UserRole.SALES_REP, UserRole.ADMIN] as const;
  protected readonly roleLabels = ROLE_LABELS;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: [UserRole.SALES_REP as (typeof this.roles)[number], Validators.required],
    warehouse: [''],
  });
  protected readonly warehouses = rxResource({
    stream: () => this.inventory.getWarehouses().pipe(map((list) => list.filter((w) => w.isActive))),
  });

  protected readonly UserRole = UserRole;
  protected readonly governorates = signal<string[]>([]);
  private readonly role = toSignal(this.form.controls.role.valueChanges, { initialValue: this.form.controls.role.value });
  protected readonly isSalesRep = computed(() => this.role() === UserRole.SALES_REP);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);

    const value = this.form.getRawValue();
    this.userService
      .createUser({
        ...value,
        name: value.name.trim(),
        governorates: this.isSalesRep() ? this.governorates() : [],
        warehouse: (this.isSalesRep() && value.warehouse) || null,
      })
      .subscribe({
      next: () => this.router.navigateByUrl('/users'),
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(
          err instanceof HttpErrorResponse && err.status === 409
            ? 'البريد الإلكتروني مستخدم بالفعل.'
            : httpErrorMessage(err, 'تعذر إنشاء المستخدم. حاول مرة أخرى.'),
        );
      },
    });
  }
}
