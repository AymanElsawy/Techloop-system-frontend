import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { httpErrorMessage } from '../../../core/http/http-error';
import { CustomerStatus } from '../../customers/models/customer.model';
import { CustomerService } from '../../customers/services/customer.service';
import { UserService } from '../../users/user.service';
import { VISIT_PURPOSE_LABELS, VisitPurpose } from '../models/visit.model';
import { VisitService } from '../services/visit.service';

/** /visits/new, optionally ?customerId=… from the customer page. */
@Component({
  selector: 'app-visit-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './visit-form.component.html',
})
export class VisitFormComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly visitService = inject(VisitService);
  private readonly customerService = inject(CustomerService);
  private readonly userService = inject(UserService);

  /** Query param to preselect the customer. */
  readonly customerId = input<string>();

  protected readonly purposes = Object.values(VisitPurpose);
  protected readonly purposeLabels = VISIT_PURPOSE_LABELS;

  /** Sales reps always create visits for themselves; management picks the rep. */
  protected readonly canPickRep = this.auth.hasRole(UserRole.OWNER, UserRole.ADMIN);

  protected readonly customers = rxResource({
    stream: () =>
      this.customerService
        .getCustomers()
        .pipe(map((customers) => customers.filter((c) => c.status !== CustomerStatus.REJECTED))),
  });

  protected readonly salesReps = rxResource({
    params: () => this.canPickRep || undefined,
    stream: () =>
      this.userService
        .getUsers()
        .pipe(map((users) => users.filter((u) => u.role === UserRole.SALES_REP && u.isActive))),
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    salesRepId: ['', this.canPickRep ? Validators.required : []],
    customerId: ['', Validators.required],
    purpose: [VisitPurpose.SALE, Validators.required],
    date: [new Date().toLocaleDateString('en-CA'), Validators.required],
    time: [new Date().toTimeString().slice(0, 5), Validators.required],
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** A rep can only visit customers in their region; managers see the chosen rep's customers. */
  protected readonly availableCustomers = computed(() => {
    const all = this.customers.value() ?? [];
    if (!this.canPickRep) return all;
    const rep = this.salesReps.value()?.find((r) => r.id === this.value().salesRepId);
    return rep ? all.filter((c) => rep.governorates.includes(c.governorate)) : [];
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const customerId = this.customerId();
    if (customerId) this.form.controls.customerId.setValue(customerId);
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) return;
    const { customerId, salesRepId, purpose, date, time } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);

    this.visitService
      .createVisit({
        customerId,
        purpose,
        scheduledAt: new Date(`${date}T${time}`).toISOString(),
        ...(this.canPickRep && { salesRepId }),
      })
      .subscribe({
        next: (visit) => this.router.navigate(['/visits', visit.id]),
        error: (err: unknown) => {
          this.saving.set(false);
          this.error.set(httpErrorMessage(err, 'تعذر إنشاء الزيارة. حاول مرة أخرى.'));
        },
      });
  }
}
