import { Component, computed, input, model } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { PAYMENT_METHOD_LABELS } from '../../invoices/models/invoice.model';
import { Payment } from '../models/treasury.model';

export const paymentKey = (p: Pick<Payment, 'kind' | 'id'>) => `${p.kind}:${p.id}`;

/** Money entries (invoice up-front payments and collections), optionally selectable. */
@Component({
  selector: 'app-payments-table',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  template: `
    <div class="card overflow-x-auto p-0">
      <table class="w-full text-right text-sm">
        <thead class="table-head">
          <tr>
            @if (selectable()) {
              <th scope="col" class="w-10 px-4 py-3">
                <input type="checkbox" aria-label="تحديد الكل" [checked]="allSelected()" (change)="toggleAll()" />
              </th>
            }
            <th scope="col" class="px-4 py-3 font-semibold">التاريخ</th>
            <th scope="col" class="px-4 py-3 font-semibold">المستند</th>
            <th scope="col" class="px-4 py-3 font-semibold">العميل</th>
            @if (showRep()) {
              <th scope="col" class="px-4 py-3 font-semibold">المندوب</th>
            }
            <th scope="col" class="px-4 py-3 font-semibold">طريقة السداد</th>
            <th scope="col" class="px-4 py-3 font-semibold">المبلغ</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-stormy-teal-900">
          @for (p of payments(); track key(p)) {
            <tr [class.bg-stormy-teal-900/40]="selectable() && selected().includes(key(p))">
              @if (selectable()) {
                <td class="px-4 py-3">
                  <input type="checkbox" [attr.aria-label]="'تحديد ' + p.number" [checked]="selected().includes(key(p))" (change)="toggle(p)" />
                </td>
              }
              <td class="whitespace-nowrap px-4 py-3">{{ p.createdAt | date: 'd MMM y' }}</td>
              <td class="px-4 py-3">
                <a [routerLink]="[p.kind === 'INVOICE' ? '/invoices' : '/collections', p.id]" class="font-semibold hover:text-vibrant-coral-400 hover:underline">
                  {{ p.kind === 'INVOICE' ? 'مقدم فاتورة' : 'فاتورة تحصيل' }} <span dir="ltr">{{ p.number }}</span>
                </a>
              </td>
              <td class="px-4 py-3">
                <a [routerLink]="['/customers', p.customer.id]" class="hover:text-vibrant-coral-400 hover:underline">{{ p.customer.name }}</a>
                <p class="text-xs text-stormy-teal">{{ p.customer.governorate }}</p>
              </td>
              @if (showRep()) {
                <td class="px-4 py-3">{{ p.rep.name }}</td>
              }
              <td class="px-4 py-3">
                {{ methodLabels[p.paymentMethod] }}
                @if (p.chequeNumber) {
                  <p class="text-xs text-stormy-teal">شيك <span dir="ltr">{{ p.chequeNumber }}</span>{{ p.chequeDueDate ? ' · يستحق ' + (p.chequeDueDate | date: 'd MMM y') : '' }}</p>
                }
              </td>
              <td class="whitespace-nowrap px-4 py-3 font-semibold">{{ p.amount | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class PaymentsTableComponent {
  readonly payments = input.required<Payment[]>();
  readonly selectable = input(false);
  readonly showRep = input(false);
  /** Selected entries as `KIND:id` keys. */
  readonly selected = model<string[]>([]);

  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly key = paymentKey;
  protected readonly allSelected = computed(
    () => this.payments().length > 0 && this.selected().length === this.payments().length,
  );

  protected toggle(p: Payment): void {
    const k = paymentKey(p);
    this.selected.update((list) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]));
  }

  protected toggleAll(): void {
    this.selected.set(this.allSelected() ? [] : this.payments().map(paymentKey));
  }
}
