import type { ChequeStatus, DepositInfo, DepositStatus } from '../../treasury/models/treasury.model';
import { PersonRef } from '../../customers/models/customer.model';
import { ProductUnit } from '../../products/models/product.model';

export enum PaymentMethod {
  CASH = 'CASH',
  VODAFONE_CASH = 'VODAFONE_CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHEQUE = 'CHEQUE',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: 'تحصيل نقدي',
  [PaymentMethod.VODAFONE_CASH]: 'فودافون كاش',
  [PaymentMethod.BANK_TRANSFER]: 'تحويل بنكي',
  [PaymentMethod.CHEQUE]: 'شيك',
};

/** Shown when nothing was paid up front. */
export const DEFERRED_LABEL = 'آجل';

export enum InvoiceStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
}

export enum AttachmentKind {
  RECEIPT = 'RECEIPT',
  CHEQUE = 'CHEQUE',
}

export const ATTACHMENT_KIND_LABELS: Record<AttachmentKind, string> = {
  [AttachmentKind.RECEIPT]: 'إيصال',
  [AttachmentKind.CHEQUE]: 'صورة الشيك',
};

/** Accepted by the backend (max 5 MB). */
export const ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

export interface InvoiceItem {
  product: string;
  name: string;
  unit: ProductUnit | null;
  unitPrice: number;
  /** total = unitPrice × quantity − this % (0 on old invoices). */
  discountPercent?: number;
  quantity: number;
  total: number;
}

export interface InvoiceAttachment {
  id: string;
  kind: AttachmentKind;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: PersonRef;
  uploadedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: { id: string; name: string; governorate: string; city: string | null; phone: string | null };
  createdBy: PersonRef;
  /** Visit this entry was made during, if any. */
  visit: { id: string; purpose: string; status: string; scheduledAt: string } | null;
  warehouse: { id: string; name: string } | null;
  /** Up-front payment: with the rep (PENDING) or in the treasury. */
  depositStatus: DepositStatus | null;
  deposit: DepositInfo['deposit'];
  /** Cheque cashed (CLEARED) or bounced; null until a manager marks it. */
  chequeStatus?: ChequeStatus | null;
  items: InvoiceItem[];
  /** After discount. */
  total: number;
  /** Sum of the line discounts (EGP). */
  discount?: number;
  /** From the customer's payment terms; null = no terms. */
  dueDate?: string | null;
  paidAmount: number;
  /** Left unpaid on this invoice. */
  remaining: number;
  /** Paid above the invoice total; settles the customer's older debt. */
  previousDebtPaid: number;
  paymentMethod: PaymentMethod | null;
  chequeNumber: string | null;
  chequeDueDate: string | null;
  notes: string | null;
  status: InvoiceStatus;
  cancelReason: string | null;
  cancelledBy: PersonRef | null;
  cancelledAt: string | null;
  attachments: InvoiceAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceRequest {
  invoiceNumber: string;
  customerId: string;
  visitId: string | null;
  /** Managers only; reps always sell from their own warehouse. */
  warehouseId: string | null;
  /** unitPrice omitted = the product's sale price. */
  items: { productId: string; quantity: number; unitPrice?: number; discountPercent?: number }[];
  paidAmount: number;
  paymentMethod: PaymentMethod | null;
  chequeNumber: string | null;
  /** YYYY-MM-DD */
  chequeDueDate: string | null;
  notes: string | null;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
