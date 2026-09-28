import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { Component, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { concatMap, from, lastValueFrom, toArray } from 'rxjs';

import { httpErrorMessage } from '../../../core/http/http-error';
import { CustomerService } from '../../customers/services/customer.service';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_BYTES,
  AttachmentKind,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  round2,
} from '../../invoices/models/invoice.model';
import { CollectionService } from '../services/collection.service';

/** Collection (payment without a sale) for a customer: /customers/:id/collections/new */
@Component({
  selector: 'app-collection-form',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './collection-form.component.html',
})
export class CollectionFormComponent {
  private readonly router = inject(Router);
  private readonly collectionService = inject(CollectionService);
  private readonly customerService = inject(CustomerService);

  /** Customer id from the route. */
  readonly id = input.required<string>();
  /** Query param: the in-progress visit this entry is made during. */
  readonly visitId = input<string>();

  protected readonly AttachmentKind = AttachmentKind;
  protected readonly methods = Object.values(PaymentMethod);
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly accept = ATTACHMENT_ACCEPT;

  protected readonly customer = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.customerService.getCustomer(params),
  });
  /** Debt minus money already collected but not handed to the treasury (same rule as the backend). */
  protected readonly debt = computed(() => {
    const c = this.customer.value();
    return c ? Math.max(round2(c.debit - c.pendingPayments), 0) : 0;
  });
  protected readonly pendingPayments = computed(() => this.customer.value()?.pendingPayments ?? 0);
  protected readonly isManager = inject(AuthService).hasRole(UserRole.OWNER, UserRole.ADMIN);

  protected readonly form = inject(NonNullableFormBuilder).group({
    receiptNumber: ['', [Validators.required, Validators.maxLength(40)]],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    paymentMethod: ['' as PaymentMethod | '', Validators.required],
    chequeNumber: [''],
    chequeDueDate: [''],
    notes: [''],
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly isCheque = computed(() => this.value().paymentMethod === PaymentMethod.CHEQUE);
  protected readonly remainingAfter = computed(() => round2(this.debt() - (Number(this.value().amount) || 0)));
  /** Mirrors the backend rule: a collection can't exceed the customer's current debt. */
  protected readonly exceedsDebt = computed(() => this.remainingAfter() < 0);

  protected readonly receipt = signal<File | null>(null);
  protected readonly chequeImage = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected fillFullDebt(): void {
    this.form.controls.amount.setValue(this.debt());
  }

  protected pickFile(event: Event, kind: AttachmentKind): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.fileError.set(null);
    if (file && file.size > ATTACHMENT_MAX_BYTES) {
      this.fileError.set('حجم الملف أكبر من 5 ميجابايت.');
      input.value = '';
      return;
    }
    (kind === AttachmentKind.RECEIPT ? this.receipt : this.chequeImage).set(file);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.exceedsDebt() || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);

    const v = this.form.getRawValue();
    try {
      const collection = await lastValueFrom(
        this.collectionService.createCollection({
          receiptNumber: v.receiptNumber.trim(),
          customerId: this.id(),
          visitId: this.visitId() ?? null,
          amount: round2(Number(v.amount)),
          paymentMethod: v.paymentMethod as PaymentMethod,
          chequeNumber: this.isCheque() ? v.chequeNumber.trim() || null : null,
          chequeDueDate: this.isCheque() ? v.chequeDueDate || null : null,
          notes: v.notes.trim() || null,
        }),
      );

      const uploads: [AttachmentKind, File][] = [];
      if (this.receipt()) uploads.push([AttachmentKind.RECEIPT, this.receipt()!]);
      if (this.isCheque() && this.chequeImage()) uploads.push([AttachmentKind.CHEQUE, this.chequeImage()!]);

      let uploadFailed = false;
      try {
        await lastValueFrom(
          from(uploads).pipe(
            concatMap(([kind, file]) => this.collectionService.uploadAttachment(collection.id, kind, file)),
            toArray(),
          ),
        );
      } catch {
        uploadFailed = true; // the collection exists; files can be re-uploaded from its page
      }
      this.router.navigate(['/collections', collection.id], { state: { uploadFailed } });
    } catch (err) {
      this.saving.set(false);
      this.error.set(
        err instanceof HttpErrorResponse && err.status === 409
          ? 'رقم الإيصال مستخدم من قبل.'
          : err instanceof HttpErrorResponse && err.status === 400
            ? 'المبلغ أكبر من مديونية العميل الحالية. حدّث الصفحة وحاول مرة أخرى.'
            : httpErrorMessage(err, 'تعذر حفظ التحصيل. حاول مرة أخرى.'),
      );
    }
  }
}
