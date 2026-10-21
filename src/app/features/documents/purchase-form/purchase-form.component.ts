import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { CurrencyPipe, Location } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { httpErrorMessage } from '../../../core/http/http-error';
import { PRODUCT_UNIT_LABELS, Product, ProductUnit } from '../../products/models/product.model';
import { ProductService } from '../../products/services/product.service';
import { SupplierService } from '../../suppliers/services/supplier.service';
import { InventoryService } from '../../inventory/services/inventory.service';

const round2 = (n: number) => Math.round(n * 100) / 100;
const isBlank = (v: unknown) => v === null || v === undefined || v === '';
const normalize = (name: string) => name.trim().toLowerCase();

/**
 * /documents/purchases/new — فاتورة شراء (managers only). Each line is typed by name: a known product
 * is picked, anything else is added as a new product. Lines may come from different suppliers;
 * the backend saves one purchase invoice per supplier.
 */
@Component({
  selector: 'app-purchase-form',
  imports: [CurrencyPipe, ReactiveFormsModule],
  templateUrl: './purchase-form.component.html',
})
export class PurchaseFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /** Query params: preselect the first line's supplier / product, and the warehouse. */
  readonly supplierId = input<string>();
  readonly productId = input<string>();
  readonly warehouseId = input<string>();
  private readonly inventory = inject(InventoryService);
  private readonly productService = inject(ProductService);
  private readonly supplierService = inject(SupplierService);

  protected readonly units = Object.values(ProductUnit);
  protected readonly unitLabels = PRODUCT_UNIT_LABELS;

  protected readonly warehouses = rxResource({
    stream: () =>
      this.inventory.getWarehouses().pipe(map((list) => list.filter((w) => w.isActive))),
  });
  protected readonly products = rxResource({
    stream: () => this.productService.getProducts({ active: true }),
  });
  protected readonly suppliers = rxResource({
    stream: () => this.supplierService.getSuppliers({ active: true }),
  });

  protected readonly form = this.fb.group({
    warehouseId: ['', Validators.required],
    items: this.fb.array([this.newItem()]),
    notes: [''],
  });
  protected readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  /** Paid now per supplier id; empty = paid in full. */
  protected readonly paid = signal<Partial<Record<string, string>>>({});

  private readonly productByName = computed(
    () => new Map((this.products.value() ?? []).map((p) => [normalize(p.name), p] as const)),
  );

  private readonly supplierByName = computed(
    () => new Map((this.suppliers.value() ?? []).map((s) => [normalize(s.name), s] as const)),
  );
  /** Each line's supplier: a known one by name, or a new one (`id` = `new:<name>` groups it). */
  protected readonly lineSuppliers = computed(() =>
    (this.value().items ?? []).map((i) => {
      const name = (i.supplierName ?? '').trim();
      if (name.length < 2) return null;
      const known = this.supplierByName().get(normalize(name));
      return known ? { id: known.id, name: known.name, isNew: false } : { id: `new:${normalize(name)}`, name, isNew: true };
    }),
  );

  /** The known product each line's name matches, or null (a new product). */
  protected readonly matches = computed(() =>
    (this.value().items ?? []).map(
      (i) => this.productByName().get(normalize(i.name ?? '')) ?? null,
    ),
  );
  /**
   * Known products: stock and prices now, and the average after saving (same weighted moving
   * average as the backend).
   */
  protected readonly costPreviews = computed(() =>
    (this.value().items ?? []).map((i, index) => {
      const p = this.matches()[index];
      if (!p) return null;
      const oldQty = Math.max(p.quantity, 0);
      const qty = Number(i.quantity) || 0;
      const cost = isBlank(i.unitCost) ? null : Number(i.unitCost);
      const avg = p.avgCost ?? null;
      const newAvg =
        cost === null ? null : oldQty > 0 && avg !== null ? round2((oldQty * avg + qty * cost) / (oldQty + qty)) : cost;
      return { oldQty, newQty: oldQty + qty, avg, lastCost: p.lastCost ?? null, lastSupplier: p.lastSupplier?.name ?? null, newAvg };
    }),
  );
  protected readonly lineTotals = computed(() =>
    (this.value().items ?? []).map((i) =>
      round2((Number(i.quantity) || 0) * (Number(i.unitCost) || 0)),
    ),
  );

  /** One row per supplier in the invoice, in line order. */
  protected readonly bySupplier = computed(() => {
    const rows = new Map<string, { id: string; name: string; isNew: boolean; total: number }>();
    this.lineSuppliers().forEach((s, index) => {
      if (!s) return;
      const row = rows.get(s.id) ?? { ...s, total: 0 };
      row.total = round2(row.total + this.lineTotals()[index]!);
      rows.set(s.id, row);
    });
    return [...rows.values()].map((r) => {
      const raw = this.paid()[r.id];
      const paid = isBlank(raw) ? r.total : Number(raw);
      return { ...r, paid, remaining: round2(r.total - paid), tooHigh: paid > r.total };
    });
  });
  protected readonly grandTotal = computed(() =>
    round2(this.lineTotals().reduce((s, t) => s + t, 0)),
  );

  /** The same existing product twice from the same supplier. */
  protected readonly duplicates = computed(() => {
    const seen = new Set<string>();
    return this.lineSuppliers().map((s, index) => {
      const p = this.matches()[index];
      if (!p || !s) return false;
      const key = `${p.id}:${s.id}`;
      const dup = seen.has(key);
      seen.add(key);
      return dup;
    });
  });

  protected readonly canSubmit = computed(() => {
    const items = this.value().items ?? [];
    return (
      !!this.value().warehouseId &&
      items.every(
        (i, index) =>
          (i.name ?? '').trim().length >= 2 &&
          !!this.lineSuppliers()[index] &&
          Number.isInteger(Number(i.quantity)) &&
          Number(i.quantity) >= 1 &&
          !isBlank(i.unitCost) &&
          Number(i.unitCost) >= 0 &&
          (this.matches()[index] || (!isBlank(i.price) && Number(i.price) >= 0)),
      ) &&
      !this.duplicates().some(Boolean) &&
      !this.bySupplier().some((s) => s.tooHigh || s.paid < 0)
    );
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // A preselected product (from the products pages) fills the first line once products load.
    const stop = effect(() => {
      const p = this.products.value()?.find((x) => x.id === this.productId());
      if (!p) return;
      this.items.at(0).controls.name.setValue(p.name);
      this.onNameChange(0);
      stop.destroy();
    });
    // Same for a preselected supplier (from the supplier pages) once suppliers load.
    const stopSupplier = effect(() => {
      const s = this.suppliers.value()?.find((x) => x.id === this.supplierId());
      if (!s) return;
      this.items.at(0).controls.supplierName.setValue(s.name);
      stopSupplier.destroy();
    });
  }

  ngOnInit(): void {
    if (this.warehouseId()) this.form.controls.warehouseId.setValue(this.warehouseId()!);
  }

  /** Back to where the form was opened (documents or a supplier page); a direct visit goes to documents. */
  protected back(): void {
    if (((history.state as { navigationId?: number } | null)?.navigationId ?? 0) > 1) this.location.back();
    else this.router.navigate(['/documents']);
  }

  protected get items() {
    return this.form.controls.items;
  }

  private newItem(supplierName = '') {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      // Typed: a known supplier's name picks it, any other name adds a new supplier.
      supplierName: [supplierName, [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      quantity: [1, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
      unitCost: [null as number | null, [Validators.required, Validators.min(0)]],
      // New product only.
      price: [null as number | null, Validators.min(0)],
      unit: [null as ProductUnit | null],
    });
  }

  /** A new line keeps the last line's supplier: most invoices are from one supplier. */
  protected addItem(): void {
    this.items.push(
      this.newItem(this.items.at(this.items.length - 1)?.controls.supplierName.value ?? ''),
    );
  }

  protected removeItem(index: number): void {
    this.items.removeAt(index);
  }

  /** A known product fills its last purchase price and main / last supplier when those are empty. */
  protected onNameChange(index: number): void {
    const p: Product | null = this.matches()[index] ?? null;
    if (!p) return;
    const row = this.items.at(index).controls;
    if (row.unitCost.value === null && p.lastCost != null) row.unitCost.setValue(p.lastCost);
    const supplier = p.supplier ?? p.lastSupplier;
    if (!row.supplierName.value.trim() && supplier && this.suppliers.value()?.some((s) => s.id === supplier.id))
      row.supplierName.setValue(supplier.name);
  }

  protected setPaid(supplierId: string, event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.paid.update((p) => ({ ...p, [supplierId]: v }));
  }

  protected submit(): void {
    if (!this.canSubmit() || this.saving()) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.inventory
      .purchase(v.warehouseId, {
        items: v.items.map((i, index) => {
          const p = this.matches()[index];
          const s = this.lineSuppliers()[index]!;
          return {
            ...(p
              ? { productId: p.id }
              : { newProduct: { name: i.name.trim(), price: Number(i.price), unit: i.unit } }),
            ...(s.isNew ? { newSupplier: { name: s.name } } : { supplierId: s.id }),
            quantity: Number(i.quantity),
            unitCost: Number(i.unitCost),
          };
        }),
        payments: this.bySupplier()
          .filter((s) => !isBlank(this.paid()[s.id]))
          .map((s) => ({ ...(s.isNew ? { supplierName: s.name } : { supplierId: s.id }), paidAmount: s.paid })),
        notes: v.notes.trim() || null,
      })
      .subscribe({
        next: () => this.back(),
        error: (err: unknown) => {
          this.saving.set(false);
          this.error.set(httpErrorMessage(err, 'تعذر حفظ الفاتورة. حاول مرة أخرى.'));
        },
      });
  }
}
