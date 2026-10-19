import { Component, computed, inject, viewChild } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { DatePipe } from '../../../shared/date.pipe';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { pagedResource } from '../../../shared/paged';
import { PAYMENT_METHOD_LABELS, PaymentMethod } from '../../invoices/models/invoice.model';
import { BUCKET_LABELS, sumPayments, totalsByMethod } from '../models/treasury.model';
import { TreasuryService } from '../services/treasury.service';
import { PaymentsTableComponent } from '../payments-table/payments-table.component';
import { TreasuryOutflowsComponent } from '../outflows/outflows.component';
import { RepExpensesComponent } from '../rep-expenses/rep-expenses.component';
import { CountDialogComponent } from '../count-dialog/count-dialog.component';

/** /treasury — managers: company treasury + reps' cash boxes; a rep: their own cash box. */
@Component({
  selector: 'app-treasury-home',
  imports: [CountDialogComponent, CurrencyPipe, DatePipe, PagerComponent, PaymentsTableComponent, RouterLink, StatusMessageComponent, TreasuryOutflowsComponent, RepExpensesComponent],
  templateUrl: './treasury-home.component.html',
})
export class TreasuryHomeComponent {
  private readonly treasury = inject(TreasuryService);

  protected readonly isManager = inject(AuthService).hasRole(UserRole.OWNER, UserRole.ADMIN);
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly bucketLabels = BUCKET_LABELS;

  protected readonly outflows = viewChild(TreasuryOutflowsComponent);

  protected readonly summary = rxResource({
    stream: () => (this.isManager ? this.treasury.getSummary() : of(null)),
  });
  protected readonly pending = rxResource({
    stream: () => (this.isManager ? of([]) : this.treasury.getPending()),
  });
  protected readonly deposits = pagedResource(() => ({}), (params) => this.treasury.getDepositsPage(params));
  /** A rep: collected minus their expenses not handed over yet. */
  protected readonly cashBox = rxResource({
    stream: () => (this.isManager ? of(null) : this.treasury.getCashBox()),
  });

  /** Received cheques not cashed yet: not part of the balance. */
  protected readonly openCheques = computed(() =>
    this.summary.value()?.byMethod.find((m) => m.method === PaymentMethod.CHEQUE && (m.total || m.count)),
  );
  protected readonly pendingTotal = computed(() => sumPayments(this.pending.value() ?? []));
  protected readonly pendingByMethod = computed(() => totalsByMethod(this.pending.value() ?? []));
  protected readonly repsTotal = computed(() =>
    sumPayments((this.summary.value()?.pendingByRep ?? []).map((r) => ({ amount: r.total }))),
  );
}
