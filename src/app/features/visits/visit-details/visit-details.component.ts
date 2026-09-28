import { Component, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, forkJoin } from 'rxjs';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { httpErrorMessage } from '../../../core/http/http-error';
import { CollectionStatus } from '../../collections/models/collection.model';
import { CollectionService } from '../../collections/services/collection.service';
import { InvoiceStatus } from '../../invoices/models/invoice.model';
import { InvoiceService } from '../../invoices/services/invoice.service';
import { getCurrentLocation } from '../../../core/services/geolocation';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import {
  VISIT_PURPOSE_LABELS,
  VISIT_STATUS_CLASSES,
  VISIT_STATUS_LABELS,
  Visit,
  VisitStatus,
} from '../models/visit.model';
import { VisitService } from '../services/visit.service';

@Component({
  selector: 'app-visit-details',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, StatusMessageComponent],
  templateUrl: './visit-details.component.html',
})
export class VisitDetailsComponent {
  private readonly visitService = inject(VisitService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly collectionService = inject(CollectionService);
  private readonly auth = inject(AuthService);

  /** Route param, bound via withComponentInputBinding. */
  readonly id = input.required<string>();

  protected readonly Status = VisitStatus;
  protected readonly statusLabels = VISIT_STATUS_LABELS;
  protected readonly statusClasses = VISIT_STATUS_CLASSES;
  protected readonly purposeLabels = VISIT_PURPOSE_LABELS;
  protected readonly InvoiceStatus = InvoiceStatus;
  protected readonly CollectionStatus = CollectionStatus;
  protected readonly isManager = this.auth.hasRole(UserRole.OWNER, UserRole.ADMIN);

  protected readonly visit = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.visitService.getVisit(params),
  });

  /** Only the assigned rep starts, completes and sells/collects during the visit. */
  protected readonly isAssignedRep = computed(() => this.visit.value()?.salesRep.id === this.auth.currentUser()?.id);

  /** Invoices and collections made during this visit. */
  protected readonly linked = rxResource({
    params: () => this.id(),
    stream: ({ params }) =>
      forkJoin({
        invoices: this.invoiceService.getInvoices({ visitId: params }),
        collections: this.collectionService.getCollections({ visitId: params }),
      }),
  });
  protected readonly salesTotal = computed(() =>
    (this.linked.value()?.invoices ?? [])
      .filter((i) => i.status === InvoiceStatus.ACTIVE)
      .reduce((sum, i) => sum + i.total, 0),
  );
  /** Money received: up-front invoice payments + collections. */
  protected readonly collectedTotal = computed(() => {
    const linked = this.linked.value();
    if (!linked) return 0;
    const upFront = linked.invoices.filter((i) => i.status === InvoiceStatus.ACTIVE).reduce((s, i) => s + i.paidAmount, 0);
    const collections = linked.collections
      .filter((c) => c.status === CollectionStatus.ACTIVE)
      .reduce((s, c) => s + c.amount, 0);
    return upFront + collections;
  });

  protected readonly mapsUrl = computed(() => {
    const loc = this.visit.value()?.customer.location;
    return loc ? `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}` : null;
  });

  protected readonly pending = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly showCompleteForm = signal(false);

  protected readonly completeForm = inject(NonNullableFormBuilder).group({
    notes: [''],
    productsDiscussed: [''],
    customerFeedback: [''],
    nextVisitAt: [''],
  });

  protected async start(): Promise<void> {
    this.pending.set(true);
    const location = await getCurrentLocation();
    this.run(this.visitService.startVisit(this.id(), location));
  }

  protected complete(): void {
    const { notes, productsDiscussed, customerFeedback, nextVisitAt } = this.completeForm.getRawValue();
    this.run(
      this.visitService.completeVisit(this.id(), {
        notes: notes.trim() || undefined,
        productsDiscussed: productsDiscussed
          .split(/[,،\n]/)
          .map((p) => p.trim())
          .filter(Boolean),
        customerFeedback: customerFeedback.trim() || undefined,
        nextVisitAt: nextVisitAt ? new Date(nextVisitAt).toISOString() : undefined,
      }),
    );
  }

  protected cancel(): void {
    const reason = prompt('سبب إلغاء الزيارة (اختياري):');
    if (reason === null) return; // dialog dismissed
    this.run(this.visitService.cancelVisit(this.id(), reason.trim()));
  }

  private run(request: Observable<Visit>): void {
    this.pending.set(true);
    this.actionError.set(null);
    request.subscribe({
      next: (visit) => {
        this.visit.set(visit);
        this.pending.set(false);
        this.showCompleteForm.set(false);
      },
      error: (err: unknown) => {
        this.pending.set(false);
        this.actionError.set(httpErrorMessage(err));
      },
    });
  }
}
