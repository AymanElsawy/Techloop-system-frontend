import { Component, LOCALE_ID, inject, input } from '@angular/core';
import { formatCurrency, formatDate } from '@angular/common';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, forkJoin, map } from 'rxjs';

import { arabicDigits } from '../../shared/date.pipe';
import { StatusMessageComponent } from '../../shared/components/status-message/status-message.component';
import { DEFERRED_LABEL, PAYMENT_METHOD_LABELS, PaymentMethod } from '../invoices/models/invoice.model';
import { Company } from '../documents/documents.model';
import { DocumentsService } from '../documents/documents.service';
import { TargetPeriod, TargetRow, UserService } from './user.service';

interface Section {
  title: string;
  columns: string[];
  rows: string[][];
  total?: string[]; // last row, bold
}

interface Report {
  title: string;
  subtitle: string;
  period: string; // "شهر سبتمبر ٢٠٢٦" / "سنة ٢٠٢٦"
  summary: [string, string][];
  sections: Section[];
  signatures: [string, string];
}

/**
 * /targets/print?month=YYYY-MM|year=YYYY[&rep=id]: A4 targets & commission report for a month or a year,
 * one rep (with their invoices, returns and collections) or all reps. PDF = the browser's Save as PDF.
 */
@Component({
  selector: 'app-targets-print',
  imports: [RouterLink, StatusMessageComponent],
  templateUrl: './targets-print.component.html',
})
export class TargetsPrintComponent {
  /** YYYY-MM, or `year` (YYYY) for a yearly report; this month when both are missing. */
  readonly month = input<string>();
  readonly year = input<string>();
  readonly rep = input<string>();

  private readonly locale = inject(LOCALE_ID);
  private readonly users = inject(UserService);
  private readonly documents = inject(DocumentsService);

  protected readonly doc = rxResource({
    params: () => ({
      period: (this.year()
        ? { year: this.year() }
        : { month: this.month() || new Date().toLocaleDateString('en-CA').slice(0, 7) }) as TargetPeriod,
      rep: this.rep(),
    }),
    stream: ({ params }) =>
      forkJoin({
        company: this.documents.getCompany(),
        report: params.rep ? this.repReport(params.rep, params.period) : this.allReport(params.period),
      }),
  });

  protected print(asPdf: boolean): void {
    const data = this.doc.value();
    const title = document.title;
    // The browser uses the page title as the PDF file name.
    if (asPdf && data) document.title = `${data.report.title} ${data.report.subtitle} ${data.report.period}`;
    window.print();
    document.title = title;
  }

  protected companyLines(c: Company): string[] {
    return [c.address, c.phone && `تليفون: ${c.phone}`].filter((l): l is string => !!l);
  }

  private money = (n: number) => formatCurrency(n, this.locale, 'ج.م.', 'EGP', '1.0-2');
  private day = (d: string) => arabicDigits(formatDate(d, 'd/M/y', this.locale));
  private periodLabel = (p: TargetPeriod) =>
    'year' in p ? `سنة ${arabicDigits(p.year)}` : `شهر ${arabicDigits(formatDate(`${p.month}-01T00:00:00`, 'MMMM y', this.locale))}`;
  private target = (n: number | null) => (n ? this.money(n) : '—');
  private pct = (n: number | null) => (n === null ? '—' : arabicDigits(`${n}%`));
  private rate = (n: number) => arabicDigits(`${n}%`);
  private method = (m: PaymentMethod | null, chequeStatus: string | null) =>
    (m ? PAYMENT_METHOD_LABELS[m] : DEFERRED_LABEL) + (chequeStatus === 'BOUNCED' ? ' (شيك مرتد - غير محسوب)' : '');

  private allReport(period: TargetPeriod): Observable<Report> {
    return this.users.getTargets(period).pipe(
      map(({ reps }) => {
        const sum = (f: (r: TargetRow) => number) => reps.reduce((s, r) => s + f(r), 0);
        return {
          title: 'تقرير التارجت والعمولات',
          subtitle: 'كل المناديب',
          period: this.periodLabel(period),
          summary: [
            ['عدد المناديب', arabicDigits(String(reps.length))],
            ['إجمالي صافي المبيعات', this.money(sum((r) => r.netSales))],
            ['إجمالي التحصيل', this.money(sum((r) => r.collected))],
            ['إجمالي العمولات', this.money(sum((r) => r.commission))],
          ],
          sections: [
            {
              title: 'المناديب',
              columns: ['#', 'المندوب', 'تارجت المبيعات', 'صافي المبيعات', 'الإنجاز', 'تارجت التحصيل', 'التحصيل', 'الإنجاز', 'العمولة'],
              rows: reps.map((r, i) => [
                arabicDigits(String(i + 1)),
                r.isActive ? r.name : `${r.name} (موقوف)`,
                this.target(r.salesGoal),
                this.money(r.netSales),
                this.pct(r.salesProgress),
                this.target(r.collectionGoal),
                this.money(r.collected),
                this.pct(r.collectionProgress),
                this.money(r.commission),
              ]),
              total: ['', 'الإجمالي', '', this.money(sum((r) => r.netSales)), '', '', this.money(sum((r) => r.collected)), '', this.money(sum((r) => r.commission))],
            },
          ],
          signatures: ['إعداد', 'اعتماد الإدارة'],
        };
      }),
    );
  }

  private repReport(id: string, period: TargetPeriod): Observable<Report> {
    return this.users.getRepTargets(id, period).pipe(
      map(({ rep: r, invoices, returns, collections }) => ({
        title: 'تقرير مندوب',
        subtitle: r.name,
        period: this.periodLabel(period),
        summary: [
          ['إجمالي الفواتير', `${this.money(r.sales)} (${arabicDigits(String(invoices.length))} فاتورة)`],
          ['المرتجعات', `${this.money(r.returns)} (${arabicDigits(String(returns.length))})`],
          ['صافي المبيعات', this.money(r.netSales)],
          ['التحصيل', this.money(r.collected)],
          ['العمولة المستحقة', this.money(r.commission)],
        ],
        sections: [
          {
            title: 'التارجت والعمولة',
            columns: ['البند', 'التارجت', 'المحقق', 'الإنجاز', 'نسبة العمولة', 'العمولة'],
            rows: [
              ['صافي المبيعات', this.target(r.salesGoal), this.money(r.netSales), this.pct(r.salesProgress), this.rate(r.salesCommissionRate), this.money(r.salesCommission)],
              ['التحصيل', this.target(r.collectionGoal), this.money(r.collected), this.pct(r.collectionProgress), this.rate(r.collectionCommissionRate), this.money(r.collectionCommission)],
            ],
            total: ['الإجمالي', '', '', '', '', this.money(r.commission)],
          },
          {
            title: 'فواتير البيع',
            columns: ['#', 'رقم الفاتورة', 'التاريخ', 'العميل', 'طريقة الدفع', 'الإجمالي', 'المدفوع'],
            rows: invoices.map((i, n) => [
              arabicDigits(String(n + 1)),
              i.invoiceNumber,
              this.day(i.createdAt),
              i.customer.name,
              this.method(i.paymentMethod, i.chequeStatus),
              this.money(i.total),
              this.money(i.paidAmount),
            ]),
            total: ['', 'الإجمالي', '', '', '', this.money(r.sales), ''],
          },
          {
            title: 'فواتير المرتجع',
            columns: ['#', 'رقم المرتجع', 'التاريخ', 'العميل', 'من فاتورة', 'الإجمالي'],
            rows: returns.map((x, n) => [
              arabicDigits(String(n + 1)),
              arabicDigits(String(x.number)),
              this.day(x.createdAt),
              x.customer.name,
              x.invoice.invoiceNumber,
              this.money(x.total),
            ]),
            total: ['', 'الإجمالي', '', '', '', this.money(r.returns)],
          },
          {
            title: 'التحصيلات',
            columns: ['#', 'رقم الإيصال', 'التاريخ', 'العميل', 'طريقة الدفع', 'المبلغ'],
            rows: collections.map((c, n) => [
              arabicDigits(String(n + 1)),
              c.receiptNumber,
              this.day(c.createdAt),
              c.customer.name,
              this.method(c.paymentMethod, c.chequeStatus) + (c.chequeNumber ? ` ${c.chequeNumber}` : ''),
              this.money(c.amount),
            ]),
          },
        ],
        signatures: ['توقيع المندوب', 'اعتماد الإدارة'],
      })),
    );
  }
}
