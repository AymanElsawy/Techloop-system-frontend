import { Component, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, forkJoin, map } from 'rxjs';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { httpErrorMessage } from '../../../core/http/http-error';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import {
  CUSTOMER_STATUS_CLASSES,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TYPE_LABELS,
  Customer,
  CustomerStatus,
} from '../models/customer.model';
import { CustomerService } from '../services/customer.service';
import { InvoiceService } from '../../invoices/services/invoice.service';
import { CollectionService } from '../../collections/services/collection.service';
import { StatementLine, buildStatement } from '../models/statement';
import { ReturnsService } from '../../returns/returns.service';

const LINE_ROUTES: Record<StatementLine['kind'], string> = {
  invoice: '/invoices',
  collection: '/collections',
  return: '/returns',
};
const LINE_LABELS: Record<StatementLine['kind'], string> = {
  invoice: 'فاتورة بيع',
  collection: 'فاتورة تحصيل',
  return: 'فاتورة مرتجع',
};

@Component({
  selector: 'app-customer-details',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, StatusMessageComponent],
  templateUrl: './customer-details.component.html',
})
export class CustomerDetailsComponent {
  private readonly customerService = inject(CustomerService);
  private readonly auth = inject(AuthService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly collectionService = inject(CollectionService);
  private readonly returnsService = inject(ReturnsService);
  private readonly router = inject(Router);

  /** Route param, bound via withComponentInputBinding. */
  readonly id = input.required<string>();

  protected readonly Status = CustomerStatus;
  protected readonly statusLabels = CUSTOMER_STATUS_LABELS;
  protected readonly statusClasses = CUSTOMER_STATUS_CLASSES;
  protected readonly typeLabels = CUSTOMER_TYPE_LABELS;

  protected readonly isManager = this.auth.hasRole(UserRole.OWNER, UserRole.ADMIN);
  protected readonly lineLabels = LINE_LABELS;

  protected readonly customer = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.customerService.getCustomer(params),
  });

  /** Mirrors the backend: managers edit any customer; reps edit any non-rejected one (contact details only unless it is their own pending customer). */
  protected readonly canEdit = computed(() => {
    const c = this.customer.value();
    return !!c && (this.isManager || c.status !== CustomerStatus.REJECTED);
  });
  protected readonly canInvoice = computed(() => {
    const c = this.customer.value();
    return !!c && c.status !== CustomerStatus.REJECTED;
  });

  /** Invoices + collections merged into one statement. Reps only get their own entries from the backend. */
  protected readonly statement = rxResource({
    params: () => this.id(),
    stream: ({ params }) =>
      forkJoin([
        this.invoiceService.getInvoices({ customerId: params }),
        this.collectionService.getCollections({ customerId: params }),
        this.returnsService.getReturns({ customerId: params }),
      ]).pipe(map(([invoices, collections, returns]) => buildStatement(invoices, collections, returns))),
  });

  /** Active sales returns: how many and their total value (reps: their own only, like the statement). */
  protected readonly returnsSummary = computed(() => {
    const lines = (this.statement.value() ?? []).filter((l) => l.kind === 'return' && !l.cancelled);
    return { count: lines.length, total: lines.reduce((s, l) => s + l.credit, 0) };
  });

  protected readonly mapsUrl = computed(() => {
    const loc = this.customer.value()?.location;
    return loc ? `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}` : null;
  });

  protected readonly pending = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly showReject = signal(false);
  protected readonly rejectReason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3)],
  });

  protected lineLink(line: StatementLine): string[] {
    return [LINE_ROUTES[line.kind], line.id];
  }

  protected openLine(line: StatementLine): void {
    this.router.navigate(this.lineLink(line));
  }

  protected approve(): void {
    this.run(this.customerService.approveCustomer(this.id()));
  }

  protected reject(): void {
    if (this.rejectReason.invalid) return;
    this.run(this.customerService.rejectCustomer(this.id(), this.rejectReason.value.trim()));
  }

  private run(request: Observable<Customer>): void {
    this.pending.set(true);
    this.actionError.set(null);
    request.subscribe({
      next: (customer) => {
        this.customer.set(customer);
        this.pending.set(false);
        this.showReject.set(false);
      },
      error: (err: unknown) => {
        this.pending.set(false);
        this.actionError.set(httpErrorMessage(err));
      },
    });
  }
}
