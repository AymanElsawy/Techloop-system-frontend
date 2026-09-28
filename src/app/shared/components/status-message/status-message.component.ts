import { Component, input, output } from '@angular/core';

/** Loading / error / empty placeholder shared by every API-backed screen. */
@Component({
  selector: 'app-status-message',
  template: `
    <div class="card flex flex-col items-center gap-3 py-10 text-center" [attr.role]="type() === 'error' ? 'alert' : 'status'">
      @switch (type()) {
        @case ('loading') {
          <span class="size-8 animate-spin rounded-full border-4 border-stormy-teal-900 border-t-stormy-teal" aria-hidden="true"></span>
        }
        @case ('error') {
          <span class="text-3xl text-vibrant-coral-400" aria-hidden="true">!</span>
        }
      }
      <p class="text-sm text-stormy-teal-400">{{ message() }}</p>
      @if (type() === 'error') {
        <button type="button" class="btn-outline" (click)="retry.emit()">إعادة المحاولة</button>
      }
    </div>
  `,
})
export class StatusMessageComponent {
  readonly type = input.required<'loading' | 'error' | 'empty'>();
  readonly message = input.required<string>();
  readonly retry = output<void>();
}
