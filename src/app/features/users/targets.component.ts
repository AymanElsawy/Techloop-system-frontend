import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';

import { httpErrorMessage } from '../../core/http/http-error';
import { StatusMessageComponent } from '../../shared/components/status-message/status-message.component';
import { TargetPeriod, TargetRow, UserService } from './user.service';

const thisMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7); // YYYY-MM

/** التارجت والعمولات: each rep's monthly / yearly targets, progress and commission (managers only). */
@Component({
  selector: 'app-targets',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, StatusMessageComponent],
  templateUrl: './targets.component.html',
})
export class TargetsComponent {
  private readonly userService = inject(UserService);

  protected readonly yearly = signal(false);
  protected readonly month = signal(thisMonth());
  protected readonly year = signal(thisMonth().slice(0, 4));
  /** This year and the 4 before it. */
  protected readonly years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));
  protected readonly period = computed<TargetPeriod>(() =>
    this.yearly() ? { year: this.year() } : { month: this.month() },
  );
  protected readonly report = rxResource({
    params: () => this.period(),
    stream: ({ params }) => this.userService.getTargets(params),
  });
  protected readonly totalCommission = computed(() =>
    (this.report.value()?.reps ?? []).reduce((s, r) => s + r.commission, 0),
  );

  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly feedback = signal<{ ok: boolean; message: string } | null>(null);
  protected readonly form = new FormGroup({
    salesTarget: new FormControl<number | null>(null, Validators.min(0)),
    collectionTarget: new FormControl<number | null>(null, Validators.min(0)),
    yearlySalesTarget: new FormControl<number | null>(null, Validators.min(0)),
    yearlyCollectionTarget: new FormControl<number | null>(null, Validators.min(0)),
    salesCommissionRate: new FormControl<number | null>(0, [Validators.min(0), Validators.max(100)]),
    collectionCommissionRate: new FormControl<number | null>(0, [Validators.min(0), Validators.max(100)]),
  });

  /** /targets/print query: the period, plus the rep for a single-rep report. */
  protected printParams(rep?: string): Record<string, string> {
    return { ...this.period(), ...(rep && { rep }) };
  }

  protected setMonth(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) this.month.set(value);
  }

  protected edit(rep: TargetRow): void {
    this.feedback.set(null);
    this.form.reset({
      salesTarget: rep.salesTarget,
      collectionTarget: rep.collectionTarget,
      yearlySalesTarget: rep.yearlySalesTarget,
      yearlyCollectionTarget: rep.yearlyCollectionTarget,
      salesCommissionRate: rep.salesCommissionRate,
      collectionCommissionRate: rep.collectionCommissionRate,
    });
    this.editingId.set(rep.id);
  }

  protected save(event: Event, rep: TargetRow): void {
    event.preventDefault();
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.userService
      .setTargets(rep.id, {
        salesTarget: v.salesTarget || null,
        collectionTarget: v.collectionTarget || null,
        yearlySalesTarget: v.yearlySalesTarget || null,
        yearlyCollectionTarget: v.yearlyCollectionTarget || null,
        salesCommissionRate: v.salesCommissionRate ?? 0,
        collectionCommissionRate: v.collectionCommissionRate ?? 0,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editingId.set(null);
          this.feedback.set({ ok: true, message: `تم حفظ تارجت ${rep.name}.` });
          this.report.reload();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.feedback.set({ ok: false, message: httpErrorMessage(err, 'تعذر حفظ التارجت.') });
        },
      });
  }

  /** Bar colour: reached / halfway / below. */
  protected barClass(progress: number): string {
    if (progress >= 100) return 'bg-yale-blue';
    if (progress >= 50) return 'bg-soft-apricot-300';
    return 'bg-vibrant-coral-400';
  }
}
