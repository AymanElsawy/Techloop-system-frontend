import { Component, ElementRef, computed, inject, input, model } from '@angular/core';

/**
 * Card around a table (projected) + page numbers and page size under it.
 * While the next page loads the table stays in place, faded, with a spinner over it.
 */
@Component({
  selector: 'app-pager',
  // scroll-mt: room for the sticky top bar when scrolling to the table.
  host: { class: 'block scroll-mt-24' },
  template: `
    <div class="card relative overflow-hidden p-0" [attr.aria-busy]="loading()">
      <div class="overflow-x-auto transition-opacity" [class.opacity-25]="loading()" [attr.inert]="loading() || null">
        <ng-content />
      </div>
      @if (loading()) {
        <!-- Near the top, so it shows right after scrolling to the table's start. -->
        <div class="absolute inset-0 flex justify-center pt-24" role="status">
          <span class="size-10 animate-spin rounded-full border-4 border-stormy-teal-900 border-t-stormy-teal" aria-hidden="true"></span>
          <span class="sr-only">جاري التحميل...</span>
        </div>
      }
    </div>

    <nav class="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="الصفحات">
      <p class="text-stormy-teal">{{ from() }}–{{ to() }} من {{ total() }}</p>

      @if (count() > 1) {
        <div class="flex flex-wrap items-center gap-1">
          <button type="button" class="btn-outline h-9 px-3" [disabled]="page() === 1" (click)="go(page() - 1)">السابق</button>
          @for (p of pages(); track $index) {
            @if (p) {
              <button
                type="button"
                class="h-9 min-w-9 px-2"
                [class]="p === page() ? 'btn-primary' : 'btn-outline'"
                [attr.aria-current]="p === page() ? 'page' : null"
                (click)="go(p)"
              >
                {{ p }}
              </button>
            } @else {
              <span class="px-1 text-stormy-teal" aria-hidden="true">…</span>
            }
          }
          <button type="button" class="btn-outline h-9 px-3" [disabled]="page() === count()" (click)="go(page() + 1)">التالي</button>
        </div>
      }

      <label class="flex items-center gap-2 text-stormy-teal">
        عدد الصفوف
        <select class="form-input w-auto py-1.5" (change)="setLimit(+$any($event.target).value)">
          @for (n of sizes; track n) {
            <option [value]="n" [selected]="n === limit()">{{ n }}</option>
          }
        </select>
      </label>
    </nav>
  `,
})
export class PagerComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly page = model.required<number>();
  readonly limit = model.required<number>();
  readonly total = input.required<number>();
  readonly loading = input(false);

  protected readonly sizes = [10, 20, 50, 100];
  protected readonly count = computed(() => Math.max(1, Math.ceil(this.total() / this.limit())));
  protected readonly from = computed(() => Math.min(this.total(), (this.page() - 1) * this.limit() + 1));
  protected readonly to = computed(() => Math.min(this.total(), this.page() * this.limit()));

  /** 1 … p-1 p p+1 … last; null = gap. */
  protected readonly pages = computed(() => {
    const n = this.count();
    const p = this.page();
    if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
    const out: (number | null)[] = [1];
    if (p > 3) out.push(null);
    for (let i = Math.max(2, p - 1); i <= Math.min(n - 1, p + 1); i++) out.push(i);
    if (p < n - 2) out.push(null);
    out.push(n);
    return out;
  });

  protected go(p: number): void {
    this.page.set(p);
    this.toTop();
  }

  protected setLimit(n: number): void {
    this.limit.set(n);
    this.toTop();
  }

  /** The controls sit under the table: bring the new rows' start into view. */
  private toTop(): void {
    // Instant: a smooth scroll gets cut off while the rows change.
    this.host.nativeElement.scrollIntoView({ block: 'start' });
  }
}
