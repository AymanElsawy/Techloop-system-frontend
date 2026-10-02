import { Component, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { DatePipe } from '../../../shared/date.pipe';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormControl } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';

import { httpErrorMessage } from '../../../core/http/http-error';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { ShareLinkComponent } from '../../../shared/components/share-link/share-link.component';
import { PAYMENT_METHOD_LABELS, PaymentMethod } from '../../invoices/models/invoice.model';
import { Movement, MovementType } from '../../inventory/models/inventory.model';
import { InventoryService } from '../../inventory/services/inventory.service';
import { Supplier } from '../models/supplier.model';
import { SupplierService } from '../services/supplier.service';

/** /suppliers/:id — supplier info, purchases, debt and payments. */
@Component({
  selector: 'app-supplier-details',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, ShareLinkComponent, StatusMessageComponent],
  templateUrl: './supplier-details.component.html',
})
export class SupplierDetailsComponent {
  private readonly supplierService = inject(SupplierService);
  private readonly inventory = inject(InventoryService);

  readonly id = input.required<string>();

  protected readonly supplier = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.supplierService.getSupplier(params),
  });
  protected readonly purchases = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.inventory.getMovements({ supplierId: params, type: MovementType.RECEIVE }),
  });
  protected readonly payments = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.supplierService.getPayments(params),
  });

  protected readonly methods = Object.values(PaymentMethod);
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;

  protected readonly paying = signal(false);
  protected readonly payForm = inject(NonNullableFormBuilder).group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    paymentMethod: ['' as PaymentMethod | '', Validators.required],
    chequeNumber: [''],
    chequeDueDate: [''],
    notes: [''],
  });
  private readonly payValue = toSignal(this.payForm.valueChanges, { initialValue: this.payForm.getRawValue() });
  protected readonly payIsCheque = computed(() => this.payValue().paymentMethod === PaymentMethod.CHEQUE);
  protected readonly payExceedsDebt = computed(() => Number(this.payValue().amount) > (this.supplier.value()?.debt ?? 0));
  protected readonly paySaving = signal(false);
  protected readonly payError = signal<string | null>(null);

  protected readonly cancellingId = signal<string | null>(null);
  protected readonly cancelReason = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  protected readonly cancelling = signal(false);
  protected readonly cancelError = signal<string | null>(null);

  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phone: [''],
    company: [''],
    address: [''],
    notes: [''],
  });

  protected receiptTotal(m: Movement): number {
    return m.totalCost ?? Math.round(m.items.reduce((sum, i) => sum + i.quantity * (i.unitCost ?? 0), 0) * 100) / 100;
  }

  protected receiptRemaining(m: Movement): number {
    const total = this.receiptTotal(m);
    const paid = m.paidAmount ?? total;
    return Math.round((total - paid) * 100) / 100;
  }

  protected startEdit(s: Supplier): void {
    this.form.setValue({ name: s.name, phone: s.phone ?? '', company: s.company ?? '', address: s.address ?? '', notes: s.notes ?? '' });
    this.error.set(null);
    this.editing.set(true);
  }

  protected save(data: Parameters<SupplierService['updateSupplier']>[1]): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.supplierService.updateSupplier(this.id(), data).subscribe({
      next: (s) => {
        this.saving.set(false);
        this.editing.set(false);
        this.supplier.set(s);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const message = httpErrorMessage(err, 'تعذر حفظ المورد.');
        this.error.set(/already in use/.test(message) ? 'فيه مورد بنفس الاسم.' : message);
      },
    });
  }

  protected saveEdit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.save({ name: v.name.trim(), phone: v.phone.trim() || null, company: v.company.trim() || null, address: v.address.trim() || null, notes: v.notes.trim() || null });
  }

  protected startPay(): void {
    this.payForm.reset({ amount: null, paymentMethod: '', chequeNumber: '', chequeDueDate: '', notes: '' });
    this.payError.set(null);
    this.paying.set(true);
  }

  protected submitPayment(): void {
    if (this.payForm.invalid || this.payExceedsDebt() || this.paySaving()) return;
    const v = this.payForm.getRawValue();
    this.paySaving.set(true);
    this.payError.set(null);
    this.supplierService
      .createPayment(this.id(), {
        amount: Number(v.amount),
        paymentMethod: v.paymentMethod as PaymentMethod,
        chequeNumber: v.paymentMethod === PaymentMethod.CHEQUE ? v.chequeNumber.trim() || null : null,
        chequeDueDate: v.paymentMethod === PaymentMethod.CHEQUE ? v.chequeDueDate || null : null,
        notes: v.notes.trim() || null,
      })
      .subscribe({
        next: () => {
          this.paySaving.set(false);
          this.paying.set(false);
          this.supplier.reload();
          this.payments.reload();
        },
        error: (err: unknown) => {
          this.paySaving.set(false);
          this.payError.set(httpErrorMessage(err, 'تعذر حفظ السداد.'));
        },
      });
  }

  protected startCancel(paymentId: string): void {
    this.cancelReason.reset('');
    this.cancelError.set(null);
    this.cancellingId.set(paymentId);
  }

  protected confirmCancel(): void {
    const paymentId = this.cancellingId();
    if (!paymentId || this.cancelReason.invalid || this.cancelling()) return;
    this.cancelling.set(true);
    this.cancelError.set(null);
    this.supplierService.cancelPayment(paymentId, this.cancelReason.value.trim()).subscribe({
      next: () => {
        this.cancelling.set(false);
        this.cancellingId.set(null);
        this.supplier.reload();
        this.payments.reload();
      },
      error: (err: unknown) => {
        this.cancelling.set(false);
        this.cancelError.set(httpErrorMessage(err));
      },
    });
  }
}
