import { Component, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response';

/** Copies the fixed public balance link (رابط المديونية) of a customer / supplier, then shows a short toast. */
@Component({
  selector: 'app-share-link',
  template: `
    <button type="button" class="btn-outline" [disabled]="pending()" (click)="copy()">نسخ رابط المديونية</button>
    @if (toast(); as t) {
      <div
        role="status"
        class="fixed inset-x-0 top-4 z-50 mx-auto w-fit rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg"
        [class]="t.error ? 'bg-vibrant-coral-400' : 'bg-stormy-teal'"
      >
        {{ t.message }}
      </div>
    }
  `,
})
export class ShareLinkComponent {
  private readonly http = inject(HttpClient);

  readonly resource = input.required<'customers' | 'suppliers'>();
  readonly id = input.required<string>();

  protected readonly pending = signal(false);
  protected readonly toast = signal<{ message: string; error: boolean } | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  protected copy(): void {
    this.pending.set(true);
    this.http
      .post<ApiResponse<{ token: string }>>(`${environment.apiUrl}/${this.resource()}/${this.id()}/share-link`, {})
      .pipe(map(({ data }) => new URL(`${environment.apiUrl}/public/s/${data.token}`, location.origin).href))
      .subscribe({
        next: (url) =>
          navigator.clipboard.writeText(url).then(
            () => this.show('تم نسخ الرابط', false),
            () => this.show('تعذر النسخ، جرّب تاني', true),
          ),
        error: () => this.show('تعذر إنشاء الرابط، جرّب تاني', true),
      });
  }

  private show(message: string, error: boolean): void {
    this.pending.set(false);
    this.toast.set({ message, error });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.toast.set(null), 2500);
  }
}
