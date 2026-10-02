import { Collection, CollectionStatus } from '../../collections/models/collection.model';
import { DEFERRED_LABEL, Invoice, InvoiceStatus, PAYMENT_METHOD_LABELS } from '../../invoices/models/invoice.model';
import { round2 } from '../../invoices/models/invoice.model';
import { ChequeStatus, DepositStatus } from '../../treasury/models/treasury.model';
import { ReturnStatus, SalesReturn } from '../../returns/returns.model';

/** One line of a customer's account statement (كشف حساب). */
export interface StatementLine {
  kind: 'invoice' | 'collection' | 'return';
  id: string;
  number: string;
  date: string;
  /** Increases what the customer owes (invoice total). */
  debit: number;
  /** Decreases it (up-front payment, collection, or returned goods). */
  credit: number;
  method: string;
  createdBy: string;
  cancelled: boolean;
  /** Payment still with the rep: shown, but not deducted from the balance until handed over. */
  pending: boolean;
  /** A bounced cheque: shown, never deducted. */
  bounced: boolean;
  /** Running balance after this line; null for cancelled lines. */
  balance: number | null;
}

/**
 * Merges invoices, collections and sales returns into a statement with a running balance.
 * Cancelled entries are listed but don't affect the balance; payments still with the rep
 * add to the debit side only, and bounced cheques never reduce it. Returned newest first.
 */
export function buildStatement(
  invoices: Invoice[],
  collections: Collection[],
  returns: SalesReturn[] = [],
): StatementLine[] {
  const lines: StatementLine[] = [
    ...invoices.map((inv) => ({
      kind: 'invoice' as const,
      id: inv.id,
      number: inv.invoiceNumber,
      date: inv.createdAt,
      debit: inv.total,
      credit: inv.paidAmount,
      method: inv.paymentMethod ? PAYMENT_METHOD_LABELS[inv.paymentMethod] : DEFERRED_LABEL,
      createdBy: inv.createdBy.name,
      cancelled: inv.status === InvoiceStatus.CANCELLED,
      pending: inv.depositStatus === DepositStatus.PENDING,
      bounced: inv.chequeStatus === ChequeStatus.BOUNCED,
      balance: null,
    })),
    ...collections.map((col) => ({
      kind: 'collection' as const,
      id: col.id,
      number: col.receiptNumber,
      date: col.createdAt,
      debit: 0,
      credit: col.amount,
      method: PAYMENT_METHOD_LABELS[col.paymentMethod],
      createdBy: col.createdBy.name,
      cancelled: col.status === CollectionStatus.CANCELLED,
      pending: col.depositStatus === DepositStatus.PENDING,
      bounced: col.chequeStatus === ChequeStatus.BOUNCED,
      balance: null,
    })),
    ...returns.map((r) => ({
      kind: 'return' as const,
      id: r.id,
      number: String(r.number),
      date: r.createdAt,
      debit: 0,
      credit: r.total,
      method: 'مرتجع بضاعة',
      createdBy: r.createdBy.name,
      cancelled: r.status === ReturnStatus.CANCELLED,
      pending: false,
      bounced: false,
      balance: null,
    })),
  ];

  let balance = 0;
  const chronological = lines.sort((a, b) => a.date.localeCompare(b.date));
  for (const line of chronological) {
    if (line.cancelled) continue;
    balance = round2(balance + line.debit - (line.pending || line.bounced ? 0 : line.credit));
    line.balance = balance;
  }
  return chronological.reverse();
}
