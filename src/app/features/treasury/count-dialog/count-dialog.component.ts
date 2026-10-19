import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';

import { httpErrorMessage } from '../../../core/http/http-error';
import { PaymentMethod } from '../../invoices/models/invoice.model';
import { BUCKET_LABELS, MONEY_BUCKETS, TreasurySummary } from '../models/treasury.model';
import { TreasuryService } from '../services/treasury.service';

/**
 * جرد: the manager types what is really in a bucket; the difference from the system balance is
 * saved as an adjustment. The first count of a bucket is its opening balance.
 */
@Component({
  selector: 'app-count-dialog',
  imports: [CurrencyPipe],
  template: `
    <dialog
      #dialog
      aria-labelledby="count-dialog-title"
      class="card m-auto w-[min(28rem,calc(100%-2rem))] space-y-3 text-inherit backdrop:bg-black/60"
    >
      <h2 id="count-dialog-title" class="text-lg font-bold">جرد الخزنة</h2>
      <p class="text-sm text-stormy-teal">
        اكتب المبلغ الموجود فعلًا. الفرق بيتسجل "تسوية جرد" والرصيد بيبقى زي اللي اتعدّ.
      </p>
      <div>
        <label for="count-method" class="form-label">الخانة *</label>
        <select
          id="count-method"
          class="form-input"
          [value]="method()"
          (change)="method.set($any($event.target).value)"
        >
          @for (m of buckets; track m) {
            <option [value]="m">{{ bucketLabels[m] }}</option>
          }
        </select>
        <p class="mt-1 text-xs text-stormy-teal">
          رصيد السيستم: {{ balance() | currency: 'EGP' : 'symbol' : '1.0-2' }}
        </p>
      </div>
      <div>
        <label for="count-amount" class="form-label">المبلغ الفعلي *</label>
        <input
          id="count-amount"
          type="number"
          step="0.01"
          inputmode="decimal"
          class="form-input"
          dir="ltr"
          [value]="counted() ?? ''"
          (input)="setCounted($any($event.target).value)"
        />
        @if (diff() !== null) {
          <p class="mt-1 text-sm font-semibold" [class.text-vibrant-coral-400]="diff()! < 0">
            @if (diff() === 0) {
              مطابق، مفيش فرق.
            } @else {
              {{ diff()! > 0 ? 'زيادة' : 'عجز' }}
              {{ abs(diff()!) | currency: 'EGP' : 'symbol' : '1.0-2' }}
            }
          </p>
        }
      </div>
      <div>
        <label for="count-notes" class="form-label">ملاحظات</label>
        <input
          id="count-notes"
          class="form-input"
          [value]="notes()"
          (input)="notes.set($any($event.target).value)"
          placeholder="مثلاً: رصيد افتتاحي"
        />
      </div>
      @if (error(); as err) {
        <p class="text-sm text-vibrant-coral-300" role="alert">{{ err }}</p>
      }
      <div class="flex gap-2">
        <button
          type="button"
          class="btn-primary flex-1"
          [disabled]="counted() === null || saving()"
          (click)="save()"
        >
          {{ saving() ? 'جارٍ الحفظ...' : 'حفظ الجرد' }}
        </button>
        <button type="button" class="btn-outline flex-1" (click)="dialog.close()">إلغاء</button>
      </div>
    </dialog>
  `,
})
export class CountDialogComponent {
  private readonly treasury = inject(TreasuryService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly summary = input.required<TreasurySummary>();
  readonly saved = output<void>();

  protected readonly buckets = MONEY_BUCKETS;
  protected readonly bucketLabels = BUCKET_LABELS;
  protected readonly abs = Math.abs;

  protected readonly method = signal<PaymentMethod>(PaymentMethod.CASH);
  protected readonly counted = signal<number | null>(null);
  protected readonly notes = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly balance = computed(
    () => this.summary().byMethod.find((m) => m.method === this.method())?.total ?? 0,
  );
  protected readonly diff = computed(() => {
    const counted = this.counted();
    return counted === null ? null : Math.round((counted - this.balance()) * 100) / 100;
  });

  open(): void {
    this.method.set(PaymentMethod.CASH);
    this.counted.set(null);
    this.notes.set('');
    this.error.set(null);
    this.dialog().nativeElement.showModal();
  }

  protected setCounted(value: string): void {
    this.counted.set(value === '' || isNaN(+value) ? null : +value);
  }

  protected save(): void {
    const counted = this.counted();
    if (counted === null || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.treasury
      .count({ paymentMethod: this.method(), counted, notes: this.notes().trim() || null })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.dialog().nativeElement.close();
          this.saved.emit();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.error.set(httpErrorMessage(err, 'تعذر حفظ الجرد. حاول مرة أخرى.'));
        },
      });
  }
}
