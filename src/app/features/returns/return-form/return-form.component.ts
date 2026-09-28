import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { map, of } from 'rxjs';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { httpErrorMessage } from '../../../core/http/http-error';
import { CustomerService } from '../../customers/services/customer.service';
import { InvoiceStatus, round2 } from '../../invoices/models/invoice.model';
import { InvoiceService } from '../../invoices/services/invoice.service';
import { InventoryService } from '../../inventory/services/inventory.service';
import { returnedByProduct } from '../returns.model';
import { ReturnsService } from '../returns.service';

/** فاتورة مرتجع for a customer: /customers/:id/returns/new[?invoiceId=] */
@Component({
  selector: 'app-return-form',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './return-form.component.html',
})
export class ReturnFormComponent {
  private readonly router = inject(Router);
  private readonly returns = inject(ReturnsService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly inventory = inject(InventoryService);
  private readonly customers = inject(CustomerService);

  /** Customer id from the route. */
  readonly id = input.required<string>();
  /** Query param: preselected invoice. */
  readonly invoiceId = input<string>();

  protected readonly isManager = inject(AuthService).hasRole(UserRole.OWNER, UserRole.ADMIN);

  protected readonly customer = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.customers.getCustomer(params),
  });
  /** Only active invoices can take a return. Reps get their own invoices only. */
  protected readonly invoices = rxResource({
    params: () => this.id(),
    stream: ({ params }) =>
      this.invoiceService
        .getInvoices({ customerId: params })
        .pipe(map((list) => list.filter((i) => i.status === InvoiceStatus.ACTIVE))),
  });
  protected readonly warehouses = rxResource({
    stream: () => (this.isManager ? this.inventory.getWarehouses() : of([])),
  });

  protected readonly selectedId = linkedSignal(() => this.invoiceId() ?? '');
  protected readonly invoice = computed(() => this.invoices.value()?.find((i) => i.id === this.selectedId()) ?? null);
  private readonly previous = rxResource({
    params: () => this.selectedId() || undefined,
    stream: ({ params }) => this.returns.getReturns({ invoiceId: params }),
  });

  /** Per line: what was sold, what was already returned, and what can still come back. */
  protected readonly lines = computed(() => {
    const inv = this.invoice();
    const returned = returnedByProduct(this.previous.value() ?? []);
    return (inv?.items ?? []).map((i) => {
      const done = returned.get(i.product) ?? 0;
      return { ...i, returned: done, left: i.quantity - done };
    });
  });
  /** productId -> quantity to return; reset when the invoice changes. */
  protected readonly quantities = linkedSignal<string, Partial<Record<string, number>>>({
    source: () => this.selectedId(),
    computation: () => ({}),
  });
  protected readonly warehouseId = linkedSignal(() => this.invoice()?.warehouse?.id ?? '');
  protected readonly notes = signal('');

  protected readonly total = computed(() =>
    round2(this.lines().reduce((s, l) => s + (this.quantities()[l.product] ?? 0) * l.unitPrice, 0)),
  );
  protected readonly invalid = computed(() =>
    this.lines().some((l) => (this.quantities()[l.product] ?? 0) > l.left),
  );
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  protected setQuantity(productId: string, event: Event): void {
    const n = Math.max(0, Math.floor(Number(this.value(event)) || 0));
    this.quantities.update((q) => ({ ...q, [productId]: n }));
  }

  protected returnAll(): void {
    this.quantities.set(Object.fromEntries(this.lines().map((l) => [l.product, l.left])));
  }

  protected submit(): void {
    const items = this.lines()
      .map((l) => ({ productId: l.product, quantity: this.quantities()[l.product] ?? 0 }))
      .filter((i) => i.quantity > 0);
    if (!items.length || this.invalid()) return;
    this.saving.set(true);
    this.error.set(null);
    this.returns
      .createReturn({
        invoiceId: this.selectedId(),
        warehouseId: this.isManager ? this.warehouseId() || null : null,
        items,
        notes: this.notes().trim() || null,
      })
      .subscribe({
        next: (r) => this.router.navigate(['/returns', r.id]),
        error: (err) => {
          this.saving.set(false);
          this.error.set(httpErrorMessage(err));
        },
      });
  }
}
