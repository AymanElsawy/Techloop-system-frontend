import { Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { DatePipe } from '../../shared/date.pipe';
import { RouterLink } from '@angular/router';
import { tap } from 'rxjs';

import { PagerComponent } from '../../shared/components/pager/pager.component';
import { StatusMessageComponent } from '../../shared/components/status-message/status-message.component';
import { pagedResource } from '../../shared/paged';
import { BALANCES_FIXED, NotificationsService, notificationLink, notificationTitle } from './notifications.service';

/** /notifications — latest changes; opening the page marks them all read. */
@Component({
  selector: 'app-notification-list',
  imports: [CurrencyPipe, DatePipe, PagerComponent, RouterLink, StatusMessageComponent],
  template: `
    <section class="space-y-6">
      <h1 class="text-2xl font-bold">الإشعارات</h1>

      @if (list.resource.error()) {
        <app-status-message type="error" message="حدث خطأ أثناء تحميل الإشعارات." (retry)="list.resource.reload()" />
      } @else if (list.value(); as page) {
        @if (page.total) {
          <app-pager [(page)]="list.page" [(limit)]="list.limit" [total]="page.total" [loading]="list.resource.isLoading()">
          <ul class="divide-y divide-stormy-teal-900">
            @for (n of page.items; track n.id) {
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
                      @if (n.quantity !== null && n.type !== balancesFixed) {
                        الباقي {{ n.quantity }} ·
                      }
                      @if (n.expiryDate) {
                        الصلاحية {{ n.expiryDate | date: 'd/M/y' }} ·
                      }
                      @if (n.dueDate) {
                        الاستحقاق {{ n.dueDate | date: 'd/M/y' }} ·
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
          </app-pager>
        } @else {
          <app-status-message type="empty" message="مفيش إشعارات لسه." />
        }
      } @else {
        <app-status-message type="loading" message="جاري تحميل الإشعارات..." />
      }
    </section>
  `,
})
export class NotificationListComponent {
  private readonly notifications = inject(NotificationsService);

  protected readonly title = notificationTitle;
  protected readonly balancesFixed = BALANCES_FIXED;
  protected readonly link = notificationLink;
  // The list keeps showing what was unread; the server marks everything read once a page with unread ones loads.
  protected readonly list = pagedResource(
    () => ({}),
    (params) =>
      this.notifications
        .getNotificationsPage(params)
        .pipe(tap(({ items }) => items.some((n) => !n.readAt) && this.notifications.markAllRead())),
  );
}
