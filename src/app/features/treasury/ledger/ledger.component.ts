import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { DatePipe } from '../../../shared/date.pipe';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { pagedResource } from '../../../shared/paged';
import { PaymentMethod } from '../../invoices/models/invoice.model';
import { BUCKET_LABELS, LedgerRow, MONEY_BUCKETS } from '../models/treasury.model';
import { TreasuryService } from '../services/treasury.service';

const LINKS: Record<NonNullable<LedgerRow['ref']>['type'], string> = {
  DEPOSIT: '/treasury/deposits',
  INVOICE: '/invoices',
  COLLECTION: '/collections',
  SUPPLIER: '/suppliers',
  MOVEMENT: '/inventory/movements',
};

/** /treasury/ledger — حركة الخزنة: every movement of real money with a running balance. Managers. */
@Component({
  selector: 'app-treasury-ledger',
  imports: [CurrencyPipe, DatePipe, PagerComponent, RouterLink, StatusMessageComponent],
  template: `
    <section class="space-y-6">
      <a routerLink="/treasury" class="text-sm text-stormy-teal hover:underline"
        >→ العودة إلى الخزنة</a
      >
      <div>
        <h1 class="text-2xl font-bold">حركة الخزنة</h1>
        <p class="mt-1 text-stormy-teal">
          كل فلوس دخلت أو خرجت (نقدي، فودافون، البنك) والرصيد بعد كل حركة. الشيك بيظهر لما يتصرف.
        </p>
      </div>

      <div class="card grid gap-3 sm:grid-cols-3">
        <div>
          <label for="ledger-method" class="form-label">الخانة</label>
          <select
            id="ledger-method"
            class="form-input"
            [value]="method()"
            (change)="method.set($any($event.target).value)"
          >
            <option value="">الكل</option>
            @for (m of buckets; track m) {
              <option [value]="m">{{ bucketLabels[m] }}</option>
            }
          </select>
        </div>
        <div>
          <label for="ledger-from" class="form-label">من</label>
          <input
            id="ledger-from"
            type="date"
            class="form-input"
            [value]="from()"
            (change)="from.set($any($event.target).value)"
          />
        </div>
        <div>
          <label for="ledger-to" class="form-label">إلى</label>
          <input
            id="ledger-to"
            type="date"
            class="form-input"
            [value]="to()"
            (change)="to.set($any($event.target).value)"
          />
        </div>
      </div>

      @if (ledger.resource.error()) {
        <app-status-message
          type="error"
          message="حدث خطأ أثناء تحميل الحركة."
          (retry)="ledger.resource.reload()"
        />
      } @else if (ledger.value(); as l) {
        <ul class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <li class="card">
            <p class="text-sm text-stormy-teal">رصيد أول المدة</p>
            <p class="mt-1 text-xl font-bold tabular-nums">
              {{ l.opening | currency: 'EGP' : 'symbol' : '1.0-2' }}
            </p>
          </li>
          <li class="card">
            <p class="text-sm text-stormy-teal">داخل</p>
            <p class="mt-1 text-xl font-bold tabular-nums">
              {{ l.inflow | currency: 'EGP' : 'symbol' : '1.0-2' }}
            </p>
          </li>
          <li class="card">
            <p class="text-sm text-stormy-teal">خارج</p>
            <p class="mt-1 text-xl font-bold tabular-nums text-vibrant-coral-400">
              {{ l.outflow | currency: 'EGP' : 'symbol' : '1.0-2' }}
            </p>
          </li>
          <li
            class="card keep-colors bg-yale-blue text-white dark:border-prussian-blue-600 dark:bg-prussian-blue-400"
          >
            <p class="text-sm text-yale-blue-800">رصيد آخر المدة</p>
            <p class="mt-1 text-xl font-bold tabular-nums">
              {{ l.closing | currency: 'EGP' : 'symbol' : '1.0-2' }}
            </p>
          </li>
        </ul>

        @if (l.total) {
          <app-pager
            [(page)]="ledger.page"
            [(limit)]="ledger.limit"
            [total]="l.total"
            [loading]="ledger.resource.isLoading()"
          >
            <table class="w-full text-right text-sm">
              <thead class="table-head">
                <tr>
                  <th scope="col" class="px-4 py-3 font-semibold">التاريخ</th>
                  <th scope="col" class="px-4 py-3 font-semibold">البيان</th>
                  <th scope="col" class="px-4 py-3 font-semibold">الخانة</th>
                  <th scope="col" class="px-4 py-3 font-semibold">داخل</th>
                  <th scope="col" class="px-4 py-3 font-semibold">خارج</th>
                  <th scope="col" class="px-4 py-3 font-semibold">الرصيد</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stormy-teal-900">
                @for (r of l.items; track $index) {
                  <tr>
                    <td class="whitespace-nowrap px-4 py-3">
                      {{ r.date | date: 'd MMM y, h:mm a' }}
                    </td>
                    <td class="px-4 py-3">
                      @if (r.ref) {
                        <a
                          [routerLink]="[links[r.ref.type], r.ref.id]"
                          class="font-semibold hover:text-stormy-teal hover:underline"
                          >{{ r.title }}</a
                        >
                      } @else {
                        <span class="font-semibold">{{ r.title }}</span>
                      }
                      @if (r.party) {
                        <p class="text-xs text-stormy-teal">{{ r.party }}</p>
                      }
                    </td>
                    <td class="whitespace-nowrap px-4 py-3">{{ bucketLabels[r.method] }}</td>
                    <td class="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                      @if (r.amount > 0) {
                        {{ r.amount | currency: 'EGP' : 'symbol' : '1.0-2' }}
                      }
                    </td>
                    <td
                      class="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-vibrant-coral-400"
                    >
                      @if (r.amount < 0) {
                        {{ -r.amount | currency: 'EGP' : 'symbol' : '1.0-2' }}
                      }
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 tabular-nums">
                      {{ r.balance | currency: 'EGP' : 'symbol' : '1.0-2' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </app-pager>
        } @else {
          <p class="card text-center text-sm text-stormy-teal">مفيش حركة في الفترة دي.</p>
        }
      } @else {
        <app-status-message type="loading" message="جاري تحميل الحركة..." />
      }
    </section>
  `,
})
export class TreasuryLedgerComponent {
  private readonly treasury = inject(TreasuryService);

  protected readonly buckets = MONEY_BUCKETS;
  protected readonly bucketLabels = BUCKET_LABELS;
  protected readonly links = LINKS;

  protected readonly method = signal<PaymentMethod | ''>('');
  protected readonly from = signal('');
  protected readonly to = signal('');

  protected readonly ledger = pagedResource(
    () => ({ method: this.method(), from: this.from(), to: this.to() }),
    (params) => this.treasury.getLedgerPage(params),
  );
}
