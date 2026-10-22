import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';

import { DatePipe } from '../../shared/date.pipe';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { StatusMessageComponent } from '../../shared/components/status-message/status-message.component';
import { DEFERRED_LABEL, PAYMENT_METHOD_LABELS } from '../invoices/models/invoice.model';
import { PRODUCT_UNIT_LABELS } from '../products/models/product.model';
import {
  VISIT_PURPOSE_LABELS,
  VISIT_STATUS_CLASSES,
  VISIT_STATUS_LABELS,
} from '../visits/models/visit.model';
import { TargetPeriod, UserService } from './user.service';

/** One section's page of an already loaded list; back to page 1 when the list or page size changes. */
function pageOf<T>(list: () => T[] | undefined) {
  const limit = signal(10);
  const page = linkedSignal({
    source: () => ({ list: list(), limit: limit() }),
    computation: () => 1,
  });
  const rows = computed(() => {
    const start = (page() - 1) * limit();
    return (list() ?? []).slice(start, start + limit());
  });
  return { page, limit, rows };
}

const thisMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7); // YYYY-MM

/**
 * /targets/:id?month=YYYY-MM|year=YYYY: everything about one sales rep for the period (visits, invoices,
 * returns, collections, expenses, target & commission) plus what they hold now (custody, cash box). Managers only.
 */
@Component({
  selector: 'app-rep-detail',
  imports: [CurrencyPipe, DatePipe, PagerComponent, RouterLink, StatusMessageComponent],
  templateUrl: './rep-detail.component.html',
})
export class RepDetailComponent {
  readonly id = input.required<string>();
  /** Query params from the reps list; this month when both are missing. */
  readonly month = input<string>();
  readonly year = input<string>();

  private readonly users = inject(UserService);

  protected readonly yearly = linkedSignal(() => !!this.year());
  protected readonly selectedMonth = linkedSignal(() => this.month() || thisMonth());
  protected readonly selectedYear = linkedSignal(() => this.year() || thisMonth().slice(0, 4));
  /** This year and the 4 before it. */
  protected readonly years = Array.from({ length: 5 }, (_, i) =>
    String(new Date().getFullYear() - i),
  );
  protected readonly period = computed<TargetPeriod>(() =>
    this.yearly() ? { year: this.selectedYear() } : { month: this.selectedMonth() },
  );

  protected readonly printParams = computed(() => ({ ...this.period(), rep: this.id() }));

  protected readonly report = rxResource({
    params: () => ({ id: this.id(), period: this.period() }),
    stream: ({ params }) => this.users.getRepTargets(params.id, params.period),
  });

  protected readonly visits = pageOf(() => this.report.value()?.visits);
  protected readonly invoices = pageOf(() => this.report.value()?.invoices);
  protected readonly returns = pageOf(() => this.report.value()?.returns);
  protected readonly collections = pageOf(() => this.report.value()?.collections);
  protected readonly expenses = pageOf(() => this.report.value()?.expenses);
  protected readonly custody = pageOf(() => this.report.value()?.custody);

  protected readonly payment = (method: keyof typeof PAYMENT_METHOD_LABELS | null) =>
    method ? PAYMENT_METHOD_LABELS[method] : DEFERRED_LABEL;
  protected readonly unitLabels = PRODUCT_UNIT_LABELS;
  protected readonly purposeLabels = VISIT_PURPOSE_LABELS;
  protected readonly statusLabels = VISIT_STATUS_LABELS;
  protected readonly statusClasses = VISIT_STATUS_CLASSES;

  protected setMonth(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) this.selectedMonth.set(value);
  }
}
