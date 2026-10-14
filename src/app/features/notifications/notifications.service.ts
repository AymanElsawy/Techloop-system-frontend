import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, Page, PageParams } from '../../core/models/api-response';
import { getPage } from '../../shared/paged';
import { DOCUMENT_TYPE_LABELS, DocumentType, detailsLink } from '../documents/documents.model';

export const SUPPLIER_PAYMENT = 'SUPPLIER_PAYMENT';
export const VISIT = 'VISIT';
/** Stock alerts: no actor, `docId` / `party` is the product. */
export const LOW_STOCK = 'LOW_STOCK';
export const EXPIRY_SOON = 'EXPIRY_SOON';
/** A rep spent from their cash box; `party` is the rep. */
export const REP_EXPENSE = 'REP_EXPENSE';
/** To the rep: management took their cash box. No details, nothing to open. */
export const CASH_TAKEN = 'CASH_TAKEN';
/** To a warehouse rep: stock added to / returned into their warehouse. No details, nothing to open. */
export const STOCK_ADDED = 'STOCK_ADDED';
export const STOCK_RETURNED = 'STOCK_RETURNED';
/** A cheque is due within 2 days, no actor. From a customer: `docId` is the invoice / collection. */
export const CHEQUE_DUE = 'CHEQUE_DUE';
/** A cheque the company wrote is due within 2 days: `docId` / `party` is the supplier. */
export const SUPPLIER_CHEQUE_DUE = 'SUPPLIER_CHEQUE_DUE';
/** To owners: the nightly balance check fixed `quantity` stored balances; details in سجل العمليات. */
export const BALANCES_FIXED = 'BALANCES_FIXED';
/** طلب عهدة: a rep asked for goods (`party` = the rep); CUSTODY_REJECTED tells the rep it was rejected. */
export const CUSTODY_REQUEST = 'CUSTODY_REQUEST';
export const CUSTODY_REJECTED = 'CUSTODY_REJECTED';
export type NotificationType =
  | DocumentType
  | typeof SUPPLIER_PAYMENT
  | typeof VISIT
  | typeof LOW_STOCK
  | typeof EXPIRY_SOON
  | typeof REP_EXPENSE
  | typeof CASH_TAKEN
  | typeof STOCK_ADDED
  | typeof STOCK_RETURNED
  | typeof CHEQUE_DUE
  | typeof SUPPLIER_CHEQUE_DUE
  | typeof BALANCES_FIXED
  | typeof CUSTODY_REQUEST
  | typeof CUSTODY_REJECTED;

type Ref = { id: string; name: string } | null;

export interface AppNotification {
  id: string;
  type: NotificationType;
  cancelled: boolean;
  /** Opened on click; the supplier for SUPPLIER_PAYMENT. */
  docId: string;
  number: string | null;
  /** Null for stock alerts. */
  actor: Ref;
  /** Customer, rep, supplier, or product. */
  party: Ref;
  amount: number | null;
  /** Stock alerts: total left. BALANCES_FIXED: how many were fixed. */
  quantity: number | null;
  /** EXPIRY_SOON. */
  expiryDate: string | null;
  /** Cheque alerts. */
  dueDate: string | null;
  readAt: string | null;
  createdAt: string;
}

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  ...DOCUMENT_TYPE_LABELS,
  [SUPPLIER_PAYMENT]: 'دفعة لمورد',
  [VISIT]: 'زيارة جديدة',
  [LOW_STOCK]: 'صنف وصل لحد الطلب',
  [EXPIRY_SOON]: 'صنف صلاحيته قربت تنتهي',
  [REP_EXPENSE]: 'مصروف مندوب',
  [CASH_TAKEN]: 'الإدارة استلمت الفلوس من خزنتك',
  [STOCK_ADDED]: 'تمت إضافة أصناف لمخزنك',
  [STOCK_RETURNED]: 'تم تسجيل مرتجع في مخزنك',
  [CHEQUE_DUE]: 'شيك ميعاد صرفه قرب',
  [SUPPLIER_CHEQUE_DUE]: 'شيك لمورد ميعاد صرفه قرب',
  [BALANCES_FIXED]: 'مراجعة الأرصدة',
  [CUSTODY_REQUEST]: 'طلب عهدة',
  [CUSTODY_REJECTED]: 'اترفض طلب العهدة',
};

export function notificationTitle(n: AppNotification): string {
  if (n.type === EXPIRY_SOON && n.expiryDate && new Date(n.expiryDate) < new Date()) return 'صنف صلاحيته انتهت';
  if (n.type === BALANCES_FIXED) return `مراجعة الأرصدة: اتصلّح رصيد ${n.quantity} حساب`;
  return `${n.cancelled ? 'إلغاء ' : ''}${NOTIFICATION_LABELS[n.type]}${n.number ? ` ${n.number}` : ''}`;
}

export function notificationLink(n: AppNotification): string[] | null {
  if (n.type === CASH_TAKEN || n.type === STOCK_ADDED || n.type === STOCK_RETURNED) return null;
  if (n.type === CHEQUE_DUE) return ['/treasury'];
  if (n.type === BALANCES_FIXED) return ['/audit-log'];
  if (n.type === CUSTODY_REQUEST || n.type === CUSTODY_REJECTED) return ['/inventory/requests'];
  if (n.type === SUPPLIER_PAYMENT || n.type === SUPPLIER_CHEQUE_DUE) return ['/suppliers', n.docId];
  if (n.type === VISIT) return ['/visits', n.docId];
  if (n.type === REP_EXPENSE) return ['/treasury'];
  if (n.type === LOW_STOCK || n.type === EXPIRY_SOON) return ['/inventory/products', n.docId, 'edit'];
  if (n.type === DocumentType.ISSUE || n.type === DocumentType.RETURN) return ['/inventory/movements', n.docId];
  return detailsLink({ type: n.type, id: n.docId }) ?? ['/documents', n.type, n.docId];
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/notifications`;

  /** Unread badge on the nav; refreshed by the layout. */
  readonly unread = signal(0);

  getNotificationsPage(query: PageParams): Observable<Page<AppNotification>> {
    return getPage(this.http, this.url, query);
  }

  /** A failed poll keeps the last count. */
  refreshUnread(): Observable<unknown> {
    return this.http.get<ApiResponse<{ count: number }>>(`${this.url}/unread-count`).pipe(
      map(({ data }) => this.unread.set(data.count)),
      catchError(() => of(null)),
    );
  }

  markAllRead(): void {
    this.http.post(`${this.url}/read-all`, {}).subscribe(() => this.unread.set(0));
  }
}
