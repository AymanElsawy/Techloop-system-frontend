import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';

import { httpErrorMessage } from '../../../core/http/http-error';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { PAYMENT_METHOD_LABELS } from '../../invoices/models/invoice.model';
import { sumPayments, totalsByMethod } from '../models/treasury.model';
import { TreasuryService } from '../services/treasury.service';
import { PaymentsTableComponent, paymentKey } from '../payments-table/payments-table.component';

/** /treasury/handover/:repId — a manager receives the selected payments from a rep. */
@Component({
  selector: 'app-handover-form',
  imports: [CurrencyPipe, PaymentsTableComponent, RouterLink, StatusMessageComponent],
  templateUrl: './handover-form.component.html',
})
export class HandoverFormComponent {
  private readonly treasury = inject(TreasuryService);
  private readonly router = inject(Router);

  readonly repId = input.required<string>();

  protected readonly methodLabels = PAYMENT_METHOD_LABELS;

  protected readonly pending = rxResource({
    params: () => this.repId(),
    stream: ({ params }) => this.treasury.getPending(params),
  });
  protected readonly repName = computed(() => this.pending.value()?.[0]?.rep.name ?? '');

  /** Everything is selected by default; the manager unticks what was not handed over. */
  protected readonly selected = signal<string[]>([]);
  protected readonly chosen = computed(() =>
    (this.pending.value() ?? []).filter((p) => this.selected().includes(paymentKey(p))),
  );
  protected readonly chosenTotal = computed(() => sumPayments(this.chosen()));
  protected readonly chosenByMethod = computed(() => totalsByMethod(this.chosen()));

  protected readonly notes = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => this.selected.set((this.pending.value() ?? []).map(paymentKey)));
  }

  protected submit(): void {
    if (!this.chosen().length || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const ids = (kind: string) => this.chosen().filter((p) => p.kind === kind).map((p) => p.id);
    this.treasury
      .createDeposit({
        repId: this.repId(),
        invoiceIds: ids('INVOICE'),
        collectionIds: ids('COLLECTION'),
        notes: this.notes().trim() || null,
      })
      .subscribe({
        next: (deposit) => this.router.navigate(['/treasury/deposits', deposit.id]),
        error: (err: unknown) => {
          this.saving.set(false);
          this.pending.reload();
          this.error.set(httpErrorMessage(err, 'تعذر تسجيل الاستلام. حدّث الصفحة وحاول مرة أخرى.'));
        },
      });
  }
}
