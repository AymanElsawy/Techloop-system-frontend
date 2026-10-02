import { Component, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { concatMap, from, lastValueFrom, map, of, toArray } from 'rxjs';

import { httpErrorMessage } from '../../../core/http/http-error';
import { CustomerStatus } from '../../customers/models/customer.model';
import { CustomerService } from '../../customers/services/customer.service';
import { PRODUCT_UNIT_LABELS, Product } from '../../products/models/product.model';
import { ProductService } from '../../products/services/product.service';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_BYTES,
  AttachmentKind,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  round2,
} from '../models/invoice.model';
import { InvoiceService } from '../services/invoice.service';
import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { quantityMap } from '../../inventory/models/inventory.model';
import { InventoryService } from '../../inventory/services/inventory.service';

/** New invoice for a customer: /customers/:id/invoices/new */
@Component({
  selector: 'app-invoice-form',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './invoice-form.component.html',
})
export class InvoiceFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly invoiceService = inject(InvoiceService);
  private readonly customerService = inject(CustomerService);
  private readonly productService = inject(ProductService);
  private readonly inventory = inject(InventoryService);

  /** Managers pick the warehouse; a rep always sells from their custody + their warehouse. */
  protected readonly isManager = inject(AuthService).hasRole(UserRole.OWNER, UserRole.ADMIN);

  /** Customer id from the route. */
  readonly id = input.required<string>();
  /** Query param: the in-progress visit this entry is made during. */
  readonly visitId = input<string>();

  protected readonly CustomerStatus = CustomerStatus;
  protected readonly PaymentMethod = PaymentMethod;
  protected readonly AttachmentKind = AttachmentKind;
  protected readonly methods = Object.values(PaymentMethod);
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly unitLabels = PRODUCT_UNIT_LABELS;
  protected readonly accept = ATTACHMENT_ACCEPT;

  protected readonly customer = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.customerService.getCustomer(params),
  });
  protected readonly products = rxResource({ stream: () => this.productService.getProducts({ active: true }) });
  private readonly productById = computed(
    () => new Map((this.products.value() ?? []).map((p) => [p.id, p] as [string, Product])),
  );

  protected readonly warehouses = rxResource({
    stream: () =>
      this.isManager
        ? this.inventory.getWarehouses().pipe(map((list) => list.filter((w) => w.isActive)))
        : of([]),
  });

  protected readonly form = this.fb.group({
    warehouseId: ['', this.isManager ? Validators.required : []],
    invoiceNumber: ['', [Validators.required, Validators.maxLength(40)]],
    items: this.fb.array([this.newItem()]),
    paidAmount: [0, [Validators.required, Validators.min(0)]],
    paymentMethod: ['' as PaymentMethod | ''],
    chequeNumber: [''],
    chequeDueDate: [''],
    notes: [''],
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Where the goods can come from: rep custody (sold first) and the warehouse main stock. */
  protected readonly stock = rxResource({
    params: () => (this.isManager ? this.value().warehouseId || undefined : 'mine'),
    stream: ({ params }) =>
      this.isManager
        ? this.inventory.getWarehouse(params).pipe(
            map((d) => ({ warehouseName: d.warehouse.name, custody: new Map<string, number>(), warehouse: quantityMap(d.stock) })),
          )
        : this.inventory.getMyStock().pipe(
            map((s) => ({
              warehouseName: s.warehouse?.name ?? null,
              custody: quantityMap(s.custody),
              warehouse: quantityMap(s.warehouseStock),
            })),
          ),
  });
  /** Rep not attached to any warehouse: selling is blocked by the backend. */
  protected readonly noWarehouse = computed(() => !this.isManager && this.stock.hasValue() && !this.stock.value()!.warehouseName);

  /** Empty price = the product's sale price; the seller may type any price. */
  protected readonly lines = computed(() =>
    (this.value().items ?? []).map((item) => {
      const product = item.productId ? this.productById().get(item.productId) : undefined;
      const quantity = Number(item.quantity) || 0;
      const stock = this.stock.value();
      const custody = (product && stock?.custody.get(product.id)) || 0;
      const warehouse = (product && stock?.warehouse.get(product.id)) || 0;
      const discount = item.discountPercent === null || item.discountPercent === undefined || (item.discountPercent as unknown) === ''
        ? this.customerDiscount()
        : Number(item.discountPercent);
      const price = item.unitPrice === null || item.unitPrice === undefined || (item.unitPrice as unknown) === ''
        ? (product?.price ?? 0)
        : Number(item.unitPrice);
      return {
        product,
        discount,
        price,
        gross: product ? round2(price * quantity) : 0,
        total: product ? round2(price * quantity * (1 - discount / 100)) : 0,
        custody,
        warehouse,
        fromCustody: Math.min(custody, quantity),
        fromWarehouse: Math.max(quantity - custody, 0),
        overStock: !!product && !!stock && quantity > custody + warehouse,
      };
    }),
  );
  /** The customer's default discount; a rep can't give more (the backend checks too). */
  protected readonly customerDiscount = computed(() => this.customer.value()?.discountPercent ?? 0);
  protected readonly maxDiscount = computed(() => (this.isManager ? 100 : this.customerDiscount()));
  protected readonly canDiscount = computed(() => this.isManager || this.customerDiscount() > 0);
  protected readonly discountTooHigh = computed(() => this.lines().some((l) => l.discount > this.maxDiscount()));
  protected readonly discountTotal = computed(() => round2(this.lines().reduce((s, l) => s + l.gross - l.total, 0)));
  /** From the customer's payment terms; null = no terms. */
  protected readonly dueDate = computed(() => {
    const days = this.customer.value()?.paymentTermDays;
    return days == null ? null : new Date(Date.now() + days * 86_400_000);
  });
  protected readonly overdue = computed(() => this.customer.value()?.overdue ?? 0);
  protected readonly hasOverStock = computed(() => this.lines().some((l) => l.overStock));
  protected readonly total = computed(() => round2(this.lines().reduce((sum, l) => sum + l.total, 0)));
  protected readonly paid = computed(() => Number(this.value().paidAmount) || 0);
  /** Customer's debt before this invoice; payments above the total settle it. */
  /** Money already collected but not handed over can't be collected again (same rule as the backend). */
  protected readonly previousDebt = computed(() => {
    const c = this.customer.value();
    return c ? Math.max(round2(c.debit - c.pendingPayments), 0) : 0;
  });
  protected readonly pendingPayments = computed(() => this.customer.value()?.pendingPayments ?? 0);
  protected readonly maxPaid = computed(() => round2(this.total() + this.previousDebt()));
  protected readonly remaining = computed(() => round2(Math.max(this.total() - this.paid(), 0)));
  protected readonly previousDebtPaid = computed(() => round2(Math.max(this.paid() - this.total(), 0)));
  protected readonly debtAfter = computed(() => round2(this.previousDebt() + this.total() - this.paid()));
  /** Over the customer's credit limit: blocks a rep (same rule as the backend), only warns a manager. */
  protected readonly overLimit = computed(() => {
    const limit = this.customer.value()?.creditLimit;
    return limit != null && this.debtAfter() > limit && this.debtAfter() > this.previousDebt() ? limit : null;
  });
  protected readonly isCheque = computed(() => this.paid() > 0 && this.value().paymentMethod === PaymentMethod.CHEQUE);

  protected readonly paymentError = computed(() => {
    if (this.paid() > this.maxPaid()) {
      return this.previousDebt() > 0
        ? 'المبلغ المدفوع أكبر من إجمالي الفاتورة + المديونية السابقة.'
        : 'المبلغ المدفوع أكبر من إجمالي الفاتورة.';
    }
    if (this.paid() > 0 && !this.value().paymentMethod) return 'اختر طريقة السداد.';
    if (this.discountTooHigh()) return `الخصم أكبر من المسموح (${this.maxDiscount()}%).`;
    if (this.overdue() > 0 && !this.isManager && this.debtAfter() > this.previousDebt()) {
      return `العميل عليه متأخرات (${this.overdue()} ج.م). اتحصّلها الأول، أو خلي الفاتورة مدفوعة بالكامل.`;
    }
    if (this.overLimit() != null && !this.isManager) {
      return `المديونية بعد الفاتورة أكبر من حد الائتمان (${this.overLimit()} ج.م). زوّد المدفوع أو قلّل الكمية.`;
    }
    return null;
  });

  protected readonly receipt = signal<File | null>(null);
  protected readonly chequeImage = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected get items() {
    return this.form.controls.items;
  }

  private newItem() {
    return this.fb.group({
      productId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
      /** null = the product's sale price. */
      unitPrice: [null as number | null, Validators.min(0)],
      /** null = the customer's discount. */
      discountPercent: [null as number | null, [Validators.min(0), Validators.max(100)]],
    });
  }

  protected addItem(): void {
    this.items.push(this.newItem());
  }

  protected removeItem(index: number): void {
    this.items.removeAt(index);
  }

  /** Products already chosen in other rows are hidden to avoid duplicate lines. */
  protected isTaken(productId: string, rowIndex: number): boolean {
    return (this.value().items ?? []).some((item, i) => i !== rowIndex && item.productId === productId);
  }

  protected pickFile(event: Event, kind: AttachmentKind): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.fileError.set(null);
    if (file && file.size > ATTACHMENT_MAX_BYTES) {
      this.fileError.set('حجم الملف أكبر من 5 ميجابايت.');
      input.value = '';
      return;
    }
    (kind === AttachmentKind.RECEIPT ? this.receipt : this.chequeImage).set(file);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.paymentError() || this.hasOverStock() || this.noWarehouse() || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);

    const v = this.form.getRawValue();
    const paid = round2(Number(v.paidAmount));
    try {
      const invoice = await lastValueFrom(
        this.invoiceService.createInvoice({
          invoiceNumber: v.invoiceNumber.trim(),
          customerId: this.id(),
          visitId: this.visitId() ?? null,
          warehouseId: this.isManager ? v.warehouseId : null,
          items: v.items.map((i) => ({
            productId: i.productId,
            quantity: Number(i.quantity),
            ...(i.unitPrice !== null && (i.unitPrice as unknown) !== '' && { unitPrice: Number(i.unitPrice) }),
            ...(i.discountPercent !== null && (i.discountPercent as unknown) !== '' && { discountPercent: Number(i.discountPercent) }),
          })),
          paidAmount: paid,
          paymentMethod: paid > 0 ? (v.paymentMethod as PaymentMethod) : null,
          chequeNumber: this.isCheque() ? v.chequeNumber.trim() || null : null,
          chequeDueDate: this.isCheque() ? v.chequeDueDate || null : null,
          notes: v.notes.trim() || null,
        }),
      );

      const uploads: [AttachmentKind, File][] = [];
      if (this.receipt()) uploads.push([AttachmentKind.RECEIPT, this.receipt()!]);
      if (this.isCheque() && this.chequeImage()) uploads.push([AttachmentKind.CHEQUE, this.chequeImage()!]);

      let uploadFailed = false;
      try {
        await lastValueFrom(
          from(uploads).pipe(
            concatMap(([kind, file]) => this.invoiceService.uploadAttachment(invoice.id, kind, file)),
            toArray(),
          ),
        );
      } catch {
        uploadFailed = true; // the invoice exists; files can be re-uploaded from its page
      }
      this.router.navigate(['/invoices', invoice.id], { state: { uploadFailed } });
    } catch (err) {
      this.saving.set(false);
      this.error.set(
        err instanceof HttpErrorResponse && err.status === 409
          ? 'رقم الفاتورة مستخدم من قبل.'
          : err instanceof HttpErrorResponse && err.status === 400 && /overdue/.test(err.error?.message ?? '')
            ? 'العميل عليه متأخرات. حدّث الصفحة.'
            : err instanceof HttpErrorResponse && err.status === 400 && /Discount above/.test(err.error?.message ?? '')
            ? 'الخصم أكبر من المسموح.'
            : err instanceof HttpErrorResponse && err.status === 400 && /Credit limit/.test(err.error?.message ?? '')
            ? 'المديونية بعد الفاتورة أكبر من حد الائتمان. المديونية تغيرت، حدّث الصفحة وحاول مرة أخرى.'
            : err instanceof HttpErrorResponse && err.status === 400 && /previous debt/.test(err.error?.message ?? '')
            ? 'المبلغ المدفوع أكبر من المسموح. المديونية تغيرت، حدّث الصفحة وحاول مرة أخرى.'
            : httpErrorMessage(err, 'تعذر حفظ الفاتورة. حاول مرة أخرى.'),
      );
    }
  }
}
