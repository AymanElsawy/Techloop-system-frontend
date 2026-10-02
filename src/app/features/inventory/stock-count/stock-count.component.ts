import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';

import { httpErrorMessage } from '../../../core/http/http-error';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { ProductService } from '../../products/services/product.service';
import { InventoryService } from '../services/inventory.service';

interface Line {
  productId: string;
  name: string;
  system: number;
  counted: number;
}

/**
 * /inventory/warehouses/:id/count — جرد (managers). Every product in the warehouse with its system quantity;
 * the manager types what was actually counted, and only the differences are saved (with a reason).
 */
@Component({
  selector: 'app-stock-count',
  imports: [RouterLink, StatusMessageComponent],
  template: `
    <section class="mx-auto max-w-3xl space-y-6">
      <a [routerLink]="['/inventory/warehouses', id()]" class="text-sm text-stormy-teal hover:underline">→ العودة إلى المخزن</a>
      <div>
        <h1 class="text-2xl font-bold">جرد {{ details.value()?.warehouse?.name ?? '' }}</h1>
        <p class="mt-1 text-stormy-teal">اكتب الكمية الفعلية اللي اتعدّت. الفرق (عجز أو زيادة) بيتسجل كحركة "تسوية جرد" والرصيد بيتظبط عليه.</p>
      </div>

      @if (details.isLoading() && !details.hasValue()) {
        <app-status-message type="loading" message="جاري التحميل..." />
      } @else if (details.error() || products.error()) {
        <app-status-message type="error" message="حدث خطأ أثناء التحميل." (retry)="details.reload(); products.reload()" />
      } @else {
        <div class="card overflow-x-auto p-0">
          <table class="w-full text-right text-sm">
            <thead class="table-head">
              <tr>
                <th scope="col" class="px-4 py-3 font-semibold">الصنف</th>
                <th scope="col" class="px-4 py-3 font-semibold">في السيستم</th>
                <th scope="col" class="px-4 py-3 font-semibold">الفعلي</th>
                <th scope="col" class="px-4 py-3 font-semibold">الفرق</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stormy-teal-900">
              @for (l of lines(); track l.productId; let i = $index) {
                <tr>
                  <td class="px-4 py-3 font-semibold">{{ l.name }}</td>
                  <td class="px-4 py-3 tabular-nums">{{ l.system }}</td>
                  <td class="px-4 py-2">
                    <input type="number" min="0" step="1" inputmode="numeric" class="form-input w-28" dir="ltr" [attr.aria-label]="'الفعلي ' + l.name"
                      [value]="l.counted" (input)="setCounted(i, $any($event.target).value)" />
                  </td>
                  <td class="px-4 py-3 font-semibold tabular-nums" [class.text-vibrant-coral-400]="l.counted < l.system" [class.text-yale-blue-500]="l.counted > l.system">
                    {{ l.counted === l.system ? '—' : (l.counted > l.system ? '+' : '') + (l.counted - l.system) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="card flex flex-wrap items-end gap-3">
          <div class="min-w-48 flex-1">
            <label for="add-product" class="form-label">صنف مش ظاهر (رصيده صفر)</label>
            <select id="add-product" class="form-input" #pick>
              <option value="">اختر الصنف</option>
              @for (p of missingProducts(); track p.id) {
                <option [value]="p.id">{{ p.name }}</option>
              }
            </select>
          </div>
          <button type="button" class="btn-outline" (click)="addProduct(pick.value); pick.value = ''">+ إضافة</button>
        </div>

        <div class="card space-y-3">
          <div>
            <label for="reason" class="form-label">السبب *</label>
            <input id="reason" class="form-input" placeholder="مثلًا: جرد آخر الشهر، كسر، تالف" [value]="reason()" (input)="reason.set($any($event.target).value)" />
          </div>
          <p class="text-sm text-stormy-teal">{{ changed().length }} صنف فيه فرق.</p>
          @if (error()) {
            <p role="alert" class="rounded-lg bg-vibrant-coral-900 px-3 py-2 text-sm text-vibrant-coral-300">{{ error() }}</p>
          }
          <button type="button" class="btn-primary w-full" [disabled]="!changed().length || reason().trim().length < 3 || saving()" (click)="save()">
            {{ saving() ? 'جاري الحفظ...' : 'حفظ التسوية' }}
          </button>
        </div>
      }
    </section>
  `,
})
export class StockCountComponent {
  private readonly inventory = inject(InventoryService);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);

  readonly id = input.required<string>();

  protected readonly details = rxResource({ params: () => this.id(), stream: ({ params }) => this.inventory.getWarehouse(params) });
  protected readonly products = rxResource({ stream: () => this.productService.getProducts({ active: true }) });

  protected readonly lines = signal<Line[]>([]);
  protected readonly reason = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly changed = computed(() => this.lines().filter((l) => l.counted !== l.system));
  protected readonly missingProducts = computed(() => {
    const listed = new Set(this.lines().map((l) => l.productId));
    return (this.products.value() ?? []).filter((p) => !listed.has(p.id));
  });

  constructor() {
    effect(() => {
      const d = this.details.value();
      if (d) this.lines.set(d.stock.map((s) => ({ productId: s.product.id, name: s.product.name, system: s.quantity, counted: s.quantity })));
    });
  }

  protected setCounted(index: number, raw: string): void {
    const counted = Math.max(Math.floor(Number(raw) || 0), 0);
    this.lines.update((list) => list.map((l, i) => (i === index ? { ...l, counted } : l)));
  }

  protected addProduct(productId: string): void {
    const p = this.products.value()?.find((x) => x.id === productId);
    if (p) this.lines.update((list) => [...list, { productId: p.id, name: p.name, system: 0, counted: 0 }]);
  }

  protected save(): void {
    this.saving.set(true);
    this.error.set(null);
    this.inventory
      .adjust(this.id(), {
        items: this.changed().map((l) => ({ productId: l.productId, counted: l.counted })),
        reason: this.reason().trim(),
      })
      .subscribe({
        next: () => this.router.navigate(['/inventory/warehouses', this.id()]),
        error: (err: unknown) => {
          this.saving.set(false);
          this.details.reload(); // someone may have sold meanwhile
          this.error.set(httpErrorMessage(err, 'تعذر حفظ التسوية. الرصيد اتغير، راجع الأرقام وحاول تاني.'));
        },
      });
  }
}
