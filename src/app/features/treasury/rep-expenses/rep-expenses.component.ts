import { Component, inject, input, output, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';

import { httpErrorMessage } from '../../../core/http/http-error';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { DepositStatus, EXPENSE_CATEGORIES, TreasuryEntry } from '../models/treasury.model';
import { TreasuryService } from '../services/treasury.service';

/** A rep's expenses paid from their cash box (بنزين، أكل…): taken off at the next handover. */
@Component({
  selector: 'app-rep-expenses',
  imports: [CurrencyPipe, DatePipe, StatusMessageComponent],
  template: `
    <div class="card space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold">مصروفاتي</h2>
        @if (!open()) {
          <button type="button" class="btn-outline" [disabled]="cash() <= 0" (click)="open.set(true)">+ مصروف</button>
        }
      </div>
      <p class="text-sm text-stormy-teal">من النقدية اللي معاك ({{ cash() | currency: 'EGP' : 'symbol' : '1.0-2' }} متاح). بيتخصم من المبلغ اللي هتسلّمه، والإدارة بتوافق عليه وقت الاستلام.</p>
      @if (open()) {
        <div class="grid gap-3 sm:grid-cols-3">
          <div>
            <label for="exp-amount" class="form-label">المبلغ *</label>
            <input id="exp-amount" type="number" min="0.01" step="0.01" inputmode="decimal" class="form-input" dir="ltr" [value]="amount() || ''" (input)="amount.set(+$any($event.target).value)" />
          </div>
          <div>
            <label for="exp-category" class="form-label">النوع</label>
            <input id="exp-category" class="form-input" list="rep-expense-categories" [value]="category()" (input)="category.set($any($event.target).value)" />
            <datalist id="rep-expense-categories">
              @for (c of categories; track c) {
                <option [value]="c"></option>
              }
            </datalist>
          </div>
          <div>
            <label for="exp-notes" class="form-label">ملاحظات</label>
            <input id="exp-notes" class="form-input" [value]="notes()" (input)="notes.set($any($event.target).value)" />
          </div>
        </div>
        @if (error()) {
          <p role="alert" class="rounded-lg bg-vibrant-coral-900 px-3 py-2 text-sm text-vibrant-coral-300">{{ error() }}</p>
        }
        <div class="flex gap-2">
          <button type="button" class="btn-primary" [disabled]="amount() <= 0 || amount() > cash() || saving()" (click)="save()">{{ saving() ? 'جاري الحفظ...' : 'حفظ المصروف' }}</button>
          <button type="button" class="btn-outline" (click)="open.set(false)">إلغاء</button>
        </div>
      }
      @if (list.error()) {
        <app-status-message type="error" message="حدث خطأ أثناء تحميل المصروفات." (retry)="list.reload()" />
      } @else if (list.value()?.length) {
        <ul class="divide-y divide-stormy-teal-900">
          @for (e of list.value(); track e.id) {
            <li class="flex flex-wrap items-center gap-3 py-2 text-sm" [class.opacity-60]="e.status === 'CANCELLED'">
              <span class="flex-1">
                #{{ e.number }}{{ e.category ? ' · ' + e.category : '' }}
                <span class="text-xs text-stormy-teal">· {{ e.createdAt | date: 'd MMM y' }}</span>
                @if (e.status === 'CANCELLED') {
                  <span class="ms-1 rounded-full bg-vibrant-coral-900 px-2 py-0.5 text-xs text-vibrant-coral-300">ملغي</span>
                } @else if (e.depositStatus === DepositStatus.PENDING) {
                  <span class="ms-1 rounded-full bg-soft-apricot-800 px-2 py-0.5 text-xs text-soft-apricot-200">مستني الاستلام</span>
                } @else if (e.deposit) {
                  <span class="ms-1 rounded-full bg-yale-blue-900 px-2 py-0.5 text-xs text-yale-blue-600">اتقبل · استلام #{{ e.deposit.number }}</span>
                }
              </span>
              <span class="font-semibold tabular-nums">{{ e.amount | currency: 'EGP' : 'symbol' : '1.0-2' }}</span>
              @if (e.status === 'ACTIVE' && e.depositStatus === DepositStatus.PENDING) {
                <button type="button" class="text-xs text-vibrant-coral-400 hover:underline" (click)="cancel(e)">إلغاء</button>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class RepExpensesComponent {
  private readonly treasury = inject(TreasuryService);

  /** Cash the rep still holds (expenses can't go above it). */
  readonly cash = input.required<number>();
  readonly changed = output<void>();

  protected readonly DepositStatus = DepositStatus;
  protected readonly categories = EXPENSE_CATEGORIES;
  protected readonly list = rxResource({ stream: () => this.treasury.getEntries() });

  protected readonly open = signal(false);
  protected readonly amount = signal(0);
  protected readonly category = signal('');
  protected readonly notes = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected save(): void {
    this.saving.set(true);
    this.error.set(null);
    this.treasury
      .createRepExpense({ amount: this.amount(), category: this.category().trim() || null, notes: this.notes().trim() || null })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.open.set(false);
          this.amount.set(0);
          this.category.set('');
          this.notes.set('');
          this.list.reload();
          this.changed.emit();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.error.set(httpErrorMessage(err, 'المبلغ أكبر من النقدية اللي معاك.'));
        },
      });
  }

  protected cancel(e: TreasuryEntry): void {
    const reason = prompt(`سبب إلغاء المصروف #${e.number}:`)?.trim();
    if (!reason || reason.length < 3) return;
    this.treasury.cancelEntry(e.id, reason).subscribe({
      next: () => {
        this.list.reload();
        this.changed.emit();
      },
      error: (err: unknown) => alert(httpErrorMessage(err)),
    });
  }
}
