import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ChequeStatus, DepositInfo, DepositStatus } from '../models/treasury.model';

/** Where the money of an invoice / collection is: with the rep, or in the treasury. */
@Component({
  selector: 'app-deposit-badge',
  imports: [RouterLink],
  template: `
    @if (entry().depositStatus === DepositStatus.PENDING) {
      <span class="rounded-full bg-soft-apricot-800 px-3 py-1 text-sm font-medium text-soft-apricot-200">مع المندوب (لم يُسلَّم للخزنة)</span>
    } @else if (entry().deposit; as d) {
      <a [routerLink]="['/treasury/deposits', d.id]" class="rounded-full bg-yale-blue-900 px-3 py-1 text-sm font-medium text-yale-blue-600 hover:underline">
        في الخزنة · استلام #{{ d.number }}
      </a>
    } @else {
      <span class="rounded-full bg-yale-blue-900 px-3 py-1 text-sm font-medium text-yale-blue-600">في الخزنة</span>
    }
    @if (entry().chequeStatus === ChequeStatus.BOUNCED) {
      <span class="rounded-full bg-vibrant-coral-900 px-3 py-1 text-sm font-medium text-vibrant-coral-300">شيك مرتد (رجع على مديونية العميل)</span>
    } @else if (entry().chequeStatus === ChequeStatus.CLEARED) {
      <span class="rounded-full bg-yale-blue-900 px-3 py-1 text-sm font-medium text-yale-blue-600">الشيك اتصرف</span>
    }
  `,
})
export class DepositBadgeComponent {
  readonly entry = input.required<Pick<DepositInfo, 'depositStatus' | 'deposit' | 'chequeStatus'>>();
  protected readonly DepositStatus = DepositStatus;
  protected readonly ChequeStatus = ChequeStatus;
}
