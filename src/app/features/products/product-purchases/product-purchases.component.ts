import { Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { DatePipe } from '../../../shared/date.pipe';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';

import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { MovementType } from '../../inventory/models/inventory.model';
import { InventoryService } from '../../inventory/services/inventory.service';
import { PRODUCT_UNIT_LABELS, purchaseHistory } from '../models/product.model';
import { ProductService } from '../services/product.service';

/** /inventory/products/:id — a product's purchase history from every supplier, with average prices (managers only). */
@Component({
  selector: 'app-product-purchases',
  imports: [CurrencyPipe, DatePipe, RouterLink, StatusMessageComponent],
  template: `
    <section class="space-y-6">
      <a routerLink="/inventory/products" class="text-sm text-stormy-teal hover:underline">→ الأصناف</a>
      @if (product.isLoading() || movements.isLoading()) {
        <app-status-message type="loading" message="جاري التحميل..." />
      } @else if (product.error() || movements.error()) {
        <app-status-message type="error" message="حدث خطأ أثناء التحميل." (retry)="product.reload(); movements.reload()" />
      } @else if (product.value(); as p) {
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold">{{ p.name }}</h1>
            <p class="text-sm text-stormy-teal">
              {{ p.unit ? unitLabels[p.unit] : '' }}{{ p.unit && p.code ? ' · ' : '' }}<span dir="ltr">{{ p.code }}</span>
              {{ (p.unit || p.code) && p.manufacturer ? ' · ' : '' }}{{ p.manufacturer }}
            </p>
          </div>
          <div class="flex gap-2">
            @if (p.isActive) {
              <a routerLink="/inventory/receive" [queryParams]="{ productId: p.id }" class="btn-primary">وارد</a>
            }
            <a [routerLink]="['/inventory/products', p.id, 'edit']" class="btn-outline">تعديل</a>
          </div>
        </div>

        <dl class="card grid gap-5 sm:grid-cols-4">
          <div>
            <dt class="text-sm text-stormy-teal">الكمية الحالية</dt>
            <dd class="mt-1 font-semibold">{{ p.quantity }}</dd>
          </div>
          <div>
            <dt class="text-sm text-stormy-teal">سعر البيع</dt>
            <dd class="mt-1 font-semibold">{{ p.price | currency: 'EGP' : 'symbol' : '1.0-2' }}</dd>
          </div>
          <div>
            <dt class="text-sm text-stormy-teal">سعر الشراء</dt>
            <dd class="mt-1 font-semibold">{{ money(p.lastCost) }}</dd>
          </div>
          <div>
            <dt class="text-sm text-stormy-teal">متوسط سعر الشراء (للمخزون الحالي)</dt>
            <dd class="mt-1 font-semibold">{{ money(p.avgCost) }}</dd>
          </div>
          @if (history(); as h) {
            <div>
              <dt class="text-sm text-stormy-teal">عدد مرات الشراء</dt>
              <dd class="mt-1 font-semibold">{{ h.lines.length }}</dd>
            </div>
            <div>
              <dt class="text-sm text-stormy-teal">إجمالي الكمية المشتراة</dt>
              <dd class="mt-1 font-semibold">{{ h.quantity }}</dd>
            </div>
            <div>
              <dt class="text-sm text-stormy-teal">إجمالي قيمة المشتريات</dt>
              <dd class="mt-1 font-semibold">{{ h.total | currency: 'EGP' : 'symbol' : '1.0-2' }}</dd>
            </div>
            <div>
              <dt class="text-sm text-stormy-teal">متوسط سعر كل المشتريات</dt>
              <dd class="mt-1 font-semibold">{{ money(h.avgCost) }}</dd>
            </div>
            <div>
              <dt class="text-sm text-stormy-teal">أقل سعر / أعلى سعر</dt>
              <dd class="mt-1 font-semibold">{{ money(h.minCost) }} / {{ money(h.maxCost) }}</dd>
            </div>
          }
        </dl>

        @if (!history().lines.length) {
          <app-status-message type="empty" message="لا توجد عمليات شراء لهذا الصنف بعد." />
        } @else {
          <h2 class="text-lg font-bold">حسب المورد</h2>
          <div class="card overflow-x-auto p-0">
            <table class="w-full text-right text-sm">
              <thead class="table-head">
                <tr>
                  <th scope="col" class="px-4 py-3 font-semibold">المورد</th>
                  <th scope="col" class="px-4 py-3 font-semibold">مرات الشراء</th>
                  <th scope="col" class="px-4 py-3 font-semibold">الكمية</th>
                  <th scope="col" class="px-4 py-3 font-semibold">الإجمالي</th>
                  <th scope="col" class="px-4 py-3 font-semibold">متوسط السعر</th>
                  <th scope="col" class="px-4 py-3 font-semibold">آخر سعر</th>
                  <th scope="col" class="px-4 py-3 font-semibold">آخر شراء</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stormy-teal-900">
                @for (s of history().suppliers; track s.supplier?.id) {
                  <tr>
                    <td class="px-4 py-3">
                      @if (s.supplier) {
                        <a [routerLink]="['/suppliers', s.supplier.id]" class="font-semibold hover:text-vibrant-coral-400 hover:underline">{{ s.supplier.name }}</a>
                      } @else {
                        —
                      }
                    </td>
                    <td class="px-4 py-3">{{ s.count }}</td>
                    <td class="px-4 py-3">{{ s.quantity }}</td>
                    <td class="whitespace-nowrap px-4 py-3">{{ s.total | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                    <td class="whitespace-nowrap px-4 py-3 font-semibold">{{ s.avgCost | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                    <td class="whitespace-nowrap px-4 py-3">{{ s.lastCost | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                    <td class="whitespace-nowrap px-4 py-3">{{ s.lastDate | date: 'd MMM y' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <h2 class="text-lg font-bold">كل عمليات الشراء</h2>
          <div class="card overflow-x-auto p-0">
            <table class="w-full text-right text-sm">
              <thead class="table-head">
                <tr>
                  <th scope="col" class="px-4 py-3 font-semibold">التاريخ</th>
                  <th scope="col" class="px-4 py-3 font-semibold">رقم الوارد</th>
                  <th scope="col" class="px-4 py-3 font-semibold">المورد</th>
                  <th scope="col" class="px-4 py-3 font-semibold">المخزن</th>
                  <th scope="col" class="px-4 py-3 font-semibold">الكمية</th>
                  <th scope="col" class="px-4 py-3 font-semibold">سعر الوحدة</th>
                  <th scope="col" class="px-4 py-3 font-semibold">الإجمالي</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stormy-teal-900">
                @for (l of history().lines; track l.movementId) {
                  <tr>
                    <td class="whitespace-nowrap px-4 py-3">{{ l.date | date: 'd MMM y, h:mm a' }}</td>
                    <td class="px-4 py-3">
                      <a [routerLink]="['/inventory/movements', l.movementId]" class="text-vibrant-coral-400 hover:underline" dir="ltr">#{{ l.number ?? '—' }}</a>
                    </td>
                    <td class="px-4 py-3">{{ l.supplier?.name ?? '—' }}</td>
                    <td class="px-4 py-3">{{ l.warehouse?.name ?? '—' }}</td>
                    <td class="px-4 py-3">{{ l.quantity }}</td>
                    <td class="whitespace-nowrap px-4 py-3 font-semibold">{{ l.unitCost | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                    <td class="whitespace-nowrap px-4 py-3">{{ l.total | currency: 'EGP' : 'symbol' : '1.0-2' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </section>
  `,
})
export class ProductPurchasesComponent {
  private readonly inventory = inject(InventoryService);
  private readonly products = inject(ProductService);
  private readonly currency = new CurrencyPipe(inject(LOCALE_ID));

  /** Route param, bound via withComponentInputBinding. */
  readonly id = input.required<string>();

  protected readonly unitLabels = PRODUCT_UNIT_LABELS;

  protected readonly product = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.products.getProduct(params),
  });

  protected readonly movements = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.inventory.getMovements({ type: MovementType.RECEIVE, productId: params }),
  });

  protected readonly history = computed(() => purchaseHistory(this.movements.value() ?? [], this.id()));

  protected money(v: number | null | undefined): string {
    return v == null ? '—' : (this.currency.transform(v, 'EGP', 'symbol', '1.0-2') ?? '—');
  }
}
