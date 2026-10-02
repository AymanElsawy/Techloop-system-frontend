import { Component, inject, input } from '@angular/core';
import { DatePipe } from '../../../shared/date.pipe';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { MOVEMENT_TYPE_CLASSES, MOVEMENT_TYPE_LABELS, MovementType } from '../models/inventory.model';
import { InventoryService } from '../services/inventory.service';

/** /inventory/movements/:id — one stock movement (e.g. what was issued to a rep). Reps get their own only (backend rule). */
@Component({
  selector: 'app-movement-details',
  imports: [DatePipe, RouterLink, StatusMessageComponent],
  template: `
    <section class="space-y-6">
      <a routerLink="/inventory/movements" class="text-sm text-stormy-teal hover:underline">→ سجل الحركات</a>
      @if (movement.isLoading() && !movement.hasValue()) {
        <app-status-message type="loading" message="جاري التحميل..." />
      } @else if (movement.error()) {
        <app-status-message type="error" message="حدث خطأ أثناء التحميل." (retry)="movement.reload()" />
      } @else if (movement.value(); as m) {
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-2xl font-bold">
            {{ typeLabels[m.type] }}
            @if (m.number) {
              <span dir="ltr">#{{ m.number }}</span>
            }
          </h1>
          @if (canPrint && printType[m.type]; as t) {
            <a [routerLink]="['/documents', t, m.id]" class="btn-primary">طباعة / PDF</a>
          }
        </div>
        <dl class="card grid gap-5 sm:grid-cols-4">
          <div>
            <dt class="text-sm text-stormy-teal">الحركة</dt>
            <dd class="mt-1"><span class="rounded-full px-2.5 py-1 text-xs font-medium" [class]="typeClasses[m.type]">{{ typeLabels[m.type] }}</span></dd>
          </div>
          <div>
            <dt class="text-sm text-stormy-teal">المخزن</dt>
            <dd class="mt-1 font-semibold">{{ m.warehouse?.name ?? '—' }}{{ m.toWarehouse ? ' ← ' + m.toWarehouse.name : '' }}</dd>
          </div>
          <div>
            <dt class="text-sm text-stormy-teal">المندوب</dt>
            <dd class="mt-1 font-semibold">{{ m.rep?.name ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-sm text-stormy-teal">التاريخ</dt>
            <dd class="mt-1 font-semibold">{{ m.createdAt | date: 'd MMMM y, h:mm a' }}</dd>
          </div>
          <div>
            <dt class="text-sm text-stormy-teal">سجّلها</dt>
            <dd class="mt-1 font-semibold">{{ m.createdBy?.name ?? '—' }}</dd>
          </div>
          @if (m.notes) {
            <div class="sm:col-span-3">
              <dt class="text-sm text-stormy-teal">ملاحظات</dt>
              <dd class="mt-1">{{ m.notes }}</dd>
            </div>
          }
        </dl>
        <div class="card overflow-x-auto p-0">
          <table class="w-full text-right text-sm">
            <thead class="table-head">
              <tr>
                <th scope="col" class="px-4 py-3 font-semibold">الصنف</th>
                <th scope="col" class="px-4 py-3 font-semibold">الكمية</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stormy-teal-900">
              @for (i of m.items; track i.product) {
                <tr>
                  <td class="px-4 py-3">{{ i.name }}</td>
                  <td class="px-4 py-3 font-semibold tabular-nums" dir="ltr">{{ m.type === 'ADJUST' && i.quantity > 0 ? '+' : '' }}{{ i.quantity }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class MovementDetailsComponent {
  private readonly inventory = inject(InventoryService);

  /** Route param, bound via withComponentInputBinding. */
  readonly id = input.required<string>();

  protected readonly canPrint = !inject(AuthService).hasRole(UserRole.SALES_REP);
  protected readonly printType: Partial<Record<MovementType, string>> = {
    [MovementType.RECEIVE]: 'PURCHASE',
    [MovementType.ISSUE]: 'ISSUE',
    [MovementType.RETURN]: 'RETURN',
  };
  protected readonly typeLabels = MOVEMENT_TYPE_LABELS;
  protected readonly typeClasses = MOVEMENT_TYPE_CLASSES;

  protected readonly movement = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.inventory.getMovement(params),
  });
}
