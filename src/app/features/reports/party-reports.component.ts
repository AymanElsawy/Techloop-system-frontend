import { Component, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';

import { httpErrorMessage } from '../../core/http/http-error';
import { StatusMessageComponent } from '../../shared/components/status-message/status-message.component';
import { DEFERRED_LABEL, PAYMENT_METHOD_LABELS, PaymentMethod } from '../invoices/models/invoice.model';
import {
  CustomerReport,
  CustomersReport,
  PartyKind,
  ReportLine,
  ReportsService,
  SupplierReport,
  SuppliersReport,
} from './reports.service';

const isoDay = (d: Date) => d.toLocaleDateString('en-CA');

const LINE_LABELS: Record<ReportLine['kind'], string> = {
  invoice: 'فاتورة بيع',
  return: 'مرتجع',
  collection: 'تحصيل',
  receipt: 'وارد',
  payment: 'دفعة',
};

const LINE_LINKS: Partial<Record<ReportLine['kind'], string>> = {
  invoice: '/invoices',
  return: '/returns',
  collection: '/collections',
  receipt: '/inventory/movements',
};

/**
 * Reports › العملاء / الموردين: every customer (supplier) in a period, or one of them in detail
 * (totals, products, and every document). Both export to Excel.
 */
@Component({
  selector: 'app-party-reports',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, PercentPipe, RouterLink, StatusMessageComponent],
  template: `
    <div class="card grid gap-3 sm:grid-cols-4">
      <div class="sm:col-span-2">
        @if (selected()) {
          <span class="form-label">التقرير</span>
          <button type="button" class="btn-outline" (click)="selected.set(null)">→ {{ isCustomers() ? 'كل العملاء' : 'كل الموردين' }}</button>
        } @else {
          <label for="party-search" class="form-label">بحث</label>
          <input id="party-search" class="form-input" [placeholder]="isCustomers() ? 'اسم العميل' : 'اسم المورد'" [value]="search()" (input)="search.set($any($event.target).value)" />
        }
      </div>
      <div>
        <label for="party-from" class="form-label">من</label>
        <input id="party-from" type="date" class="form-input" [value]="from()" (change)="$any($event.target).value && from.set($any($event.target).value)" />
      </div>
      <div>
        <label for="party-to" class="form-label">إلى</label>
        <input id="party-to" type="date" class="form-input" [value]="to()" (change)="$any($event.target).value && to.set($any($event.target).value)" />
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg font-bold">
        @if (selected() && detail.value(); as d) {
          @if (asCustomer(d); as c) {
            <a [routerLink]="['/customers', c.customer.id]" class="hover:underline">{{ c.customer.name }}</a>
          } @else if (asSupplier(d); as s) {
            <a [routerLink]="['/suppliers', s.supplier.id]" class="hover:underline">{{ s.supplier.name }}</a>
          }
        } @else {
          {{ isCustomers() ? 'كل العملاء' : 'كل الموردين' }}
        }
      </h2>
      <div class="flex flex-wrap gap-2">
        @if (selected(); as id) {
          <a [routerLink]="['/reports', kind(), id, 'statement']" [queryParams]="{ from: from(), to: to() }" class="btn-outline">كشف حساب PDF / واتساب</a>
        }
        <button type="button" class="btn-primary" [disabled]="exporting()" (click)="export()">
          {{ exporting() ? 'جاري التصدير...' : 'تصدير Excel' }}
        </button>
      </div>
    </div>
    @if (exportError(); as e) {
      <p role="alert" class="rounded-lg bg-vibrant-coral-900 px-3 py-2 text-sm text-vibrant-coral-300">{{ e }}</p>
    }

    @if (selected()) {
      @if (detail.isLoading() && !detail.hasValue()) {
        <app-status-message type="loading" message="جاري تحميل التقرير..." />
      } @else if (detail.error()) {
        <app-status-message type="error" message="حدث خطأ أثناء تحميل التقرير." (retry)="detail.reload()" />
      } @else if (detail.value(); as d) {
        @if (asCustomer(d); as c) {
          <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div class="card"><p class="text-sm text-stormy-teal">صافي المبيعات</p><p class="mt-2 text-xl font-bold">{{ c.totals.net | currency: 'EGP' : 'symbol' : '1.0-2' }}</p><p class="text-xs text-stormy-teal">{{ c.totals.invoices }} فاتورة · مرتجع {{ c.totals.returns | currency: 'EGP' : 'symbol' : '1.0-2' }}</p></div>
            <div class="card"><p class="text-sm text-stormy-teal">الربح</p><p class="mt-2 text-xl font-bold" [class.text-vibrant-coral-400]="c.totals.profit < 0">{{ c.totals.profit | currency: 'EGP' : 'symbol' : '1.0-2' }}</p><p class="text-xs text-stormy-teal">الهامش {{ c.totals.net > 0 ? (c.totals.profit / c.totals.net | percent) : '—' }}</p></div>
            <div class="card"><p class="text-sm text-stormy-teal">المحصّل</p><p class="mt-2 text-xl font-bold">{{ c.totals.collected | currency: 'EGP' : 'symbol' : '1.0-2' }}</p></div>
            <div class="card"><p class="text-sm text-stormy-teal">الرصيد الحالي</p><p class="mt-2 text-xl font-bold" [class.text-vibrant-coral-400]="c.customer.balance > 0">{{ c.customer.balance | currency: 'EGP' : 'symbol' : '1.0-2' }}</p><p class="text-xs text-stormy-teal">{{ c.customer.balance >= 0 ? 'عليه' : 'له' }} النهارده</p></div>
          </div>
          @if (c.products.length) {
            <div class="card overflow-x-auto p-0">
              <table class="w-full text-right text-sm">
                <thead class="table-head">
                  <tr>
                    <th scope="col" class="px-4 py-3 font-semibold">الصنف</th>
                    <th scope="col" class="px-4 py-3 font-semibold">الكمية</th>
                    <th scope="col" class="px-4 py-3 font-semibold">الصافي</th>
                    <th scope="col" class="px-4 py-3 font-semibold">الربح</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-stormy-teal-900">
                  @for (p of c.products; track p.id) {
                    <tr>
                      <td class="px-4 py-3 font-semibold">{{ p.name }}</td>
                      <td class="px-4 py-3 tabular-nums">{{ p.quantity | number }}</td>
                      <td class="whitespace-nowrap px-4 py-3">{{ p.net | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                      <td class="whitespace-nowrap px-4 py-3" [class.text-vibrant-coral-400]="p.profit < 0">{{ p.profit | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        } @else if (asSupplier(d); as s) {
          <div class="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <div class="card"><p class="text-sm text-stormy-teal">المشتريات</p><p class="mt-2 text-xl font-bold">{{ s.totals.purchases | currency: 'EGP' : 'symbol' : '1.0-2' }}</p><p class="text-xs text-stormy-teal">{{ s.totals.receipts }} مرة توريد</p></div>
            <div class="card"><p class="text-sm text-stormy-teal">المدفوع</p><p class="mt-2 text-xl font-bold">{{ s.totals.paid | currency: 'EGP' : 'symbol' : '1.0-2' }}</p></div>
            <div class="card"><p class="text-sm text-stormy-teal">المديونية الحالية</p><p class="mt-2 text-xl font-bold" [class.text-vibrant-coral-400]="s.supplier.debt > 0">{{ s.supplier.debt | currency: 'EGP' : 'symbol' : '1.0-2' }}</p><p class="text-xs text-stormy-teal">علينا النهارده</p></div>
          </div>
          @if (s.products.length) {
            <div class="card overflow-x-auto p-0">
              <table class="w-full text-right text-sm">
                <thead class="table-head">
                  <tr>
                    <th scope="col" class="px-4 py-3 font-semibold">الصنف</th>
                    <th scope="col" class="px-4 py-3 font-semibold">الكمية</th>
                    <th scope="col" class="px-4 py-3 font-semibold">متوسط السعر</th>
                    <th scope="col" class="px-4 py-3 font-semibold">الإجمالي</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-stormy-teal-900">
                  @for (p of s.products; track p.product.id) {
                    <tr>
                      <td class="px-4 py-3 font-semibold">{{ p.product.name }}</td>
                      <td class="px-4 py-3 tabular-nums">{{ p.quantity | number }}</td>
                      <td class="whitespace-nowrap px-4 py-3">{{ p.avgCost | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                      <td class="whitespace-nowrap px-4 py-3">{{ p.total | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }

        @if (!d.lines.length && !d.opening) {
          <app-status-message type="empty" message="مفيش حركات في الفترة دي." />
        } @else {
          <div class="card overflow-x-auto p-0">
            <table class="w-full text-right text-sm">
              <thead class="table-head">
                <tr>
                  <th scope="col" class="px-4 py-3 font-semibold">التاريخ</th>
                  <th scope="col" class="px-4 py-3 font-semibold">المستند</th>
                  <th scope="col" class="px-4 py-3 font-semibold">{{ isCustomers() ? 'مدين (عليه)' : 'المشتريات (له)' }}</th>
                  <th scope="col" class="px-4 py-3 font-semibold">{{ isCustomers() ? 'دائن (له)' : 'المدفوع (عليه)' }}</th>
                  <th scope="col" class="px-4 py-3 font-semibold">الرصيد</th>
                  <th scope="col" class="px-4 py-3 font-semibold">طريقة الدفع</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stormy-teal-900">
                <tr class="bg-stormy-teal-900/30 font-semibold">
                  <td class="px-4 py-3" colspan="4">رصيد أول المدة</td>
                  <td class="whitespace-nowrap px-4 py-3">{{ d.opening | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                  <td></td>
                </tr>
                @for (l of d.lines; track l.kind + l.id) {
                  <tr>
                    <td class="whitespace-nowrap px-4 py-3">{{ l.date | date: 'd/M/y' }}</td>
                    <td class="whitespace-nowrap px-4 py-3">
                      @if (lineLinks[l.kind]; as base) {
                        <a [routerLink]="[base, l.id]" class="hover:underline">{{ lineLabels[l.kind] }} {{ l.number }}</a>
                      } @else {
                        {{ lineLabels[l.kind] }} {{ l.number }}
                      }
                    </td>
                    <td class="whitespace-nowrap px-4 py-3">{{ l.debit ? (l.debit | currency: 'EGP' : 'symbol' : '1.0-2') : '—' }}</td>
                    <td class="whitespace-nowrap px-4 py-3">{{ l.credit ? (l.credit | currency: 'EGP' : 'symbol' : '1.0-2') : '—' }}</td>
                    <td class="whitespace-nowrap px-4 py-3 font-semibold">{{ l.balance | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                    <td class="whitespace-nowrap px-4 py-3">
                      {{ method(l) }}
                      @if (l.bounced) {
                        <span class="text-vibrant-coral-400">(مرتد، مش محسوب)</span>
                      } @else if (l.pending) {
                        <span class="text-stormy-teal">(مع المندوب)</span>
                      }
                    </td>
                  </tr>
                }
                <tr class="bg-stormy-teal-900/30 font-semibold">
                  <td class="px-4 py-3" colspan="4">رصيد آخر المدة</td>
                  <td class="whitespace-nowrap px-4 py-3" [class.text-vibrant-coral-400]="d.closing > 0">{{ d.closing | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          @if (isCustomers()) {
            <p class="text-xs text-stormy-teal">الفلوس اللي مع المندوب بتتخصم من الرصيد على طول. الشيك المرتد مش محسوب في المدفوع.</p>
          }
        }
      }
    } @else if (list.isLoading() && !list.hasValue()) {
      <app-status-message type="loading" message="جاري تحميل التقرير..." />
    } @else if (list.error()) {
      <app-status-message type="error" message="حدث خطأ أثناء تحميل التقرير." (retry)="list.reload()" />
    } @else if (list.value(); as l) {
      @if (asCustomers(l); as c) {
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div class="card"><p class="text-sm text-stormy-teal">صافي المبيعات</p><p class="mt-2 text-xl font-bold">{{ c.totals.net | currency: 'EGP' : 'symbol' : '1.0-2' }}</p><p class="text-xs text-stormy-teal">{{ c.totals.invoices }} فاتورة · {{ c.rows.length }} عميل</p></div>
          <div class="card"><p class="text-sm text-stormy-teal">الربح</p><p class="mt-2 text-xl font-bold">{{ c.totals.profit | currency: 'EGP' : 'symbol' : '1.0-2' }}</p></div>
          <div class="card"><p class="text-sm text-stormy-teal">المحصّل</p><p class="mt-2 text-xl font-bold">{{ c.totals.collected | currency: 'EGP' : 'symbol' : '1.0-2' }}</p></div>
          <div class="card"><p class="text-sm text-stormy-teal">المديونية الحالية</p><p class="mt-2 text-xl font-bold">{{ c.totals.balance | currency: 'EGP' : 'symbol' : '1.0-2' }}</p></div>
        </div>
        @if (!customerRows().length) {
          <app-status-message type="empty" message="مفيش عملاء مطابقين." />
        } @else {
          <div class="card overflow-x-auto p-0">
            <table class="w-full text-right text-sm">
              <thead class="table-head">
                <tr>
                  <th scope="col" class="px-4 py-3 font-semibold">العميل</th>
                  <th scope="col" class="px-4 py-3 font-semibold">الفواتير</th>
                  <th scope="col" class="px-4 py-3 font-semibold">المبيعات</th>
                  <th scope="col" class="px-4 py-3 font-semibold">المرتجعات</th>
                  <th scope="col" class="px-4 py-3 font-semibold">الصافي</th>
                  <th scope="col" class="px-4 py-3 font-semibold">الربح</th>
                  <th scope="col" class="px-4 py-3 font-semibold">المحصّل</th>
                  <th scope="col" class="px-4 py-3 font-semibold">الرصيد الحالي</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stormy-teal-900">
                @for (r of customerRows(); track r.customer.id) {
                  <tr>
                    <td class="px-4 py-3">
                      <button type="button" class="font-semibold hover:text-stormy-teal hover:underline" (click)="selected.set(r.customer.id)">{{ r.customer.name }}</button>
                      <p class="text-xs text-stormy-teal">{{ r.customer.governorate }}</p>
                    </td>
                    <td class="px-4 py-3 tabular-nums">{{ r.invoices }}</td>
                    <td class="whitespace-nowrap px-4 py-3">{{ r.sales | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                    <td class="whitespace-nowrap px-4 py-3">{{ r.returns ? (r.returns | currency: 'EGP' : 'symbol' : '1.0-2') : '—' }}</td>
                    <td class="whitespace-nowrap px-4 py-3 font-semibold">{{ r.net | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                    <td class="whitespace-nowrap px-4 py-3" [class.text-vibrant-coral-400]="r.profit < 0">{{ r.profit | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                    <td class="whitespace-nowrap px-4 py-3">{{ r.collected | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                    <td class="whitespace-nowrap px-4 py-3 font-semibold" [class.text-vibrant-coral-400]="r.balance > 0">{{ r.balance | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="text-xs text-stormy-teal">دوس على اسم العميل عشان تشوف تقريره بالتفصيل. الرصيد الحالي هو رصيد النهارده بعد خصم الفلوس اللي مع المندوب (موجب = عليه).</p>
        }
      } @else if (asSuppliers(l); as s) {
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <div class="card"><p class="text-sm text-stormy-teal">المشتريات</p><p class="mt-2 text-xl font-bold">{{ s.totals.purchases | currency: 'EGP' : 'symbol' : '1.0-2' }}</p><p class="text-xs text-stormy-teal">{{ s.totals.receipts }} مرة توريد · {{ s.rows.length }} مورد</p></div>
          <div class="card"><p class="text-sm text-stormy-teal">المدفوع</p><p class="mt-2 text-xl font-bold">{{ s.totals.paid | currency: 'EGP' : 'symbol' : '1.0-2' }}</p></div>
          <div class="card"><p class="text-sm text-stormy-teal">المديونية الحالية</p><p class="mt-2 text-xl font-bold">{{ s.totals.debt | currency: 'EGP' : 'symbol' : '1.0-2' }}</p></div>
        </div>
        @if (!supplierRows().length) {
          <app-status-message type="empty" message="مفيش موردين مطابقين." />
        } @else {
          <div class="card overflow-x-auto p-0">
            <table class="w-full text-right text-sm">
              <thead class="table-head">
                <tr>
                  <th scope="col" class="px-4 py-3 font-semibold">المورد</th>
                  <th scope="col" class="px-4 py-3 font-semibold">مرات التوريد</th>
                  <th scope="col" class="px-4 py-3 font-semibold">المشتريات</th>
                  <th scope="col" class="px-4 py-3 font-semibold">المدفوع</th>
                  <th scope="col" class="px-4 py-3 font-semibold">المديونية الحالية</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stormy-teal-900">
                @for (r of supplierRows(); track r.supplier.id) {
                  <tr>
                    <td class="px-4 py-3">
                      <button type="button" class="font-semibold hover:text-stormy-teal hover:underline" (click)="selected.set(r.supplier.id)">{{ r.supplier.name }}</button>
                      @if (r.supplier.phone) {
                        <p class="text-xs text-stormy-teal">{{ r.supplier.phone }}</p>
                      }
                    </td>
                    <td class="px-4 py-3 tabular-nums">{{ r.receipts }}</td>
                    <td class="whitespace-nowrap px-4 py-3">{{ r.purchases | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                    <td class="whitespace-nowrap px-4 py-3">{{ r.paid | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                    <td class="whitespace-nowrap px-4 py-3 font-semibold" [class.text-vibrant-coral-400]="r.debt > 0">{{ r.debt | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="text-xs text-stormy-teal">دوس على اسم المورد عشان تشوف تقريره بالتفصيل. المديونية الحالية هي اللي علينا النهارده.</p>
        }
      }
    }
  `,
  host: { class: 'block space-y-6' },
})
export class PartyReportsComponent {
  private readonly reports = inject(ReportsService);

  readonly kind = input.required<PartyKind>();
  protected readonly isCustomers = computed(() => this.kind() === 'customers');

  private readonly now = new Date();
  protected readonly from = signal(isoDay(new Date(this.now.getFullYear(), this.now.getMonth(), 1)));
  protected readonly to = signal(isoDay(this.now));
  protected readonly search = signal('');
  /** The customer / supplier shown in detail; null = everyone. */
  protected readonly selected = signal<string | null>(null);

  protected readonly list = rxResource({
    params: () => (this.selected() ? undefined : { kind: this.kind(), from: this.from(), to: this.to() }),
    stream: ({ params }) => this.reports.getParty<CustomersReport | SuppliersReport>(params.kind, params.from, params.to),
  });
  protected readonly detail = rxResource({
    params: () => {
      const id = this.selected();
      return id ? { path: `${this.kind()}/${id}`, from: this.from(), to: this.to() } : undefined;
    },
    stream: ({ params }) => this.reports.getParty<CustomerReport | SupplierReport>(params.path, params.from, params.to),
  });

  // The resources return one of two shapes; these narrow them for the template.
  protected asCustomers = (r: CustomersReport | SuppliersReport) => (this.isCustomers() ? (r as CustomersReport) : null);
  protected asSuppliers = (r: CustomersReport | SuppliersReport) => (this.isCustomers() ? null : (r as SuppliersReport));
  protected asCustomer = (r: CustomerReport | SupplierReport) => ('customer' in r ? r : null);
  protected asSupplier = (r: CustomerReport | SupplierReport) => ('supplier' in r ? r : null);

  protected readonly customerRows = computed(() => {
    const l = this.list.value();
    const q = this.search().trim();
    return l && this.isCustomers() ? (l as CustomersReport).rows.filter((r) => !q || r.customer.name.includes(q)) : [];
  });
  protected readonly supplierRows = computed(() => {
    const l = this.list.value();
    const q = this.search().trim();
    return l && !this.isCustomers() ? (l as SuppliersReport).rows.filter((r) => !q || r.supplier.name.includes(q)) : [];
  });

  protected readonly lineLabels = LINE_LABELS;
  protected readonly lineLinks = LINE_LINKS;

  protected method(l: ReportLine): string {
    if (l.method) return PAYMENT_METHOD_LABELS[l.method as PaymentMethod] ?? l.method;
    return l.kind === 'invoice' ? DEFERRED_LABEL : '';
  }

  protected readonly exporting = signal(false);
  protected readonly exportError = signal<string | null>(null);

  protected export(): void {
    const id = this.selected();
    const d = this.detail.value();
    const name = id && d ? ('customer' in d ? d.customer.name : d.supplier.name) : this.isCustomers() ? 'كل-العملاء' : 'كل-الموردين';
    this.exporting.set(true);
    this.exportError.set(null);
    this.reports
      .download(id ? `${this.kind()}/${id}` : this.kind(), `${name}-${this.from()}_${this.to()}.csv`, {
        from: this.from(),
        to: this.to(),
      })
      .subscribe({
        next: () => this.exporting.set(false),
        error: (err: unknown) => {
          this.exporting.set(false);
          this.exportError.set(httpErrorMessage(err, 'تعذر التصدير. حاول مرة أخرى.'));
        },
      });
  }
}
