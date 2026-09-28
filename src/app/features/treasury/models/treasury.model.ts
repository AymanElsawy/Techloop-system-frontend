import type { PaymentMethod } from '../../invoices/models/invoice.model';

/** Where money received from a customer is. Missing/null on old entries = already in the treasury. */
export enum DepositStatus {
  PENDING = 'PENDING',
  DEPOSITED = 'DEPOSITED',
}

/** Set on invoices (up-front payment) and collections. */
export interface DepositInfo {
  depositStatus: DepositStatus | null;
  deposit: { id: string; number: number; createdAt: string } | null;
  depositedAt: string | null;
}

export const isPending = (entry: Pick<DepositInfo, 'depositStatus'>) => entry.depositStatus === DepositStatus.PENDING;

/** One money entry in a rep's cash box or a handover. */
export interface Payment {
  kind: 'INVOICE' | 'COLLECTION';
  id: string;
  number: string;
  customer: { id: string; name: string; governorate: string };
  rep: { id: string; name: string };
  amount: number;
  paymentMethod: PaymentMethod;
  chequeNumber: string | null;
  chequeDueDate: string | null;
  createdAt: string;
}

export interface TreasurySummary {
  total: number;
  byMethod: { method: PaymentMethod; total: number; count: number }[];
  pendingByRep: { rep: { id: string; name: string }; total: number; count: number }[];
}

export interface Deposit {
  id: string;
  number: number;
  rep: { id: string; name: string };
  receivedBy: { id: string; name: string };
  total: number;
  notes: string | null;
  createdAt: string;
}

export interface DepositDetails extends Deposit {
  payments: Payment[];
}

export function sumPayments(payments: Pick<Payment, 'amount'>[]): number {
  return Math.round(payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
}

/** Totals per payment method, in the order they first appear. */
export function totalsByMethod(payments: Payment[]): { method: PaymentMethod; total: number; count: number }[] {
  const map = new Map<PaymentMethod, { total: number; count: number }>();
  for (const p of payments) {
    const prev = map.get(p.paymentMethod) ?? { total: 0, count: 0 };
    map.set(p.paymentMethod, { total: Math.round((prev.total + p.amount) * 100) / 100, count: prev.count + 1 });
  }
  return [...map].map(([method, v]) => ({ method, ...v }));
}
