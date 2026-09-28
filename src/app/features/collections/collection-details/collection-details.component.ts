import { DepositBadgeComponent } from '../../treasury/deposit-badge/deposit-badge.component';
import { Component, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { httpErrorMessage } from '../../../core/http/http-error';
import { AttachmentsComponent } from '../../../shared/components/attachments/attachments.component';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { AttachmentKind, PAYMENT_METHOD_LABELS, PaymentMethod } from '../../invoices/models/invoice.model';
import { CollectionStatus } from '../models/collection.model';
import { CollectionService } from '../services/collection.service';

@Component({
  selector: 'app-collection-details',
  imports: [DepositBadgeComponent, AttachmentsComponent, CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, StatusMessageComponent],
  templateUrl: './collection-details.component.html',
})
export class CollectionDetailsComponent {
  private readonly collectionService = inject(CollectionService);

  /** Route param, bound via withComponentInputBinding. */
  readonly id = input.required<string>();

  protected readonly Status = CollectionStatus;
  protected readonly PaymentMethod = PaymentMethod;
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly isManager = inject(AuthService).hasRole(UserRole.OWNER, UserRole.ADMIN);

  protected readonly collection = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.collectionService.getCollection(params),
  });

  /** Set by the collection form when it saved but a file upload failed. */
  protected readonly uploadFailedOnCreate = !!inject(Router).currentNavigation()?.extras.state?.['uploadFailed'];

  protected readonly downloadFn = (attachmentId: string) =>
    this.collectionService.downloadAttachment(this.id(), attachmentId);
  protected readonly uploadFn = (kind: AttachmentKind, file: File) =>
    this.collectionService
      .uploadAttachment(this.id(), kind, file)
      .pipe(tap((collection) => this.collection.set(collection)));

  protected readonly showCancel = signal(false);
  protected readonly cancelReason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3)],
  });
  protected readonly cancelling = signal(false);
  protected readonly cancelError = signal<string | null>(null);

  protected cancel(): void {
    if (this.cancelReason.invalid || this.cancelling()) return;
    this.cancelling.set(true);
    this.cancelError.set(null);
    this.collectionService.cancelCollection(this.id(), this.cancelReason.value.trim()).subscribe({
      next: (collection) => {
        this.collection.set(collection);
        this.cancelling.set(false);
        this.showCancel.set(false);
      },
      error: (err: unknown) => {
        this.cancelling.set(false);
        this.cancelError.set(httpErrorMessage(err));
      },
    });
  }
}
