import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { httpErrorMessage } from '../../../core/http/http-error';
import { PRODUCT_UNIT_LABELS, ProductUnit } from '../../products/models/product.model';
import { ManualMovement, MOVEMENT_TYPE_LABELS, MovementType } from '../models/inventory.model';
import { InventoryService } from '../services/inventory.service';

interface Option {
  id: string;
  name: string;
  unit: ProductUnit | null;
  available: number;
}

const MANUAL: ManualMovement[] = [MovementType.ISSUE, MovementType.RETURN, MovementType.TRANSFER];

/**
 * Managers only. /inventory/warehouses/:id/move?type=ISSUE|RETURN|TRANSFER&repId=
 * Receipts from suppliers use the purchase form (/documents/purchases/new).
 */
@Component({
  selector: 'app-stock-move-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './stock-move-form.component.html',
})
export class StockMoveFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly inventory = inject(InventoryService);

  /** Warehouse from the route. */
  readonly id = input<string>();
  /** Query param. Router input binding sets a missing param to undefined, so default in `kind`. */
  readonly type = input<string>();
  protected readonly kind = computed<ManualMovement>(
    () => MANUAL.find((t) => t === this.type()) ?? MovementType.ISSUE,
  );
  readonly repId = input<string>();

  protected readonly MovementType = MovementType;
  protected readonly typeLabels = MOVEMENT_TYPE_LABELS;
  protected readonly unitLabels = PRODUCT_UNIT_LABELS;
  protected readonly isTransfer = computed(() => this.kind() === MovementType.TRANSFER);
  protected readonly needsRep = computed(() => !this.isTransfer());
  /** ISSUE and TRANSFER take from the warehouse's main stock. */
  private readonly fromMainStock = computed(() => this.kind() !== MovementType.RETURN);

  protected readonly form = this.fb.group({
    warehouseId: ['', Validators.required],
    repId: [''],
    toWarehouseId: [''], // TRANSFER only
    items: this.fb.array([this.newItem()]),
    notes: [''],
  });
  protected readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly warehouses = rxResource({
    stream: () =>
      this.inventory
        .getWarehouses()
        .pipe(map((list) => list.filter((w) => w.isActive || w.id === this.id()))),
  });
  protected readonly details = rxResource({
    params: () => this.value().warehouseId || undefined,
    stream: ({ params }) => this.inventory.getWarehouse(params),
  });

  /** Products that can be picked, with the quantity available at the source. */
  protected readonly options = computed<Option[]>(() => {
    const d = this.details.value();
    if (!d) return [];
    const rows = this.fromMainStock()
      ? d.stock
      : (d.reps.find((r) => r.rep.id === this.value().repId)?.custody ?? []);
    return rows.map((r) => ({
      id: r.product.id,
      name: r.product.name,
      unit: r.product.unit,
      available: r.quantity,
    }));
  });
  private readonly optionById = computed(() => new Map(this.options().map((o) => [o.id, o])));

  protected readonly lineErrors = computed(() =>
    (this.value().items ?? []).map((item) => {
      const available = item.productId ? this.optionById().get(item.productId)?.available : null;
      return available != null && Number(item.quantity) > available ? available : null;
    }),
  );
  protected readonly hasLineError = computed(() => this.lineErrors().some((e) => e !== null));

  protected readonly canSubmit = computed(() => {
    const v = this.value();
    if (this.hasLineError()) return false;
    if (this.needsRep() && !v.repId) return false;
    if (this.isTransfer() && (!v.toWarehouseId || v.toWarehouseId === v.warehouseId)) return false;
    return true;
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    // Route / query params preselect the warehouse and rep.
    this.form.patchValue({ warehouseId: this.id() ?? '', repId: this.repId() ?? '' });
  }

  protected get items() {
    return this.form.controls.items;
  }

  private newItem() {
    return this.fb.group({
      productId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    });
  }

  protected addItem(): void {
    this.items.push(this.newItem());
  }

  protected removeItem(index: number): void {
    this.items.removeAt(index);
  }

  /** Reset lines when the rep or warehouse changes: the source stock is different. */
  protected resetLines(): void {
    this.items.clear();
    this.addItem();
  }

  protected isTaken(productId: string, rowIndex: number): boolean {
    return (this.value().items ?? []).some(
      (item, i) => i !== rowIndex && item.productId === productId,
    );
  }

  protected submit(): void {
    const v = this.form.getRawValue();
    if (this.form.invalid || !this.canSubmit() || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.inventory
      .move(v.warehouseId, this.kind(), {
        ...(this.needsRep() && { repId: v.repId }),
        ...(this.isTransfer() && { toWarehouseId: v.toWarehouseId }),
        items: v.items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
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
