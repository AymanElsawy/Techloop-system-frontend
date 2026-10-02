import { Collection, CollectionStatus } from '../../collections/models/collection.model';
import { Invoice, InvoiceStatus, PaymentMethod } from '../../invoices/models/invoice.model';
import { ChequeStatus, DepositStatus } from '../../treasury/models/treasury.model';
import { buildStatement } from './statement';
import { ReturnStatus, SalesReturn } from '../../returns/returns.model';

const person = { id: 'u', name: 'Rep' };
const invoice = (id: string, date: string, total: number, paid: number, status = InvoiceStatus.ACTIVE) =>
  ({ id, invoiceNumber: id, createdAt: date, total, paidAmount: paid, paymentMethod: paid ? PaymentMethod.CASH : null, status, createdBy: person }) as Invoice;
const collection = (id: string, date: string, amount: number, status = CollectionStatus.ACTIVE) =>
  ({ id, receiptNumber: id, createdAt: date, amount, paymentMethod: PaymentMethod.CASH, status, createdBy: person }) as Collection;

describe('buildStatement', () => {
  it('computes a running balance in date order, newest first, skipping cancelled lines', () => {
    const lines = buildStatement(
      [invoice('I1', '2026-09-01', 5000, 0), invoice('I2', '2026-09-10', 1000, 100), invoice('IX', '2026-09-05', 999, 0, InvoiceStatus.CANCELLED)],
      [collection('C1', '2026-09-03', 2000), collection('CX', '2026-09-04', 50, CollectionStatus.CANCELLED)],
    );

    expect(lines.map((l) => [l.number, l.balance])).toEqual([
      ['I2', 3900],
      ['IX', null],
      ['CX', null],
      ['C1', 3000],
      ['I1', 5000],
    ]);
  });

  it('does not deduct payments still with the rep until they are handed over', () => {
    const pending = { ...collection('C1', '2026-09-03', 300), depositStatus: DepositStatus.PENDING } as Collection;
    const lines = buildStatement([invoice('I1', '2026-09-01', 1000, 0)], [pending]);
    expect(lines.map((l) => [l.number, l.pending, l.balance])).toEqual([
      ['C1', true, 1000],
      ['I1', false, 1000],
    ]);
  });

  it('never deducts a bounced cheque', () => {
    const bounced = { ...collection('C1', '2026-09-03', 300), chequeStatus: ChequeStatus.BOUNCED } as Collection;
    const lines = buildStatement([invoice('I1', '2026-09-01', 1000, 0)], [bounced]);
    expect(lines.map((l) => [l.number, l.bounced, l.balance])).toEqual([
      ['C1', true, 1000],
      ['I1', false, 1000],
    ]);
  });

  it('deducts active sales returns and ignores cancelled ones', () => {
    const ret = (id: string, date: string, total: number, status = ReturnStatus.ACTIVE) =>
      ({ id, number: 1, createdAt: date, total, status, createdBy: person }) as SalesReturn;
    const lines = buildStatement(
      [invoice('I1', '2026-09-01', 1000, 0)],
      [],
      [ret('R1', '2026-09-02', 300), ret('RX', '2026-09-03', 999, ReturnStatus.CANCELLED)],
    );
    expect(lines.map((l) => [l.kind, l.balance])).toEqual([
      ['return', null],
      ['return', 700],
      ['invoice', 1000],
    ]);
  });
});
