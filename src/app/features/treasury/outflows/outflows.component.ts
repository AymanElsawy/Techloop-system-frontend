import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { DatePipe } from '../../../shared/date.pipe';
import { rxResource } from '@angular/core/rxjs-interop';

import { httpErrorMessage } from '../../../core/http/http-error';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { pagedResource } from '../../../shared/paged';
import { PaymentMethod } from '../../invoices/models/invoice.model';
import {
  BUCKET_LABELS,
  ChequeStatus,
  ENTRY_TYPE_LABELS,
  EXPENSE_CATEGORIES,
  OUTFLOW_TYPES,
  Payment,
  TreasuryEntry,
  TreasuryEntryType,
  TreasurySummary,
} from '../models/treasury.model';
import { TreasuryService } from '../services/treasury.service';
import { PaymentsTableComponent } from '../payments-table/payments-table.component';
import { CancelDialogComponent } from '../cancel-dialog/cancel-dialog.component';

/** Managers: take money out of the treasury (expense / withdrawal / bank deposit) and settle cheques. */
@Component({
  selector: 'app-treasury-outflows',
  imports: [CancelDialogComponent, CurrencyPipe, DatePipe, PagerComponent, PaymentsTableComponent, StatusMessageComponent],
  template: `
    <details class="accordion">
      <summary><h2 class="font-semibold">صرف من الخزنة <span class="text-sm font-normal text-stormy-teal">· مصروف، سحب، إيداع في البنك</span></h2></summary>
      <div class="space-y-4 p-4">
        <div class="flex flex-wrap gap-2">
          @for (t of types; track t) {
            <button type="button" [class]="type() === t ? 'btn-primary' : 'btn-outline'" (click)="open(t)">{{ typeLabels[t] }}</button>
          }
        </div>
        @if (type(); as t) {
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label for="entry-amount" class="form-label">المبلغ *</label>
              <input id="entry-amount" type="number" min="0.01" step="0.01" inputmode="decimal" class="form-input" dir="ltr"
                     [value]="amount() || ''" (input)="amount.set(+$any($event.target).value)" />
              <p class="mt-1 text-xs text-stormy-teal">الرصيد الحالي: {{ available() | currency: 'EGP' : 'symbol' : '1.0-2' }}</p>
            </div>
            <div>
              <label for="entry-method" class="form-label">{{ t === Type.BANK_DEPOSIT ? 'من' : 'اتدفع من' }} *</label>
              <select id="entry-method" class="form-input" [value]="method()" (change)="method.set($any($event.target).value)">
                @for (m of methods(); track m) {
                  <option [value]="m">{{ bucketLabels[m] }}</option>
                }
              </select>
            </div>
            @if (t === Type.EXPENSE) {
              <div>
                <label for="entry-category" class="form-label">نوع المصروف</label>
                <input id="entry-category" class="form-input" list="expense-categories" [value]="category()" (input)="category.set($any($event.target).value)" />
                <datalist id="expense-categories">
                  @for (c of categories; track c) {
                    <option [value]="c"></option>
                  }
                </datalist>
              </div>
            }
            <div [class.sm:col-span-2]="t !== Type.EXPENSE">
              <label for="entry-notes" class="form-label">ملاحظات</label>
              <input id="entry-notes" class="form-input" [value]="notes()" (input)="notes.set($any($event.target).value)" />
            </div>
          </div>
          @if (error()) {
            <p role="alert" class="rounded-lg bg-vibrant-coral-900 px-3 py-2 text-sm text-vibrant-coral-300">{{ error() }}</p>
          }
          <div class="flex gap-2">
            <button type="button" class="btn-primary" [disabled]="!valid() || saving()" (click)="save()">
              {{ saving() ? 'جاري الحفظ...' : 'حفظ ' + typeLabels[t] }}
            </button>
            <button type="button" class="btn-outline" (click)="type.set(null)">إلغاء</button>
          </div>
        }
      </div>
    </details>

    <details class="accordion">
      <summary><h2 class="font-semibold">شيكات في الخزنة <span class="text-sm font-normal text-stormy-teal">· {{ cheques.value()?.length ?? 0 }}</span></h2></summary>
      <p class="px-4 pt-3 text-sm text-stormy-teal">"اتصرف" بينقل الشيك للبنك. "مرتد" بيطلّعه من الخزنة ويرجّع مبلغه على مديونية العميل.</p>
      @if (cheques.error()) {
        <app-status-message class="m-4 block" type="error" message="حدث خطأ أثناء تحميل الشيكات." (retry)="cheques.reload()" />
      } @else if (cheques.value()?.length) {
        <app-payments-table [payments]="cheques.value()!" [showRep]="true" [chequeActions]="true" (chequeAction)="setCheque($event)" />
      } @else if (cheques.hasValue()) {
        <p class="px-4 py-6 text-center text-sm text-stormy-teal">مفيش شيكات في الخزنة.</p>
      }
    </details>

    <dialog #chequeDialog aria-labelledby="cheque-dialog-title" (close)="pendingCheque.set(null)"
      class="card m-auto w-[min(26rem,calc(100%-2rem))] space-y-3 text-inherit backdrop:bg-black/60">
      @if (pendingCheque(); as c) {
        <h2 id="cheque-dialog-title" class="text-lg font-bold">{{ c.status === Cheque.BOUNCED ? 'شيك مرتد' : 'صرف شيك' }}</h2>
        <p>
          الشيك <span dir="ltr">{{ c.payment.chequeNumber ?? c.payment.number }}</span> بـ
          <span class="font-semibold">{{ c.payment.amount | currency: 'EGP' : 'symbol' : '1.0-2' }}</span>
          {{ c.status === Cheque.BOUNCED ? 'مرتد؟' : 'اتصرف؟' }}
        </p>
        <p class="text-sm text-stormy-teal">{{ c.status === Cheque.BOUNCED ? 'مبلغه هيرجع على مديونية العميل.' : 'هيتنقل للبنك.' }}</p>
        @if (chequeError(); as err) {
          <p class="text-sm text-vibrant-coral-300" role="alert">{{ err }}</p>
        }
        <div class="flex gap-2">
          <button type="button" class="btn-primary flex-1" [disabled]="chequeSaving()" (click)="confirmCheque()">
            {{ chequeSaving() ? 'جارٍ الحفظ...' : 'تأكيد' }}
          </button>
          <button type="button" class="btn-outline flex-1" (click)="chequeDialog.close()">إلغاء</button>
        </div>
      }
    </dialog>

    <details class="accordion">
      <summary><h2 class="font-semibold">حركات الصرف <span class="text-sm font-normal text-stormy-teal">· {{ entries.value()?.total ?? 0 }}</span></h2></summary>
      @if (entries.resource.error()) {
        <app-status-message class="m-4 block" type="error" message="حدث خطأ أثناء تحميل الحركات." (retry)="entries.resource.reload()" />
      } @else if (entries.value()?.total) {
        <app-pager [(page)]="entries.page" [(limit)]="entries.limit" [total]="entries.value()!.total" [loading]="entries.resource.isLoading()">
          <table class="w-full text-right text-sm">
            <thead class="table-head">
              <tr>
                <th scope="col" class="px-4 py-3 font-semibold">#</th>
                <th scope="col" class="px-4 py-3 font-semibold">التاريخ</th>
                <th scope="col" class="px-4 py-3 font-semibold">النوع</th>
                <th scope="col" class="px-4 py-3 font-semibold">من</th>
                <th scope="col" class="px-4 py-3 font-semibold">المبلغ</th>
                <th scope="col" class="px-4 py-3 font-semibold">بواسطة</th>
                <th scope="col" class="px-4 py-3 font-semibold"><span class="sr-only">إجراء</span></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stormy-teal-900">
              @for (e of entries.value()!.items; track e.id) {
                <tr [class.opacity-60]="e.status === 'CANCELLED'">
                  <td class="px-4 py-3">{{ e.number }}</td>
                  <td class="whitespace-nowrap px-4 py-3">{{ e.createdAt | date: 'd MMM y, h:mm a' }}</td>
                  <td class="px-4 py-3">
                    {{ e.rep ? 'مصروف مندوب' : typeLabels[e.type] }}{{ e.category ? ' · ' + e.category : '' }}
                    @if (e.status === 'ACTIVE' && e.depositStatus === 'PENDING') {
                      <span class="ms-1 rounded-full bg-soft-apricot-800 px-2 py-0.5 text-xs font-medium text-soft-apricot-200">مع المندوب</span>
                    }
                    @if (e.status === 'CANCELLED') {
                      <span class="ms-1 rounded-full bg-vibrant-coral-900 px-2 py-0.5 text-xs font-medium text-vibrant-coral-300">ملغاة</span>
                    }
                    @if (e.counted != null) {
                      <p class="text-xs text-stormy-teal">اتعدّ {{ e.counted | currency: 'EGP' : 'symbol' : '1.0-2' }}</p>
                    }
                    @if (e.notes || e.cancelReason) {
                      <p class="text-xs text-stormy-teal">{{ e.cancelReason ? 'سبب الإلغاء: ' + e.cancelReason : e.notes }}</p>
                    }
                  </td>
                  <td class="px-4 py-3">{{ bucketLabels[e.paymentMethod] }}</td>
                  <td class="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                    <!-- An adjustment is signed (+ adds money); everything else here takes money out. -->
                    {{ e.type === Type.ADJUSTMENT && e.amount > 0 ? '+' : '' }}{{ e.amount | currency: 'EGP' : 'symbol' : '1.0-2' }}
                  </td>
                  <td class="px-4 py-3">{{ e.createdBy.name }}</td>
                  <td class="px-4 py-3">
                    @if (e.status === 'ACTIVE') {
                      <button type="button" class="text-xs text-stormy-teal hover:underline" (click)="cancel(e)">إلغاء</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </app-pager>
      } @else if (entries.value()) {
        <p class="px-4 py-6 text-center text-sm text-stormy-teal">لا يوجد صرف بعد.</p>
      }
    </details>

    <app-cancel-dialog />
  `,
  host: { class: 'block space-y-6' },
})
export class TreasuryOutflowsComponent {
  private readonly treasury = inject(TreasuryService);

  readonly summary = input.required<TreasurySummary>();
  /** The balance changed; the parent reloads the summary. */
  readonly changed = output<void>();

  protected readonly Type = TreasuryEntryType;
  protected readonly types = OUTFLOW_TYPES;
  protected readonly typeLabels = ENTRY_TYPE_LABELS;
  protected readonly bucketLabels = BUCKET_LABELS;
  protected readonly categories = EXPENSE_CATEGORIES;

  protected readonly entries = pagedResource(() => ({}), (params) => this.treasury.getEntriesPage(params));
  protected readonly cheques = rxResource({ stream: () => this.treasury.getCheques() });

  protected readonly Cheque = ChequeStatus;
  private readonly cancelDialog = viewChild.required(CancelDialogComponent);
  private readonly chequeDialog = viewChild.required<ElementRef<HTMLDialogElement>>('chequeDialog');
  protected readonly pendingCheque = signal<{ payment: Payment; status: ChequeStatus } | null>(null);
  protected readonly chequeSaving = signal(false);
  protected readonly chequeError = signal<string | null>(null);

  protected readonly type = signal<TreasuryEntryType | null>(null);
  protected readonly amount = signal(0);
  protected readonly method = signal<PaymentMethod>(PaymentMethod.CASH);
  protected readonly category = signal('');
  protected readonly notes = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /**
   * Any money bucket, even at zero or below. Never cheques: they move only by "اتصرف" / "مرتد".
   * Money already in the bank can't be deposited again.
   */
  protected readonly methods = computed(() =>
    Object.values(PaymentMethod).filter(
      (m) =>
        m !== PaymentMethod.CHEQUE &&
        (this.type() !== TreasuryEntryType.BANK_DEPOSIT || m !== PaymentMethod.BANK_TRANSFER),
    ),
  );
  protected readonly available = computed(
    () => this.summary().byMethod.find((m) => m.method === this.method())?.total ?? 0,
  );
  protected readonly valid = computed(() => this.amount() > 0);

  /** After a count (جرد) made outside this section. */
  reloadEntries(): void {
    this.entries.resource.reload();
  }

  protected open(type: TreasuryEntryType): void {
    this.type.set(type);
    this.amount.set(0);
    this.category.set('');
    this.notes.set('');
    this.error.set(null);
    this.method.set(PaymentMethod.CASH);
  }

  protected save(): void {
    const type = this.type();
    if (!type || !this.valid() || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.treasury
      .createEntry({
        type,
        amount: this.amount(),
        paymentMethod: this.method(),
        category: this.category().trim() || null,
        notes: this.notes().trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.type.set(null);
          this.entries.resource.reload();
          this.changed.emit();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.error.set(httpErrorMessage(err, 'تعذر الحفظ. حاول مرة أخرى.'));
        },
      });
  }

  protected cancel(entry: TreasuryEntry): void {
    this.cancelDialog().open(
      `إلغاء ${entry.rep ? 'مصروف مندوب' : ENTRY_TYPE_LABELS[entry.type]} #${entry.number}`,
      (reason) => this.treasury.cancelEntry(entry.id, reason),
      () => {
        this.entries.resource.reload();
        this.changed.emit();
      },
    );
  }

  protected setCheque(pending: { payment: Payment; status: ChequeStatus }): void {
    this.pendingCheque.set(pending);
    this.chequeError.set(null);
    this.chequeDialog().nativeElement.showModal();
  }

  protected confirmCheque(): void {
    const pending = this.pendingCheque();
    if (!pending || this.chequeSaving()) return;
    this.chequeSaving.set(true);
    this.treasury.setChequeStatus(pending.payment, pending.status).subscribe({
      next: () => {
        this.chequeSaving.set(false);
        this.chequeDialog().nativeElement.close();
        this.cheques.reload();
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.chequeSaving.set(false);
        this.chequeError.set(httpErrorMessage(err, 'تعذر تحديث الشيك. حدّث الصفحة وحاول مرة أخرى.'));
      },
    });
  }
}
