import type { DepositInfo, DepositStatus } from '../../treasury/models/treasury.model';
import { PersonRef } from '../../customers/models/customer.model';
import { InvoiceAttachment, PaymentMethod } from '../../invoices/models/invoice.model';

export enum CollectionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
}

/** Money received from a customer without a sale; reduces their total debt. */
export interface Collection {
  id: string;
  receiptNumber: string;
  customer: { id: string; name: string; governorate: string; city: string | null; phone: string | null };
  createdBy: PersonRef;
  /** Visit this entry was made during, if any. */
  visit: { id: string; purpose: string; status: string; scheduledAt: string } | null;
  amount: number;
  paymentMethod: PaymentMethod;
  chequeNumber: string | null;
  chequeDueDate: string | null;
  notes: string | null;
  status: CollectionStatus;
  /** With the rep (PENDING) or in the treasury. */
  depositStatus: DepositStatus | null;
  deposit: DepositInfo['deposit'];
  cancelReason: string | null;
  cancelledBy: PersonRef | null;
  cancelledAt: string | null;
  attachments: InvoiceAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionRequest {
  receiptNumber: string;
  customerId: string;
  visitId: string | null;
  amount: number;
  paymentMethod: PaymentMethod;
  chequeNumber: string | null;
  /** YYYY-MM-DD */
  chequeDueDate: string | null;
  notes: string | null;
}
