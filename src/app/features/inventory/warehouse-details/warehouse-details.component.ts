import { Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';

import { httpErrorMessage } from '../../../core/http/http-error';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { PRODUCT_UNIT_LABELS } from '../../products/models/product.model';
import { MovementType, Warehouse, totalQuantity } from '../models/inventory.model';
import { InventoryService } from '../services/inventory.service';
import { InventoryTabsComponent } from '../inventory-tabs/inventory-tabs.component';

/** /inventory/warehouses/:id — main stock, reps with their custody, and stock actions. Managers only. */
@Component({
  selector: 'app-warehouse-details',
  imports: [InventoryTabsComponent, ReactiveFormsModule, RouterLink, StatusMessageComponent],
  templateUrl: './warehouse-details.component.html',
})
export class WarehouseDetailsComponent {
  private readonly inventory = inject(InventoryService);

  readonly id = input.required<string>();

  protected readonly MovementType = MovementType;
  protected readonly unitLabels = PRODUCT_UNIT_LABELS;
  protected readonly totalQuantity = totalQuantity;

  protected readonly details = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.inventory.getWarehouse(params),
  });

  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    notes: [''],
  });

  protected startEdit(w: Warehouse): void {
    this.form.setValue({ name: w.name, notes: w.notes ?? '' });
    this.error.set(null);
    this.editing.set(true);
  }

  protected save(data: Partial<Pick<Warehouse, 'name' | 'notes' | 'isActive'>>): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.inventory.updateWarehouse(this.id(), data).subscribe({
      next: (warehouse) => {
        this.saving.set(false);
        this.editing.set(false);
        this.details.update((d) => (d ? { ...d, warehouse } : d));
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(httpErrorMessage(err, 'تعذر حفظ المخزن.'));
      },
    });
  }

  protected saveEdit(): void {
    if (this.form.invalid) return;
    const { name, notes } = this.form.getRawValue();
    this.save({ name: name.trim(), notes: notes.trim() || null });
  }
}
