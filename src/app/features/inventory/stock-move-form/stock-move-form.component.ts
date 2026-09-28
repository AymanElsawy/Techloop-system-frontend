import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { httpErrorMessage } from '../../../core/http/http-error';
import { PRODUCT_UNIT_LABELS, ProductUnit } from '../../products/models/product.model';
import { ProductService } from '../../products/services/product.service';
import { SupplierPickerComponent } from '../../suppliers/supplier-picker/supplier-picker.component';
import { ManualMovement, MOVEMENT_TYPE_LABELS, MovementType } from '../models/inventory.model';
import { InventoryService } from '../services/inventory.service';

interface Option {
  id: string;
  name: string;
  unit: ProductUnit | null;
  /** null = no limit (goods coming in from a supplier). */
  available: number | null;
  /** Last purchase price, used as the default cost of a receipt line. */
  lastCost: number | null;
  /** Receipt only: total stock now and its average purchase price (to preview the new average). */
  quantity?: number;
  avgCost?: number | null;
  lastSupplier?: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Managers only.
 * - /inventory/warehouses/:id/move?type=RECEIVE|ISSUE|RETURN&repId=
 * - /inventory/receive?productId=&supplierId= (receipt, warehouse picked in the form)
 */
@Component({
  selector: 'app-stock-move-form',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, SupplierPickerComponent],
  templateUrl: './stock-move-form.component.html',
})
export class StockMoveFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly inventory = inject(InventoryService);
  private readonly productService = inject(ProductService);

  /** Warehouse from the route; absent on /inventory/receive. */
  readonly id = input<string>();
  /** Query param. Router input binding sets a missing param to undefined, so default in `kind`. */
  readonly type = input<ManualMovement>();
  protected readonly kind = computed<ManualMovement>(() => this.type() ?? MovementType.RECEIVE);
  readonly repId = input<string>();
  readonly productId = input<string>();
  readonly supplierId = input<string>();

  protected readonly MovementType = MovementType;
  protected readonly typeLabels = MOVEMENT_TYPE_LABELS;
  protected readonly unitLabels = PRODUCT_UNIT_LABELS;
  protected readonly isReceive = computed(() => this.kind() === MovementType.RECEIVE);
  protected readonly needsRep = computed(() => !this.isReceive());

  protected readonly form = this.fb.group({
    warehouseId: ['', Validators.required],
    supplierId: [''],
    repId: [''],
    items: this.fb.array([this.newItem()]),
    notes: [''],
  });
  protected readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly warehouses = rxResource({
    stream: () => this.inventory.getWarehouses().pipe(map((list) => list.filter((w) => w.isActive || w.id === this.id()))),
  });
  protected readonly details = rxResource({
    params: () => this.value().warehouseId || undefined,
    stream: ({ params }) => this.inventory.getWarehouse(params),
  });
  protected readonly products = rxResource({
    params: () => (this.isReceive() ? true : undefined),
    stream: () => this.productService.getProducts({ active: true }),
  });

  /** Products that can be picked, with the quantity available at the source. */
  protected readonly options = computed<Option[]>(() => {
    if (this.isReceive()) {
      return (this.products.value() ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        available: null,
        lastCost: p.lastCost ?? null,
        quantity: p.quantity,
        avgCost: p.avgCost ?? null,
        lastSupplier: p.lastSupplier?.name ?? null,
      }));
    }
    const d = this.details.value();
    if (!d) return [];
    const rows =
      this.kind() === MovementType.ISSUE
        ? d.stock
        : (d.reps.find((r) => r.rep.id === this.value().repId)?.custody ?? []);
    return rows.map((r) => ({ id: r.product.id, name: r.product.name, unit: r.product.unit, available: r.quantity, lastCost: null }));
  });
  private readonly optionById = computed(() => new Map(this.options().map((o) => [o.id, o])));

  protected readonly lineErrors = computed(() =>
    (this.value().items ?? []).map((item) => {
      const available = item.productId ? this.optionById().get(item.productId)?.available : null;
      return available != null && Number(item.quantity) > available ? available : null;
    }),
  );
  protected readonly hasLineError = computed(() => this.lineErrors().some((e) => e !== null));

  /** Receipt only: cost per line and grand total. */
  protected readonly lineTotals = computed(() =>
    (this.value().items ?? []).map((i) => round2((Number(i.quantity) || 0) * (Number(i.unitCost) || 0))),
  );
  /**
   * Receipt only: current stock / prices per line and the average after saving
   * (same weighted moving average as the backend).
   */
  protected readonly costPreviews = computed(() =>
    (this.value().items ?? []).map((i) => {
      const o = this.isReceive() && i.productId ? this.optionById().get(i.productId) : undefined;
      if (!o) return null;
      const oldQty = Math.max(o.quantity ?? 0, 0);
      const qty = Number(i.quantity) || 0;
      const cost = i.unitCost === null || i.unitCost === undefined || (i.unitCost as unknown) === '' ? null : Number(i.unitCost);
      const newAvg =
        cost === null ? null : oldQty > 0 && o.avgCost != null ? round2((oldQty * o.avgCost + qty * cost) / (oldQty + qty)) : cost;
      return { oldQty, newQty: oldQty + qty, avgCost: o.avgCost ?? null, lastCost: o.lastCost, lastSupplier: o.lastSupplier ?? null, newAvg };
    }),
  );
  protected readonly grandTotal = computed(() => round2(this.lineTotals().reduce((s, t) => s + t, 0)));
  protected readonly missingCost = computed(
    () => this.isReceive() && (this.value().items ?? []).some((i) => i.unitCost === null || i.unitCost === undefined || (i.unitCost as unknown) === ''),
  );

  protected readonly canSubmit = computed(() => {
    const v = this.value();
    if (this.hasLineError() || this.missingCost()) return false;
    if (this.needsRep() && !v.repId) return false;
    if (this.isReceive() && !v.supplierId) return false;
    return true;
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // A preselected product (from the products page) gets its last purchase price once options load.
    const stop = effect(() => {
      if (!this.options().length || !this.productId()) return;
      this.onProductChange(0);
      stop.destroy();
    });
  }

  ngOnInit(): void {
    // Query / route params preselect the warehouse, rep, supplier and first product.
    this.form.patchValue({
      warehouseId: this.id() ?? '',
      repId: this.repId() ?? '',
      supplierId: this.supplierId() ?? '',
    });
    if (this.productId()) this.items.at(0).controls.productId.setValue(this.productId()!);
  }

  protected get items() {
    return this.form.controls.items;
  }

  private newItem() {
    return this.fb.group({
      productId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
      unitCost: [null as number | null, Validators.min(0)],
    });
  }

  protected addItem(): void {
    this.items.push(this.newItem());
  }

  protected removeItem(index: number): void {
    this.items.removeAt(index);
  }

  /** Receipt: default the purchase price to the product's last one. */
  protected onProductChange(index: number): void {
    if (!this.isReceive()) return;
    const row = this.items.at(index).controls;
    const lastCost = this.optionById().get(row.productId.value)?.lastCost;
    if (lastCost != null && row.unitCost.value === null) row.unitCost.setValue(lastCost);
  }

  /** Reset lines when the rep or warehouse changes: the source stock is different. */
  protected resetLines(): void {
    if (this.isReceive()) return;
    this.items.clear();
    this.addItem();
  }

  protected isTaken(productId: string, rowIndex: number): boolean {
    return (this.value().items ?? []).some((item, i) => i !== rowIndex && item.productId === productId);
  }

  protected submit(): void {
    const v = this.form.getRawValue();
    if (this.form.invalid || !this.canSubmit() || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.inventory
      .move(v.warehouseId, this.kind(), {
        ...(this.needsRep() && { repId: v.repId }),
        ...(this.isReceive() && { supplierId: v.supplierId }),
        items: v.items.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          ...(this.isReceive() && { unitCost: Number(i.unitCost) }),
        })),
        notes: v.notes.trim() || null,
      })
      .subscribe({
        next: () => this.router.navigate(['/inventory/warehouses', v.warehouseId]),
        error: (err: unknown) => {
          this.saving.set(false);
          this.error.set(httpErrorMessage(err, 'تعذر حفظ الحركة. حاول مرة أخرى.'));
        },
      });
  }
}
