import { PaymentMethod } from '../../invoices/models/invoice.model';

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  company: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  /** Number of warehouse receipts from this supplier. */
  receipts: number;
  /** Σ quantity × purchase price over those receipts. */
  totalPurchases: number;
  lastPurchaseAt: string | null;
  /** What the company still owes this supplier. */
  debt: number;
  createdAt: string;
}

export type SupplierInput = Pick<Supplier, 'name' | 'phone' | 'company' | 'address' | 'notes'>;

export interface SupplierPayment {
  id: string;
  number: number;
  supplier: string;
  amount: number;
  paymentMethod: PaymentMethod;
  chequeNumber: string | null;
  chequeDueDate: string | null;
  notes: string | null;
  status: 'ACTIVE' | 'CANCELLED';
  cancelReason: string | null;
  createdBy: { id: string; name: string } | null;
  cancelledBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface SupplierPaymentInput {
  amount: number;
  paymentMethod: PaymentMethod;
  chequeNumber?: string | null;
  chequeDueDate?: string | null;
  notes?: string | null;
}
