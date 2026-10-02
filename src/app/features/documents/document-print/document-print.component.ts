import { Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { formatCurrency, formatDate, formatNumber } from '@angular/common';
import { arabicDigits } from '../../../shared/date.pipe';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, forkJoin, map } from 'rxjs';

import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { InvoiceService } from '../../invoices/services/invoice.service';
import { CollectionService } from '../../collections/services/collection.service';
import { TreasuryService } from '../../treasury/services/treasury.service';
import { ReturnsService } from '../../returns/returns.service';
import { ReturnStatus } from '../../returns/returns.model';
import { DEFERRED_LABEL, InvoiceStatus, PAYMENT_METHOD_LABELS, PaymentMethod } from '../../invoices/models/invoice.model';
import { CollectionStatus } from '../../collections/models/collection.model';
import { PRODUCT_UNIT_LABELS } from '../../products/models/product.model';
import { Company, DOCUMENT_TYPE_LABELS, DocumentType, detailsLink } from '../documents.model';
import { DocumentsService } from '../documents.service';

/** What the A4 sheet renders; every document type is mapped into this one shape. */
interface PrintDoc {
  title: string;
  number: string;
  date: string;
  cancelled: string | null; // cancel reason, or '' when cancelled without one
  party: { label: string; lines: string[] };
  meta: [string, string][];
  columns: string[];
  rows: string[][];
  totals: [string, string][];
  notes: string | null;
  signatures: [string, string];
}

/** /documents/:type/:id — A4 print view. "PDF" uses the browser's Save as PDF (keeps Arabic text correct). */
@Component({
  selector: 'app-document-print',
  imports: [RouterLink, StatusMessageComponent],
  templateUrl: './document-print.component.html',
})
export class DocumentPrintComponent {
  readonly type = input.required<DocumentType>();
  readonly id = input.required<string>();

  private readonly locale = inject(LOCALE_ID);
  private readonly documents = inject(DocumentsService);
  private readonly invoices = inject(InvoiceService);
  private readonly collections = inject(CollectionService);
  private readonly treasury = inject(TreasuryService);
  private readonly returns = inject(ReturnsService);

  protected readonly doc = rxResource({
    params: () => ({ type: this.type(), id: this.id() }),
    stream: ({ params }) =>
      forkJoin({ company: this.documents.getCompany(), doc: this.load(params.type, params.id) }),
  });

  protected readonly back = computed(() => detailsLink({ type: this.type(), id: this.id() }) ?? ['/documents']);

  protected print(asPdf: boolean): void {
    const data = this.doc.value();
    const title = document.title;
    // The browser uses the page title as the PDF file name.
    if (asPdf && data) document.title = `${data.doc.title} ${data.doc.number}`;
    window.print();
    document.title = title;
  }

  protected companyLines(c: Company): { label: string; value: string }[] {
    return [
      { label: '', value: c.address },
      { label: 'تليفون', value: c.phone },
      { label: 'الرقم الضريبي', value: c.taxNumber },
      { label: 'سجل تجاري', value: c.commercialRegister },
    ].filter((l): l is { label: string; value: string } => !!l.value);
  }

  // ---------- mapping ----------

  private money = (n: number) => formatCurrency(n, this.locale, 'ج.م.', 'EGP', '1.0-2');
  private num = (n: number) => formatNumber(n, this.locale, '1.0-2');
  private date = (d: string) => arabicDigits(formatDate(d, 'd/M/y h:mm a', this.locale));
  private day = (d: string) => arabicDigits(formatDate(d, 'd/M/y', this.locale));

  private payment(method: PaymentMethod | null, chequeNumber: string | null, due: string | null): [string, string][] {
    const rows: [string, string][] = [['طريقة الدفع', method ? PAYMENT_METHOD_LABELS[method] : DEFERRED_LABEL]];
    if (method === PaymentMethod.CHEQUE) {
      rows.push(['رقم الشيك', chequeNumber ?? '—'], ['تاريخ الاستحقاق', due ? this.day(due) : '—']);
    }
    return rows;
  }

  private load(type: DocumentType, id: string): Observable<PrintDoc> {
    const title = DOCUMENT_TYPE_LABELS[type];
    switch (type) {
      case DocumentType.SALE:
        return this.invoices.getInvoice(id).pipe(
          map((i) => ({
            title,
            number: i.invoiceNumber,
            date: this.date(i.createdAt),
            cancelled: i.status === InvoiceStatus.CANCELLED ? (i.cancelReason ?? '') : null,
            party: {
              label: 'العميل',
              lines: [i.customer.name, [i.customer.city, i.customer.governorate].filter(Boolean).join(' - '), i.customer.phone ?? ''].filter(Boolean),
            },
            meta: [
              ['المندوب / البائع', i.createdBy?.name ?? '—'],
              ['المخزن', i.warehouse?.name ?? '—'],
              ...this.payment(i.paymentMethod, i.chequeNumber, i.chequeDueDate),
              ...(i.dueDate ? [['تاريخ استحقاق الباقي', this.day(i.dueDate)] as [string, string]] : []),
            ],
            columns: i.discount
              ? ['#', 'الصنف', 'الوحدة', 'الكمية', 'سعر البيع', 'الخصم', 'الإجمالي']
              : ['#', 'الصنف', 'الوحدة', 'الكمية', 'سعر البيع', 'الإجمالي'],
            rows: i.items.map((it, n) => [
              String(n + 1),
              it.name,
              it.unit ? PRODUCT_UNIT_LABELS[it.unit] : '—',
              this.num(it.quantity),
              this.money(it.unitPrice),
              ...(i.discount ? [it.discountPercent ? `${it.discountPercent}%` : '—'] : []),
              this.money(it.total),
            ]),
            totals: [
              ...(i.discount ? [['إجمالي الخصم', this.money(i.discount)] as [string, string]] : []),
              ['إجمالي الفاتورة', this.money(i.total)],
              ['المدفوع', this.money(i.paidAmount)],
              ...(i.previousDebtPaid ? [['منه سداد مديونية سابقة', this.money(i.previousDebtPaid)] as [string, string]] : []),
              ['المتبقي', this.money(i.remaining)],
            ],
            notes: i.notes,
            signatures: ['توقيع المستلم (العميل)', 'توقيع المندوب'],
          })),
        );
      case DocumentType.SALE_RETURN:
        return this.returns.getReturn(id).pipe(
          map((r) => ({
            title,
            number: String(r.number),
            date: this.date(r.createdAt),
            cancelled: r.status === ReturnStatus.CANCELLED ? (r.cancelReason ?? '') : null,
            party: {
              label: 'العميل',
              lines: [r.customer.name, [r.customer.city, r.customer.governorate].filter(Boolean).join(' - '), r.customer.phone ?? ''].filter(Boolean),
            },
            meta: [
              ['من فاتورة بيع رقم', r.invoice.invoiceNumber],
              ['سجّله', r.createdBy?.name ?? '—'],
              ['البضاعة رجعت', r.rep ? `عهدة ${r.rep.name}` : `مخزن ${r.warehouse.name}`],
            ],
            columns: ['#', 'الصنف', 'الوحدة', 'الكمية', 'سعر البيع', 'الإجمالي'],
            rows: r.items.map((it, n) => [
              String(n + 1),
              it.name,
              it.unit ? PRODUCT_UNIT_LABELS[it.unit] : '—',
              this.num(it.quantity),
              this.money(it.unitPrice),
              this.money(it.total),
            ]),
            totals: [['إجمالي المرتجع (يخصم من حساب العميل)', this.money(r.total)]],
            notes: r.notes,
            signatures: ['توقيع العميل', 'توقيع المستلم'],
          })),
        );
      case DocumentType.COLLECTION:
        return this.collections.getCollection(id).pipe(
          map((c) => ({
            title,
            number: c.receiptNumber,
            date: this.date(c.createdAt),
            cancelled: c.status === CollectionStatus.CANCELLED ? (c.cancelReason ?? '') : null,
            party: {
              label: 'استلمنا من السيد / السادة',
              lines: [c.customer.name, [c.customer.city, c.customer.governorate].filter(Boolean).join(' - '), c.customer.phone ?? ''].filter(Boolean),
            },
            meta: [['المحصّل', c.createdBy?.name ?? '—'], ...this.payment(c.paymentMethod, c.chequeNumber, c.chequeDueDate)],
            columns: ['البيان', 'المبلغ'],
            rows: [['تحصيل من الحساب', this.money(c.amount)]],
            totals: [['المبلغ المستلم', this.money(c.amount)]],
            notes: c.notes,
            signatures: ['توقيع العميل', 'توقيع المحصّل'],
          })),
        );
      case DocumentType.DEPOSIT:
        return this.treasury.getDeposit(id).pipe(
          map((d) => ({
            title,
            number: String(d.number),
            date: this.date(d.createdAt),
            cancelled: null,
            party: { label: 'المندوب المورِّد', lines: [d.rep.name] },
            meta: [['المستلم (الخزنة)', d.receivedBy.name]],
            columns: ['#', 'المستند', 'العميل', 'طريقة الدفع', 'المبلغ'],
            rows: [
              ...d.payments.map((p, n) => [
                String(n + 1),
                `${p.kind === 'INVOICE' ? 'فاتورة' : 'إيصال'} ${p.number}`,
                p.customer.name,
                PAYMENT_METHOD_LABELS[p.paymentMethod] + (p.chequeNumber ? ` (${p.chequeNumber})` : ''),
                this.money(p.amount),
              ]),
              // The rep's expenses accepted in this handover come out of the cash.
              ...(d.expenses ?? []).map((e, n) => [
                String(d.payments.length + n + 1),
                `مصروف #${e.number}`,
                e.category ?? '—',
                'نقدي',
                `− ${this.money(e.amount)}`,
              ]),
            ],
            totals: [['إجمالي المبلغ المورَّد', this.money(d.total)]],
            notes: d.notes,
            signatures: ['توقيع المندوب', 'توقيع المستلم'],
          })),
        );
      default: // PURCHASE / ISSUE / RETURN
        return this.documents.getMovement(id).pipe(
          map((m) => {
            const purchase = type === DocumentType.PURCHASE;
            const supplier = m.supplier as (typeof m.supplier & { phone?: string | null; company?: string | null; address?: string | null }) | null;
            const qty = m.items.reduce((s, i) => s + i.quantity, 0);
            const total = m.totalCost ?? m.items.reduce((s, i) => s + i.quantity * (i.unitCost ?? 0), 0);
            const paid = m.paidAmount ?? total;
            const remaining = Math.round((total - paid) * 100) / 100;
            return {
              title,
              number: String(m.number ?? '—'),
              date: this.date(m.createdAt),
              cancelled: null,
              party: purchase
                ? { label: 'المورد', lines: [supplier?.name ?? '—', supplier?.company ?? '', supplier?.phone ?? '', supplier?.address ?? ''].filter(Boolean) }
                : { label: type === DocumentType.ISSUE ? 'صُرف إلى المندوب' : 'مرتجع من المندوب', lines: [m.rep?.name ?? '—'] },
              meta: [
                ['المخزن', m.warehouse?.name ?? '—'],
                ['بواسطة', m.createdBy?.name ?? '—'],
              ],
              columns: purchase ? ['#', 'الصنف', 'الكمية', 'سعر الشراء', 'الإجمالي'] : ['#', 'الصنف', 'الكمية'],
              rows: m.items.map((it, n) =>
                purchase
                  ? [String(n + 1), it.name, this.num(it.quantity), this.money(it.unitCost ?? 0), this.money(it.quantity * (it.unitCost ?? 0))]
                  : [String(n + 1), it.name, this.num(it.quantity)],
              ),
              totals: purchase
                ? [
                    ['إجمالي الكمية', this.num(qty)],
                    ['إجمالي الفاتورة', this.money(total)],
                    ['المدفوع', this.money(paid)],
                    ['المتبقي (مديونية للمورد)', this.money(remaining)],
                  ]
                : [['إجمالي الكمية', this.num(qty)]],
              notes: m.notes,
              signatures: purchase ? ['توقيع المورد', 'توقيع أمين المخزن'] : ['توقيع المندوب', 'توقيع أمين المخزن'],
            };
          }),
        );
    }
  }
}
