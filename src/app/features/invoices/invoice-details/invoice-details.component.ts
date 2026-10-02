import { DepositBadgeComponent } from '../../treasury/deposit-badge/deposit-badge.component';
import { Component, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { DatePipe } from '../../../shared/date.pipe';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { httpErrorMessage } from '../../../core/http/http-error';
import { AttachmentsComponent } from '../../../shared/components/attachments/attachments.component';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { PRODUCT_UNIT_LABELS } from '../../products/models/product.model';
import { AttachmentKind, DEFERRED_LABEL, InvoiceStatus, PAYMENT_METHOD_LABELS, PaymentMethod } from '../models/invoice.model';
import { InvoiceService } from '../services/invoice.service';

@Component({
  selector: 'app-invoice-details',
  imports: [DepositBadgeComponent, AttachmentsComponent, CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, StatusMessageComponent],
  templateUrl: './invoice-details.component.html',
})
export class InvoiceDetailsComponent {
  private readonly invoiceService = inject(InvoiceService);

  /** Route param, bound via withComponentInputBinding. */
  readonly id = input.required<string>();

  protected readonly Status = InvoiceStatus;
  protected readonly PaymentMethod = PaymentMethod;
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly unitLabels = PRODUCT_UNIT_LABELS;
  protected readonly isManager = inject(AuthService).hasRole(UserRole.OWNER, UserRole.ADMIN);

  protected readonly invoice = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.invoiceService.getInvoice(params),
  });

  /** Set by the invoice form when the invoice saved but a file upload failed. */
  protected readonly uploadFailedOnCreate = !!inject(Router).currentNavigation()?.extras.state?.['uploadFailed'];

  protected readonly downloadFn = (attachmentId: string) =>
    this.invoiceService.downloadAttachment(this.id(), attachmentId);
  protected readonly uploadFn = (kind: AttachmentKind, file: File) =>
    this.invoiceService.uploadAttachment(this.id(), kind, file).pipe(tap((invoice) => this.invoice.set(invoice)));

  // Cancel
  protected readonly showCancel = signal(false);
  protected readonly cancelReason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3)],
  });
  protected readonly cancelling = signal(false);
  protected readonly cancelError = signal<string | null>(null);

  protected readonly paymentLabel = computed(() => {
    const inv = this.invoice.value();
    return inv?.paymentMethod ? this.methodLabels[inv.paymentMethod] : DEFERRED_LABEL;
  });

  protected cancel(): void {
    if (this.cancelReason.invalid || this.cancelling()) return;
    this.cancelling.set(true);
    this.cancelError.set(null);
    this.invoiceService.cancelInvoice(this.id(), this.cancelReason.value.trim()).subscribe({
      next: (invoice) => {
        this.invoice.set(invoice);
        this.cancelling.set(false);
        this.showCancel.set(false);
      },
      error: (err: unknown) => {
        this.cancelling.set(false);
        this.cancelError.set(httpErrorMessage(err));
      },
    });
  }

  /** Only the remaining part of an invoice matters; the customer page shows the FIFO overdue total. */
  protected isPastDue(dueDate: string): boolean {
    return new Date(dueDate) < new Date();
  }
}
