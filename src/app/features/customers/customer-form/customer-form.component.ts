import { Component, OnInit, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { httpErrorMessage } from '../../../core/http/http-error';
import { GeoLocation, getCurrentLocation } from '../../../core/services/geolocation';
import {
  CUSTOMER_TYPE_LABELS,
  CustomerInput,
  CustomerStatus,
  CustomerType,
  GOVERNORATES,
  Governorate,
} from '../models/customer.model';
import { CustomerService } from '../services/customer.service';

/** Create (/customers/new) and edit (/customers/:id/edit) share this form. */
@Component({
  selector: 'app-customer-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './customer-form.component.html',
})
export class CustomerFormComponent implements OnInit {
  private readonly customerService = inject(CustomerService);
  private readonly router = inject(Router);

  /** Route param; set only in edit mode. */
  readonly id = input<string>();

  private readonly auth = inject(AuthService);
  protected readonly isManager = this.auth.hasRole(UserRole.OWNER, UserRole.ADMIN);
  /** Reps editing a customer that is not their own pending one may only change contact details. */
  protected readonly contactOnly = signal(false);
  /** Reps can only add customers inside their region. */
  protected readonly governorates = this.isManager ? GOVERNORATES : (this.auth.currentUser()?.governorates ?? []);
  protected readonly types = Object.values(CustomerType);
  protected readonly typeLabels = CUSTOMER_TYPE_LABELS;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    type: [CustomerType.CLINIC],
    phone: ['', Validators.pattern(/^\+?[0-9 ]{6,20}$/)],
    contactPerson: [''],
    governorate: ['' as Governorate | '', Validators.required],
    city: [''],
    address: [''],
    notes: [''],
    creditLimit: ['', Validators.min(0)], // managers only; empty = no limit
    paymentTermDays: ['', [Validators.min(0), Validators.max(365), Validators.pattern(/^\d*$/)]], // empty = no terms
    discountPercent: ['', [Validators.min(0), Validators.max(100)]], // empty = none
  });

  protected readonly location = signal<GeoLocation | null>(null);
  protected readonly locating = signal(false);
  protected readonly locationError = signal(false);

  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const id = this.id();
    if (!id) return;
    this.loading.set(true);
    this.loadError.set(false);
    this.customerService.getCustomer(id).subscribe({
      next: (c) => {
        this.form.setValue({
          name: c.name,
          type: c.type,
          phone: c.phone ?? '',
          contactPerson: c.contactPerson ?? '',
          governorate: c.governorate,
          city: c.city ?? '',
          address: c.address ?? '',
          notes: c.notes ?? '',
          creditLimit: c.creditLimit == null ? '' : String(c.creditLimit),
          paymentTermDays: c.paymentTermDays == null ? '' : String(c.paymentTermDays),
          discountPercent: c.discountPercent == null ? '' : String(c.discountPercent),
        });
        this.location.set(c.location);
        const ownPending = c.status === CustomerStatus.PENDING && c.createdBy.id === this.auth.currentUser()?.id;
        if (!this.isManager && !ownPending) {
          this.contactOnly.set(true);
          this.form.controls.name.disable();
          this.form.controls.type.disable();
          this.form.controls.governorate.disable();
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  protected async captureLocation(): Promise<void> {
    this.locating.set(true);
    this.locationError.set(false);
    const location = await getCurrentLocation();
    this.locating.set(false);
    this.location.set(location ?? this.location());
    this.locationError.set(!location);
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);

    const { creditLimit, paymentTermDays, discountPercent, ...v } = this.form.getRawValue();
    const num = (x: string) => (x === '' || x === null ? null : Number(x));
    // Empty strings clear optional fields on the backend.
    const all: CustomerInput = {
      ...v,
      governorate: v.governorate as Governorate,
      location: this.location(),
      ...(this.isManager && {
        creditLimit: num(creditLimit),
        paymentTermDays: num(paymentTermDays),
        discountPercent: num(discountPercent),
      }),
    };
    const { name: _name, type: _type, governorate: _governorate, ...contact } = all;
    const data = this.contactOnly() ? contact : all;
    const id = this.id();
    const request = id
      ? this.customerService.updateCustomer(id, data)
      : this.customerService.createCustomer(all);

    request.subscribe({
      next: (customer) => this.router.navigate(['/customers', customer.id]),
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(
          err instanceof HttpErrorResponse && err.status === 409
            ? 'يوجد عميل مسجل بنفس رقم الهاتف.'
            : httpErrorMessage(err, 'تعذر حفظ العميل. حاول مرة أخرى.'),
        );
      },
    });
  }
}
