import { PaymentMethod } from '../../invoices/models/invoice.model';

/** Where money received from a customer is. Missing/null on old entries = already in the treasury. */
export enum DepositStatus {
  PENDING = 'PENDING',
  DEPOSITED = 'DEPOSITED',
}

/** A cheque in the treasury: null until a manager marks it cashed (to the bank) or bounced. */
export enum ChequeStatus {
  CLEARED = 'CLEARED',
  BOUNCED = 'BOUNCED',
}

/** Set on invoices (up-front payment) and collections. */
export interface DepositInfo {
  depositStatus: DepositStatus | null;
  deposit: { id: string; number: number; createdAt: string } | null;
  depositedAt: string | null;
  chequeStatus?: ChequeStatus | null;
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
  chequeStatus?: ChequeStatus | null;
  createdAt: string;
}

export interface TreasurySummary {
  total: number;
  byMethod: { method: PaymentMethod; total: number; count: number }[];
  pendingByRep: { rep: { id: string; name: string }; total: number; count: number }[];
}

export enum TreasuryEntryType {
  EXPENSE = 'EXPENSE',
  WITHDRAWAL = 'WITHDRAWAL',
  BANK_DEPOSIT = 'BANK_DEPOSIT',
}

export const ENTRY_TYPE_LABELS: Record<TreasuryEntryType, string> = {
  [TreasuryEntryType.EXPENSE]: 'مصروف',
  [TreasuryEntryType.WITHDRAWAL]: 'سحب',
  [TreasuryEntryType.BANK_DEPOSIT]: 'إيداع في البنك',
};

/** Suggestions for the expense category (free text). */
export const EXPENSE_CATEGORIES = ['بنزين ومواصلات', 'إيجار', 'مرتبات', 'كهرباء ومياه', 'صيانة', 'ضيافة', 'أخرى'];

/** In the treasury, the bank-transfer bucket is the company's bank balance. */
export const BUCKET_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: 'نقدي',
  [PaymentMethod.VODAFONE_CASH]: 'فودافون كاش',
  [PaymentMethod.BANK_TRANSFER]: 'البنك / تحويل',
  [PaymentMethod.CHEQUE]: 'شيكات',
};

/** Money taken out of the treasury by a manager. */
export interface TreasuryEntry {
  id: string;
  number: number;
  type: TreasuryEntryType;
  amount: number;
  paymentMethod: PaymentMethod;
  category: string | null;
  notes: string | null;
  status: 'ACTIVE' | 'CANCELLED';
  cancelReason: string | null;
  createdBy: { id: string; name: string };
  cancelledBy: { id: string; name: string } | null;
  /** Rep expense (مصروف مندوب): PENDING while with the rep, DEPOSITED once accepted in a handover. */
  rep?: { id: string; name: string } | null;
  depositStatus?: DepositStatus | null;
  deposit?: { id: string; number: number } | null;
  createdAt: string;
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
  /** The rep's expenses accepted in this handover; `total` = payments − expenses. */
  expenses?: TreasuryEntry[];
}

/** A rep's cash box: `total` = collected − pending expenses; `cash` = what they can still spend. */
export interface CashBox {
  total: number;
  count: number;
  expenses: number;
  cash: number;
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
