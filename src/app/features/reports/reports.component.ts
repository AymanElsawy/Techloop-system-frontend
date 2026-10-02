import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';

import { httpErrorMessage } from '../../core/http/http-error';
import { StatusMessageComponent } from '../../shared/components/status-message/status-message.component';
import { GROUP_LABELS, GroupBy, ReportsService, SalesRow } from './reports.service';

const isoDay = (d: Date) => d.toLocaleDateString('en-CA');

/** /reports — managers: sales by product / governorate / rep with profit, debt aging, and purchases per supplier. All export to Excel (CSV). */
@Component({
  selector: 'app-reports',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, PercentPipe, RouterLink, StatusMessageComponent],
  templateUrl: './reports.component.html',
})
export class ReportsComponent {
  private readonly reports = inject(ReportsService);

  protected readonly tab = signal<'sales' | 'aging' | 'purchases'>('sales');
  protected readonly groupLabels = GROUP_LABELS;
  protected readonly groups = Object.keys(GROUP_LABELS) as GroupBy[];

  private readonly now = new Date();
  protected readonly groupBy = signal<GroupBy>('product');
  protected readonly from = signal(isoDay(new Date(this.now.getFullYear(), this.now.getMonth(), 1)));
  protected readonly to = signal(isoDay(this.now));

  protected readonly sales = rxResource({
    params: () => (this.tab() === 'sales' ? { groupBy: this.groupBy(), from: this.from(), to: this.to() } : undefined),
    stream: ({ params }) => this.reports.getSales(params),
  });
  protected readonly aging = rxResource({
    params: () => (this.tab() === 'aging' ? true : undefined),
    stream: ({ params }) => (params ? this.reports.getAging() : of(null)),
  });

  // Purchases: no dates = everything bought so far.
  protected readonly pFrom = signal('');
  protected readonly pTo = signal('');
  protected readonly search = signal('');
  protected readonly purchases = rxResource({
    params: () => (this.tab() === 'purchases' ? { from: this.pFrom(), to: this.pTo() } : undefined),
    stream: ({ params }) => this.reports.getPurchases(params.from, params.to),
  });
  protected readonly purchaseRows = computed(() => {
    const q = this.search().trim();
    return (this.purchases.value()?.rows ?? []).filter((r) => !q || r.product.name.includes(q) || r.supplier.name.includes(q));
  });

  protected readonly exporting = signal(false);
  protected readonly exportError = signal<string | null>(null);

  /** Profit as a share of net sales. */
  protected margin(r: Pick<SalesRow, 'net' | 'profit'>): number | null {
    return r.net > 0 ? r.profit / r.net : null;
  }

  protected last(list: unknown[]): number {
    return list.length - 1;
  }

  /** First bucket is "not due yet"; the rest are days past due. */
  protected bucketLabel(b: string, i: number): string {
    return i === 0 ? b : `متأخر ${b} يوم`;
  }

  protected hasMissingCost(rows: SalesRow[]): boolean {
    return rows.some((r) => r.costMissing);
  }

  protected export(): void {
    this.exporting.set(true);
    this.exportError.set(null);
    const request =
      this.tab() === 'sales'
        ? this.reports.download('sales', `مبيعات-${GROUP_LABELS[this.groupBy()]}-${this.from()}_${this.to()}.csv`, {
            groupBy: this.groupBy(),
            from: this.from(),
            to: this.to(),
          })
        : this.tab() === 'aging'
          ? this.reports.download('aging', `أعمار-الديون-${isoDay(new Date())}.csv`)
          : this.reports.download(
              'purchases',
              `مشتريات-الأصناف-${this.pFrom() || 'الكل'}_${this.pTo() || isoDay(new Date())}.csv`,
              this.reports.dates(this.pFrom(), this.pTo()),
            );
    request.subscribe({
      next: () => this.exporting.set(false),
      error: (err: unknown) => {
        this.exporting.set(false);
        this.exportError.set(httpErrorMessage(err, 'تعذر التصدير. حاول مرة أخرى.'));
      },
    });
  }
}
