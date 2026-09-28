import { Component, computed, inject, input } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';

import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { PAYMENT_METHOD_LABELS } from '../../invoices/models/invoice.model';
import { totalsByMethod } from '../models/treasury.model';
import { TreasuryService } from '../services/treasury.service';
import { PaymentsTableComponent } from '../payments-table/payments-table.component';

/** /treasury/deposits/:id — one handover (استلام) with its payments. */
@Component({
  selector: 'app-deposit-details',
  imports: [CurrencyPipe, DatePipe, PaymentsTableComponent, RouterLink, StatusMessageComponent],
  template: `
    <section class="space-y-6">
      <a routerLink="/treasury" class="text-sm text-stormy-teal hover:underline">→ العودة إلى الخزنة</a>
      @if (deposit.isLoading() && !deposit.hasValue()) {
        <app-status-message type="loading" message="جاري التحميل..." />
      } @else if (deposit.error()) {
        <app-status-message type="error" message="حدث خطأ أثناء التحميل." (retry)="deposit.reload()" />
      } @else if (deposit.value(); as d) {
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-2xl font-bold">استلام #{{ d.number }}</h1>
          <a [routerLink]="['/documents/DEPOSIT', d.id]" class="btn-primary">طباعة إيصال / PDF</a>
        </div>
        <dl class="card grid gap-5 sm:grid-cols-4">
          <div>
            <dt class="text-sm text-stormy-teal">المندوب</dt>
            <dd class="mt-1 font-semibold">{{ d.rep.name }}</dd>
          </div>
          <div>
            <dt class="text-sm text-stormy-teal">استلمها</dt>
            <dd class="mt-1 font-semibold">{{ d.receivedBy.name }}</dd>
          </div>
          <div>
            <dt class="text-sm text-stormy-teal">التاريخ</dt>
            <dd class="mt-1 font-semibold">{{ d.createdAt | date: 'd MMMM y, h:mm a' }}</dd>
          </div>
          <div>
            <dt class="text-sm text-stormy-teal">الإجمالي</dt>
            <dd class="mt-1 text-xl font-bold tabular-nums">{{ d.total | currency: 'EGP' : 'symbol' : '1.0-2' }}</dd>
          </div>
          <div class="sm:col-span-4">
            <dt class="text-sm text-stormy-teal">حسب طريقة السداد</dt>
            <dd class="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              @for (m of byMethod(); track m.method) {
                <span>{{ methodLabels[m.method] }}: <span class="font-semibold tabular-nums">{{ m.total | currency: 'EGP' : 'symbol' : '1.0-2' }}</span></span>
              }
            </dd>
          </div>
          @if (d.notes) {
            <div class="sm:col-span-4">
              <dt class="text-sm text-stormy-teal">ملاحظات</dt>
              <dd class="mt-1">{{ d.notes }}</dd>
            </div>
          }
        </dl>
        <app-payments-table [payments]="d.payments" />
      }
    </section>
  `,
})
export class DepositDetailsComponent {
  private readonly treasury = inject(TreasuryService);

  readonly id = input.required<string>();

  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly deposit = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.treasury.getDeposit(params),
  });
  protected readonly byMethod = computed(() => totalsByMethod(this.deposit.value()?.payments ?? []));
}
