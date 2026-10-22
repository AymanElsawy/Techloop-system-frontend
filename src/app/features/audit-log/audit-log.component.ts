import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import { environment } from '../../../environments/environment';
import { DatePipe } from '../../shared/date.pipe';
import { PagerComponent } from '../../shared/components/pager/pager.component';
import { StatusMessageComponent } from '../../shared/components/status-message/status-message.component';
import { getPage, pagedResource } from '../../shared/paged';

export type AuditAction = 'CREATE' | 'CANCEL' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT';
export type AuditEntity =
  | 'INVOICE'
  | 'COLLECTION'
  | 'RETURN'
  | 'SUPPLIER_RETURN'
  | 'TREASURY_ENTRY'
  | 'SUPPLIER_PAYMENT'
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'PRODUCT'
  | 'USER';

/** One line of سجل العمليات; names, labels and values are snapshots from that moment. */
export interface AuditLog {
  id: string;
  /** `{ id: 'system', name: 'السيستم' }` for the nightly balance check. */
  actor: { id: string; name: string };
  action: AuditAction;
  entity: AuditEntity;
  /** The supplier for SUPPLIER_PAYMENT. */
  docId: string;
  /** Document number, or the customer / product / user name. */
  title: string | null;
  party: string | null;
  amount: number | null;
  reason: string | null;
  changes: { field: string; from: string | null; to: string | null }[];
  createdAt: string;
}

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: 'سجّل',
  CANCEL: 'ألغى',
  UPDATE: 'عدّل',
  DELETE: 'حذف',
  APPROVE: 'اعتمد',
  REJECT: 'رفض',
};

export const AUDIT_ENTITY_LABELS: Record<AuditEntity, string> = {
  INVOICE: 'فاتورة بيع',
  COLLECTION: 'تحصيل',
  RETURN: 'مرتجع',
  SUPPLIER_RETURN: 'مرتجع مورد',
  TREASURY_ENTRY: 'حركة خزنة',
  SUPPLIER_PAYMENT: 'دفعة مورد',
  CUSTOMER: 'عميل',
  SUPPLIER: 'مورد',
  PRODUCT: 'صنف',
  USER: 'مستخدم',
};

function link(a: AuditLog): string[] | null {
  if (a.action === 'DELETE') return null;
  switch (a.entity) {
    case 'INVOICE':
      return ['/invoices', a.docId];
    case 'COLLECTION':
      return ['/collections', a.docId];
    case 'RETURN':
      return ['/returns', a.docId];
    case 'SUPPLIER_RETURN':
      return ['/documents', 'SUPPLIER_RETURN', a.docId];
    case 'TREASURY_ENTRY':
      return ['/treasury'];
    case 'SUPPLIER_PAYMENT':
      return ['/suppliers', a.docId];
    case 'CUSTOMER':
      return ['/customers', a.docId];
    case 'SUPPLIER':
      return ['/suppliers', a.docId];
    case 'PRODUCT':
      return ['/inventory/products', a.docId, 'edit'];
    case 'USER':
      return ['/users'];
  }
}

/** /audit-log — سجل العمليات: who cancelled or edited what. The owner only. */
@Component({
  selector: 'app-audit-log',
  imports: [CurrencyPipe, DatePipe, PagerComponent, RouterLink, StatusMessageComponent],
  template: `
    <section class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold">سجل العمليات</h1>
        <p class="mt-1 text-sm text-stormy-teal">مين ألغى أو عدّل إيه وإمتى، والمرتجعات الجديدة.</p>
      </div>

      <div class="flex flex-wrap gap-2" role="group" aria-label="النوع">
        <button type="button" class="btn" [class]="entity() === '' ? 'btn-primary' : 'btn-outline'" (click)="entity.set('')">الكل</button>
        @for (e of entities; track e) {
          <button type="button" class="btn" [class]="entity() === e ? 'btn-primary' : 'btn-outline'" (click)="entity.set(e)">
            {{ entityLabels[e] }}
          </button>
        }
      </div>

      @if (list.resource.error()) {
        <app-status-message type="error" message="حدث خطأ أثناء تحميل السجل." (retry)="list.resource.reload()" />
      } @else if (list.value(); as page) {
        @if (page.total) {
          <app-pager [(page)]="list.page" [(limit)]="list.limit" [total]="page.total" [loading]="list.resource.isLoading()">
            <ul class="divide-y divide-stormy-teal-900">
              @for (a of page.items; track a.id) {
                <li class="px-4 py-3">
                  <p [class.text-vibrant-coral-400]="a.action === 'CANCEL' || a.action === 'DELETE'">
                    <span class="font-bold">{{ a.actor.name }}</span>
                    {{ actionLabels[a.action] }} {{ entityLabels[a.entity] }}
                    @if (link(a); as to) {
                      <a [routerLink]="to" class="underline">{{ a.title }}</a>
                    } @else {
                      {{ a.title }}
                    }
                  </p>
                  <p class="text-sm text-stormy-teal">
                    @if (a.party) {
                      {{ a.party }} ·
                    }
                    @if (a.amount !== null) {
                      {{ a.amount | currency: 'EGP' : 'symbol' : '1.0-2' }} ·
                    }
                    {{ a.createdAt | date: 'd/M/y h:mm a' }}
                  </p>
                  @if (a.reason) {
                    <p class="text-sm">السبب: {{ a.reason }}</p>
                  }
                  @if (a.changes.length) {
                    <ul class="mt-1 space-y-0.5 text-sm">
                      @for (c of a.changes; track c.field) {
                        <li>
                          {{ c.field }}:
                          @if (c.from === null && c.to === null) {
                            اتغيرت
                          } @else {
                            <span class="text-stormy-teal line-through">{{ c.from ?? '—' }}</span>
                            ←
                            <span class="font-bold">{{ c.to ?? '—' }}</span>
                          }
                        </li>
                      }
                    </ul>
                  }
                </li>
              }
            </ul>
          </app-pager>
        } @else {
          <app-status-message type="empty" message="مفيش عمليات متسجلة لسه." />
        }
      } @else {
        <app-status-message type="loading" message="جاري تحميل السجل..." />
      }
    </section>
  `,
})
export class AuditLogComponent {
  private readonly http = inject(HttpClient);

  protected readonly actionLabels = ACTION_LABELS;
  protected readonly entityLabels = AUDIT_ENTITY_LABELS;
  protected readonly entities = Object.keys(AUDIT_ENTITY_LABELS) as AuditEntity[];
  protected readonly link = link;

  protected readonly entity = signal<AuditEntity | ''>('');
  protected readonly list = pagedResource(
    () => ({ entity: this.entity() }),
    (params) => getPage<AuditLog>(this.http, `${environment.apiUrl}/audit-log`, params),
  );
}
