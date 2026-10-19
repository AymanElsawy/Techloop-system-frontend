import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { Observable } from 'rxjs';

import { httpErrorMessage } from '../../../core/http/http-error';

/** Cancel-with-reason popup (instead of the browser's prompt/alert). The caller passes the request. */
@Component({
  selector: 'app-cancel-dialog',
  template: `
    <dialog
      #dialog
      aria-labelledby="cancel-dialog-title"
      (close)="run = null"
      class="card m-auto w-[min(26rem,calc(100%-2rem))] space-y-3 text-inherit backdrop:bg-black/60"
    >
      <h2 id="cancel-dialog-title" class="text-lg font-bold">{{ title() }}</h2>
      <div>
        <label for="cancel-reason" class="form-label">سبب الإلغاء *</label>
        <textarea
          id="cancel-reason"
          rows="2"
          class="form-input"
          [value]="reason()"
          (input)="reason.set($any($event.target).value)"
        ></textarea>
        <p class="mt-1 text-xs text-stormy-teal">3 حروف على الأقل. المبلغ هيرجع زي ما كان.</p>
      </div>
      @if (error(); as err) {
        <p class="text-sm text-vibrant-coral-300" role="alert">{{ err }}</p>
      }
      <div class="flex gap-2">
        <button
          type="button"
          class="btn-primary flex-1"
          [disabled]="reason().trim().length < 3 || saving()"
          (click)="submit()"
        >
          {{ saving() ? 'جارٍ الحفظ...' : 'تأكيد الإلغاء' }}
        </button>
        <button type="button" class="btn-outline flex-1" (click)="dialog.close()">رجوع</button>
      </div>
    </dialog>
  `,
})
export class CancelDialogComponent {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly title = signal('');
  protected readonly reason = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected run: ((reason: string) => Observable<unknown>) | null = null;
  private done: () => void = () => undefined;

  open(title: string, run: (reason: string) => Observable<unknown>, done: () => void): void {
    this.title.set(title);
    this.reason.set('');
    this.error.set(null);
    this.run = run;
    this.done = done;
    this.dialog().nativeElement.showModal();
  }

  protected submit(): void {
    const reason = this.reason().trim();
    if (!this.run || reason.length < 3 || this.saving()) return;
    this.saving.set(true);
    this.run(reason).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialog().nativeElement.close();
        this.done();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(httpErrorMessage(err));
      },
    });
  }
}
