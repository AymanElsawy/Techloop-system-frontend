import { Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { DatePipe } from '../../shared/date.pipe';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';

import { StatusMessageComponent } from '../../shared/components/status-message/status-message.component';
import { NotificationsService, notificationLink, notificationTitle } from './notifications.service';

/** /notifications — latest changes; opening the page marks them all read. */
@Component({
  selector: 'app-notification-list',
  imports: [CurrencyPipe, DatePipe, RouterLink, StatusMessageComponent],
  template: `
    <section class="space-y-6">
      <h1 class="text-2xl font-bold">الإشعارات</h1>

      @if (list.isLoading() && !list.hasValue()) {
        <app-status-message type="loading" message="جاري تحميل الإشعارات..." />
      } @else if (list.error()) {
        <app-status-message type="error" message="حدث خطأ أثناء تحميل الإشعارات." (retry)="list.reload()" />
      } @else if (list.value(); as items) {
        @if (items.length) {
          <ul class="card divide-y divide-stormy-teal-900 p-0">
            @for (n of items; track n.id) {
              <li>
                <!-- routerLink null = not clickable (CASH_TAKEN) -->
                <a [routerLink]="link(n)" class="flex items-start gap-3 px-4 py-3 transition hover:bg-stormy-teal-900/40" [class.pointer-events-none]="!link(n)">
                  <span class="mt-2 size-2 shrink-0 rounded-full" [class]="n.readAt ? 'bg-transparent' : 'bg-vibrant-coral-400'" aria-hidden="true"></span>
                  <span class="min-w-0 flex-1">
                    <span class="block" [class.font-bold]="!n.readAt" [class.text-vibrant-coral-400]="n.cancelled">
                      {{ title(n) }}
                      @if (!n.readAt) {
                        <span class="sr-only">(جديد)</span>
                      }
                    </span>
                    <span class="block text-sm text-stormy-teal">
                      @if (n.party) {
                        {{ n.party.name }} ·
                      }
                      @if (n.amount !== null) {
                        {{ n.amount | currency: 'EGP' : 'symbol' : '1.0-2' }} ·
                      }
                      @if (n.quantity !== null) {
                        الباقي {{ n.quantity }} ·
                      }
                      @if (n.expiryDate) {
                        الصلاحية {{ n.expiryDate | date: 'd/M/y' }} ·
                      }
                      @if (n.actor) {
                        بواسطة {{ n.actor.name }} ·
                      }
                      {{ n.createdAt | date: 'd/M/y h:mm a' }}
                    </span>
                  </span>
                </a>
              </li>
            }
          </ul>
        } @else {
          <app-status-message type="empty" message="مفيش إشعارات لسه." />
        }
      }
    </section>
  `,
})
export class NotificationListComponent {
  private readonly notifications = inject(NotificationsService);

  protected readonly title = notificationTitle;
  protected readonly link = notificationLink;
  // The list keeps showing what was unread; the server marks everything read once it loads.
  protected readonly list = rxResource({
    stream: () => this.notifications.getNotifications().pipe(tap(() => this.notifications.markAllRead())),
  });
}
