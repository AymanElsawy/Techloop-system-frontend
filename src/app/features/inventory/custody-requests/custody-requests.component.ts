import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin, map, of } from 'rxjs';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { httpErrorMessage } from '../../../core/http/http-error';
import { DatePipe } from '../../../shared/date.pipe';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { InventoryTabsComponent } from '../inventory-tabs/inventory-tabs.component';
import { CUSTODY_REQUEST_STATUS_LABELS, CustodyRequest, CustodyRequestStatus, quantityMap, warehouseLabel } from '../models/inventory.model';
import { InventoryService } from '../services/inventory.service';

const STATUS_CLASSES: Record<CustodyRequestStatus, string> = {
  PENDING: 'bg-soft-apricot-800 text-soft-apricot-200',
  ISSUED: 'bg-stormy-teal-900 text-stormy-teal',
  REJECTED: 'bg-vibrant-coral-900 text-vibrant-coral-300',
  CANCELLED: 'bg-alabaster-grey-400 text-alabaster-grey-100',
};

/**
 * /inventory/requests — طلبات العهدة. A sales rep asks their warehouse for goods and follows their requests;
 * the warehouse rep (their warehouse) and managers (all) issue them, with quantities they can lower, or reject.
 */
@Component({
  selector: 'app-custody-requests',
  imports: [DatePipe, InventoryTabsComponent, RouterLink, StatusMessageComponent],
  template: `
    <section class="space-y-6">
      <h1 class="text-2xl font-bold">المخزن</h1>
      <app-inventory-tabs />

      @if (isRep) {
        <!-- New request: products from the rep's warehouse, with what's available now. -->
        <div class="card space-y-4">
          <h2 class="font-semibold">طلب عهدة جديد</h2>
          @if (myStock.value(); as s) {
            @if (!s.warehouse) {
              <p class="text-sm text-soft-apricot-300">لم يتم ربطك بمخزن بعد. تواصل مع الإدارة.</p>
            } @else if (!s.warehouseStock.length) {
              <p class="text-sm text-stormy-teal">{{ warehouseLabel(s.warehouse.name) }} فاضي دلوقتي.</p>
            } @else {
              <p class="text-sm text-stormy-teal">من {{ warehouseLabel(s.warehouse.name) }}. مندوب المخزن هيصرف الطلب أو يعدّل الكميات.</p>
              @for (line of lines(); track $index; let i = $index) {
                <div class="grid gap-3 sm:grid-cols-12 sm:items-end">
                  <div class="sm:col-span-7">
                    <label [for]="'req-product-' + i" class="form-label">الصنف</label>
                    <select [id]="'req-product-' + i" class="form-input" [value]="line.productId" (change)="setLine(i, { productId: $any($event.target).value })">
                      <option value="" disabled>اختر الصنف</option>
                      @for (r of s.warehouseStock; track r.product.id) {
                        @if (r.product.id === line.productId || !taken(r.product.id)) {
                          <option [value]="r.product.id">{{ r.product.name }} — المتاح {{ r.quantity }}</option>
                        }
                      }
                    </select>
                  </div>
                  <div class="sm:col-span-3">
                    <label [for]="'req-qty-' + i" class="form-label">الكمية</label>
                    <input [id]="'req-qty-' + i" type="number" min="1" step="1" class="form-input" [value]="line.quantity" (input)="setLine(i, { quantity: +$any($event.target).value })" />
                  </div>
                  <div class="sm:col-span-2">
                    @if (lines().length > 1) {
                      <button type="button" class="btn-outline w-full" (click)="removeLine(i)">حذف</button>
                    }
                  </div>
                </div>
              }
              <div class="flex flex-wrap items-end gap-3">
                <button type="button" class="btn-outline" (click)="addLine()">إضافة صنف</button>
                <div class="min-w-48 flex-1">
                  <label for="req-notes" class="form-label">ملاحظات</label>
                  <input id="req-notes" class="form-input" placeholder="مثلاً: لزيارات بكرة" [value]="notes()" (input)="notes.set($any($event.target).value)" />
                </div>
                <button type="button" class="btn-primary" [disabled]="!canSend() || saving()" (click)="send()">
                  {{ saving() ? 'جاري الإرسال...' : 'إرسال الطلب' }}
                </button>
              </div>
            }
          } @else if (myStock.error()) {
            <app-status-message type="error" message="حدث خطأ أثناء تحميل المخزن." (retry)="myStock.reload()" />
          }
          @if (formError(); as e) {
            <p role="alert" class="form-error">{{ e }}</p>
          }
        </div>
      }

      <div class="flex flex-wrap gap-2" role="group" aria-label="الحالة">
        <button type="button" class="btn" [class]="status() === '' ? 'btn-primary' : 'btn-outline'" (click)="status.set('')">الكل</button>
        @for (s of statuses; track s) {
          <button type="button" class="btn" [class]="status() === s ? 'btn-primary' : 'btn-outline'" (click)="status.set(s)">{{ statusLabels[s] }}</button>
        }
      </div>

      @if (requests.isLoading() && !requests.hasValue()) {
        <app-status-message type="loading" message="جاري تحميل الطلبات..." />
      } @else if (requests.error()) {
        <app-status-message type="error" message="حدث خطأ أثناء تحميل الطلبات." (retry)="requests.reload()" />
      } @else if (!requests.value()?.length) {
        <app-status-message type="empty" [message]="isRep ? 'مفيش طلبات لسه.' : 'مفيش طلبات هنا.'" />
      } @else {
        <div class="grid gap-4 lg:grid-cols-2">
          @for (r of requests.value(); track r.id) {
            <article class="card space-y-3">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 class="font-bold">طلب عهدة {{ r.number }}</h2>
                  <p class="text-sm text-stormy-teal">
                    @if (!isRep) {
                      {{ r.rep.name }} ·
                    }
                    {{ warehouseLabel(r.warehouse.name) }} · {{ r.createdAt | date: 'd/M/y h:mm a' }}
                  </p>
                </div>
                <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="statusClasses[r.status]">{{ statusLabels[r.status] }}</span>
              </div>

              <table class="w-full text-right text-sm">
                <thead class="table-head">
                  <tr>
                    <th scope="col" class="px-3 py-2 font-semibold">الصنف</th>
                    <th scope="col" class="px-3 py-2 font-semibold">المطلوب</th>
                    @if (canIssue(r)) {
                      <th scope="col" class="px-3 py-2 font-semibold">المتاح</th>
                      <th scope="col" class="px-3 py-2 font-semibold">هيتصرف</th>
                    }
                  </tr>
                </thead>
                <tbody class="divide-y divide-stormy-teal-900">
                  @for (item of r.items; track item.product) {
                    <tr>
                      <td class="px-3 py-2">{{ item.name }}</td>
                      <td class="px-3 py-2 tabular-nums">{{ item.quantity }}</td>
                      @if (canIssue(r)) {
                        <td class="px-3 py-2 tabular-nums" [class.text-vibrant-coral-400]="available(r, item.product) < issueQty(r, item.product, item.quantity)">{{ available(r, item.product) }}</td>
                        <td class="px-3 py-2">
                          <input type="number" min="0" step="1" class="form-input w-24" [attr.aria-label]="'الكمية اللي هتتصرف من ' + item.name"
                            [value]="issueQty(r, item.product, item.quantity)" (input)="setIssueQty(r.id, item.product, +$any($event.target).value)" />
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>

              @if (r.notes) {
                <p class="text-sm">ملاحظات: {{ r.notes }}</p>
              }
              @if (r.status === 'ISSUED' && r.movement) {
                <p class="text-sm text-stormy-teal">
                  اتصرف بواسطة {{ r.handledBy?.name }} ·
                  <a [routerLink]="['/inventory/movements', r.movement.id]" class="font-semibold hover:underline">إذن صرف {{ r.movement.number }}</a>
                </p>
              }
              @if (r.status === 'REJECTED') {
                <p class="text-sm text-vibrant-coral-400">رفضه {{ r.handledBy?.name }}: {{ r.reason }}</p>
              }

              @if (r.status === 'PENDING') {
                @if (busy() === r.id) {
                  <p class="text-sm text-stormy-teal">جاري الحفظ...</p>
                } @else if (rejecting() === r.id) {
                  <div class="flex flex-wrap items-end gap-2">
                    <div class="min-w-48 flex-1">
                      <label [for]="'reason-' + r.id" class="form-label">سبب الرفض</label>
                      <input [id]="'reason-' + r.id" class="form-input" [value]="reason()" (input)="reason.set($any($event.target).value)" />
                    </div>
                    <button type="button" class="btn-primary" [disabled]="reason().trim().length < 3" (click)="reject(r)">تأكيد الرفض</button>
                    <button type="button" class="btn-outline" (click)="rejecting.set(null)">رجوع</button>
                  </div>
                } @else if (canIssue(r)) {
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="btn-primary" [disabled]="!issueItems(r).length" (click)="issue(r)">صرف للمندوب</button>
                    <button type="button" class="btn-outline" (click)="rejecting.set(r.id); reason.set('')">رفض</button>
                  </div>
                } @else if (isRep) {
                  <button type="button" class="btn-outline" (click)="cancel(r)">إلغاء الطلب</button>
                }
              }
              @if (actionError()?.id === r.id) {
                <p role="alert" class="form-error">{{ actionError()!.message }}</p>
              }
            </article>
          }
        </div>
      }
    </section>
  `,
})
export class CustodyRequestsComponent {
  private readonly inventory = inject(InventoryService);
  private readonly auth = inject(AuthService);

  protected readonly isRep = this.auth.hasRole(UserRole.SALES_REP);
  protected readonly warehouseLabel = warehouseLabel;
  protected readonly statusLabels = CUSTODY_REQUEST_STATUS_LABELS;
  protected readonly statusClasses = STATUS_CLASSES;
  protected readonly statuses = Object.keys(CUSTODY_REQUEST_STATUS_LABELS) as CustodyRequestStatus[];

  /** Handlers start on what needs their action; a rep on everything they asked for. */
  protected readonly status = signal<CustodyRequestStatus | ''>(this.isRep ? '' : 'PENDING');
  protected readonly requests = rxResource({
    params: () => ({ status: this.status() }),
    stream: ({ params }) => this.inventory.getRequests(params.status || undefined),
  });

  // ---------- the rep's new request ----------

  protected readonly myStock = rxResource({
    params: () => this.isRep || undefined,
    stream: () => this.inventory.getMyStock(),
  });
  protected readonly lines = signal([{ productId: '', quantity: 1 }]);
  protected readonly notes = signal('');
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly canSend = computed(() =>
    this.lines().every((l) => l.productId && Number.isInteger(l.quantity) && l.quantity > 0),
  );

  protected setLine(i: number, patch: Partial<{ productId: string; quantity: number }>): void {
    this.lines.update((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }
  protected addLine(): void {
    this.lines.update((ls) => [...ls, { productId: '', quantity: 1 }]);
  }
  protected removeLine(i: number): void {
    this.lines.update((ls) => ls.filter((_, j) => j !== i));
  }
  protected taken(productId: string): boolean {
    return this.lines().some((l) => l.productId === productId);
  }

  protected send(): void {
    if (!this.canSend() || this.saving()) return;
    this.saving.set(true);
    this.formError.set(null);
    this.inventory.createRequest({ items: this.lines(), notes: this.notes().trim() || null }).subscribe({
      next: () => {
        this.saving.set(false);
        this.lines.set([{ productId: '', quantity: 1 }]);
        this.notes.set('');
        this.requests.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formError.set(httpErrorMessage(err, 'تعذر إرسال الطلب.'));
      },
    });
  }

  // ---------- issuing (warehouse rep / managers) ----------

  /** Main stock of every warehouse with a pending request, to show what's available. */
  private readonly stock = rxResource({
    params: () => {
      const ids = [...new Set((this.requests.value() ?? []).filter((r) => r.status === 'PENDING').map((r) => r.warehouse.id))];
      return this.isRep || !ids.length ? undefined : ids;
    },
    stream: ({ params }) =>
      params.length
        ? forkJoin(params.map((id) => this.inventory.getWarehouse(id).pipe(map((d) => [id, quantityMap(d.stock)] as const)))).pipe(
            map((pairs) => new Map(pairs)),
          )
        : of(new Map<string, Map<string, number>>()),
  });
  /** `${requestId}:${productId}` -> quantity to issue (default: as requested). */
  private readonly issueQtys = signal<Record<string, number>>({});

  protected canIssue(r: CustodyRequest): boolean {
    return !this.isRep && r.status === 'PENDING';
  }
  protected available(r: CustodyRequest, productId: string): number {
    return this.stock.value()?.get(r.warehouse.id)?.get(productId) ?? 0;
  }
  protected issueQty(r: CustodyRequest, productId: string, requested: number): number {
    return this.issueQtys()[`${r.id}:${productId}`] ?? Math.min(requested, this.available(r, productId));
  }
  protected setIssueQty(requestId: string, productId: string, quantity: number): void {
    this.issueQtys.update((q) => ({ ...q, [`${requestId}:${productId}`]: Math.max(0, Math.floor(quantity) || 0) }));
  }
  /** Lines set to 0 are dropped. */
  protected issueItems(r: CustodyRequest) {
    return r.items
      .map((i) => ({ productId: i.product, quantity: this.issueQty(r, i.product, i.quantity) }))
      .filter((i) => i.quantity > 0);
  }

  protected readonly busy = signal<string | null>(null);
  protected readonly rejecting = signal<string | null>(null);
  protected readonly reason = signal('');
  protected readonly actionError = signal<{ id: string; message: string } | null>(null);

  private act(r: CustodyRequest, request: ReturnType<InventoryService['cancelRequest']>, fallback: string): void {
    this.busy.set(r.id);
    this.actionError.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(null);
        this.rejecting.set(null);
        this.requests.reload();
      },
      error: (err: unknown) => {
        this.busy.set(null);
        this.actionError.set({ id: r.id, message: httpErrorMessage(err, fallback) });
      },
    });
  }

  protected issue(r: CustodyRequest): void {
    this.act(r, this.inventory.issueRequest(r.id, this.issueItems(r)), 'تعذر الصرف.');
  }
  protected reject(r: CustodyRequest): void {
    this.act(r, this.inventory.rejectRequest(r.id, this.reason().trim()), 'تعذر الرفض.');
  }
  protected cancel(r: CustodyRequest): void {
    this.act(r, this.inventory.cancelRequest(r.id), 'تعذر إلغاء الطلب.');
  }
}
