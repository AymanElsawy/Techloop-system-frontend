import { Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { formatCurrency, formatDate } from '@angular/common';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { arabicDigits } from '../../shared/date.pipe';
import { StatusMessageComponent } from '../../shared/components/status-message/status-message.component';
import { DEFERRED_LABEL, PAYMENT_METHOD_LABELS, PaymentMethod } from '../invoices/models/invoice.model';
import { Company } from '../documents/documents.model';
import { DocumentsService } from '../documents/documents.service';
import { CustomerReport, PartyKind, ReportLine, ReportsService, SupplierReport } from './reports.service';

const LINE_LABELS: Record<ReportLine['kind'], string> = {
  invoice: 'فاتورة بيع',
  return: 'مرتجع',
  collection: 'تحصيل',
  receipt: 'توريد',
  payment: 'دفعة',
};

/** What differs between a customer's and a supplier's statement. */
const KIND = {
  customers: {
    party: 'العميل',
    columns: ['التاريخ', 'المستند', 'مدين (عليه)', 'دائن (له)', 'الرصيد', 'ملاحظة'],
    owes: ['مستحق على العميل', 'مستحق للعميل'],
    note: 'مدين = فواتير البيع. دائن = المدفوع في الفواتير والتحصيلات والمرتجعات. الشيك المرتد غير محسوب.',
    sign: 'توقيع العميل',
  },
  suppliers: {
    party: 'المورد',
    columns: ['التاريخ', 'المستند', 'التوريدات (له)', 'المدفوع (عليه)', 'الرصيد', 'ملاحظة'],
    owes: ['مستحق للمورد', 'مستحق على المورد'],
    note: 'التوريدات = قيمة البضاعة الموردة. المدفوع = المدفوع وقت التوريد والدفعات.',
    sign: 'توقيع المورد',
  },
} as const;

type Report = CustomerReport | SupplierReport;
const partyOf = (r: Report) => ('customer' in r ? { ...r.customer } : { ...r.supplier, governorate: null });

/** Egyptian mobile (01xxxxxxxxx) → wa.me number (201xxxxxxxxx); null when there's no usable phone. */
export function whatsappNumber(phone: string | null): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  return digits.startsWith('0') ? `2${digits}` : digits;
}

/**
 * /reports/(customers|suppliers)/:id/statement?from=&to= — كشف حساب on an A4 sheet: print, save as PDF,
 * and open a WhatsApp chat with the customer / supplier (the PDF is attached by hand). No profit or cost: it's for them.
 */
@Component({
  selector: 'app-statement-print',
  imports: [RouterLink, StatusMessageComponent],
  template: `
    <section class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <a routerLink="/reports" class="text-sm text-stormy-teal hover:underline">→ رجوع للتقارير</a>
        <div class="flex flex-wrap gap-2">
          @if (doc.value(); as v) {
            @if (whatsappLink(v.report); as wa) {
              <a [href]="wa" target="_blank" rel="noopener" class="btn-outline">واتساب {{ labels().party === 'العميل' ? 'للعميل' : 'للمورد' }}</a>
            }
          }
          <button type="button" class="btn-outline" (click)="print(true)" [disabled]="!doc.hasValue()">تصدير PDF</button>
          <button type="button" class="btn-primary" (click)="print(false)" [disabled]="!doc.hasValue()">طباعة</button>
        </div>
      </div>
      <p class="text-xs text-stormy-teal print:hidden">
        للـ PDF: اختار "Save as PDF / حفظ كـ PDF" من نافذة الطباعة. زرار "واتساب" بيفتح المحادثة برسالة فيها الرصيد، وبعدها ابعت ملف الـ PDF.
      </p>

      @if (doc.isLoading() && !doc.hasValue()) {
        <app-status-message type="loading" message="جاري تجهيز كشف الحساب..." />
      } @else if (doc.error()) {
        <app-status-message type="error" message="حدث خطأ أثناء تحميل كشف الحساب." (retry)="doc.reload()" />
      } @else if (doc.value(); as v) {
        <!-- Same fixed black/white sheet as the documents print view. -->
        <article
          class="mx-auto flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-white p-[12mm] text-[12px] leading-relaxed text-black shadow-lg print:min-h-0 print:max-w-none print:p-0 print:shadow-none"
        >
          <header class="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
            <div>
              <p class="text-2xl font-bold">{{ v.company.name }}</p>
              @for (line of companyLines(v.company); track line) {
                <p class="text-xs text-gray-700"><bdi>{{ line }}</bdi></p>
              }
            </div>
            <div class="text-left">
              <p class="text-xl font-bold">كشف حساب</p>
              <p class="text-xs text-gray-700">{{ period(v.report) }}</p>
              <p class="text-xs text-gray-700">تاريخ الطباعة: {{ today }}</p>
            </div>
          </header>

          <div class="mt-5 grid grid-cols-2 gap-6">
            <div class="rounded border border-gray-400 p-3">
              <p class="text-xs text-gray-600">{{ labels().party }}</p>
              <p class="text-sm font-bold">{{ party(v.report).name }}</p>
              @if (party(v.report).governorate; as g) {
                <p>{{ g }}</p>
              }
              @if (party(v.report).phone; as phone) {
                <p><bdi>{{ phone }}</bdi></p>
              }
            </div>
            <dl class="rounded border border-gray-400 p-3">
              @for (s of summary(v.report); track s[0]; let last = $last) {
                <div class="flex justify-between gap-3" [class.font-bold]="last">
                  <dt class="text-gray-600">{{ s[0] }}</dt>
                  <dd class="tabular-nums">{{ s[1] }}</dd>
                </div>
              }
            </dl>
          </div>

          <table class="mt-5 w-full border-collapse">
            <thead>
              <tr class="bg-gray-200">
                @for (c of labels().columns; track $index) {
                  <th class="border border-gray-400 px-1.5 py-1 text-start font-bold">{{ c }}</th>
                }
              </tr>
            </thead>
            <tbody>
              <tr class="bg-gray-100 font-bold">
                <td class="border border-gray-400 px-1.5 py-1" colspan="4">رصيد أول المدة</td>
                <td class="border border-gray-400 px-1.5 py-1">{{ money(v.report.opening) }}</td>
                <td class="border border-gray-400 px-1.5 py-1"></td>
              </tr>
              @for (l of v.report.lines; track l.kind + l.id) {
                <tr class="break-inside-avoid">
                  <td class="border border-gray-400 px-1.5 py-1">{{ day(l.date) }}</td>
                  <td class="border border-gray-400 px-1.5 py-1">{{ lineLabels[l.kind] }} {{ l.number }}</td>
                  <td class="border border-gray-400 px-1.5 py-1">{{ l.debit ? money(l.debit) : '' }}</td>
                  <td class="border border-gray-400 px-1.5 py-1">{{ l.credit ? money(l.credit) : '' }}</td>
                  <td class="border border-gray-400 px-1.5 py-1 font-bold">{{ money(l.balance) }}</td>
                  <td class="border border-gray-400 px-1.5 py-1">{{ note(l) }}</td>
                </tr>
              }
              <tr class="bg-gray-100 font-bold">
                <td class="border border-gray-400 px-1.5 py-1" colspan="2">الإجمالي</td>
                <td class="border border-gray-400 px-1.5 py-1">{{ money(total(v.report, 'debit')) }}</td>
                <td class="border border-gray-400 px-1.5 py-1">{{ money(total(v.report, 'credit')) }}</td>
                <td class="border border-gray-400 px-1.5 py-1" colspan="2"></td>
              </tr>
              <tr class="bg-gray-200 font-bold">
                <td class="border border-gray-400 px-1.5 py-1" colspan="4">رصيد آخر المدة ({{ labels().owes[v.report.closing >= 0 ? 0 : 1] }})</td>
                <td class="border border-gray-400 px-1.5 py-1">{{ money(abs(v.report.closing)) }}</td>
                <td class="border border-gray-400 px-1.5 py-1"></td>
              </tr>
            </tbody>
          </table>

          <p class="mt-4 text-[11px] text-gray-600">{{ labels().note }}</p>

          <div class="mt-auto pt-16">
            <div class="grid grid-cols-2 gap-16">
              <div class="border-t border-black pt-1 text-center text-sm">{{ labels().sign }}</div>
              <div class="border-t border-black pt-1 text-center text-sm">اعتماد الحسابات</div>
            </div>
            <footer class="mt-8 border-t border-gray-300 pt-2 text-center text-xs text-gray-600">
              @if (v.company.footer) {
                <p>{{ v.company.footer }}</p>
              }
              <p>{{ v.company.name }} — كشف حساب {{ party(v.report).name }}</p>
            </footer>
          </div>
        </article>
      }
    </section>
  `,
})
export class StatementPrintComponent {
  readonly kind = input.required<PartyKind>();
  readonly id = input.required<string>();
  /** YYYY-MM-DD; the API defaults to this month when missing. */
  readonly from = input<string>();
  readonly to = input<string>();

  private readonly locale = inject(LOCALE_ID);
  private readonly reports = inject(ReportsService);
  private readonly documents = inject(DocumentsService);

  protected readonly doc = rxResource({
    params: () => ({ path: `${this.kind()}/${this.id()}`, from: this.from() ?? '', to: this.to() ?? '' }),
    stream: ({ params }) =>
      forkJoin({
        company: this.documents.getCompany(),
        report: this.reports.getParty<Report>(params.path, params.from, params.to),
      }),
  });

  protected readonly labels = computed(() => KIND[this.kind()] ?? KIND.customers);
  protected readonly party = partyOf;
  protected readonly lineLabels = LINE_LABELS;
  protected readonly today = arabicDigits(formatDate(new Date(), 'd/M/y', this.locale));
  protected readonly abs = Math.abs;

  protected money = (n: number) => formatCurrency(n, this.locale, 'ج.م.', 'EGP', '1.0-2');
  protected day = (d: string) => arabicDigits(formatDate(d, 'd/M/y', this.locale));

  protected period(r: Report): string {
    return `من ${this.day(`${r.from}T00:00:00`)} إلى ${this.day(`${r.to}T00:00:00`)}`;
  }

  protected summary(r: Report): [string, string][] {
    const [debit, credit] = this.labels().columns.slice(2, 4);
    return [
      ['رصيد أول المدة', this.money(r.opening)],
      [`إجمالي ${debit}`, this.money(this.total(r, 'debit'))],
      [`إجمالي ${credit}`, this.money(this.total(r, 'credit'))],
      ['رصيد آخر المدة', this.money(r.closing)],
    ];
  }

  protected total(r: Report, f: 'debit' | 'credit'): number {
    return Math.round(r.lines.reduce((s, l) => s + l[f], 0) * 100) / 100;
  }

  /** For the customer / supplier: payment method and bounced cheques; rep-held money is simply paid. */
  protected note(l: ReportLine): string {
    const method = l.method ? (PAYMENT_METHOD_LABELS[l.method as PaymentMethod] ?? '') : l.kind === 'invoice' ? DEFERRED_LABEL : '';
    return l.bounced ? `${method} - شيك مرتد (غير محسوب)` : method;
  }

  protected companyLines(c: Company): string[] {
    return [c.address, c.phone && `تليفون: ${c.phone}`].filter((l): l is string => !!l);
  }

  protected whatsappLink(r: Report): string | null {
    const p = partyOf(r);
    const number = whatsappNumber(p.phone);
    if (!number) return null;
    const owes = this.labels().owes[r.closing >= 0 ? 0 : 1];
    const text = `السلام عليكم ${p.name}،\nمرفق كشف حسابكم ${this.period(r)}.\nرصيد آخر المدة: ${this.money(Math.abs(r.closing))} (${owes})`;
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  }

  protected print(asPdf: boolean): void {
    const data = this.doc.value();
    const title = document.title;
    // The browser uses the page title as the PDF file name.
    if (asPdf && data) document.title = `كشف حساب ${partyOf(data.report).name} ${data.report.from}_${data.report.to}`;
    window.print();
    document.title = title;
  }
}
