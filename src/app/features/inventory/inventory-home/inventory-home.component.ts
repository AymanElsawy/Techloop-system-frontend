import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { httpErrorMessage } from '../../../core/http/http-error';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { PRODUCT_UNIT_LABELS } from '../../products/models/product.model';
import { totalQuantity } from '../models/inventory.model';
import { InventoryService } from '../services/inventory.service';
import { InventoryTabsComponent } from '../inventory-tabs/inventory-tabs.component';

/** /inventory — managers see the warehouses; a sales rep sees their custody and warehouse stock. */
@Component({
  selector: 'app-inventory-home',
  imports: [InventoryTabsComponent, ReactiveFormsModule, RouterLink, StatusMessageComponent],
  templateUrl: './inventory-home.component.html',
})
export class InventoryHomeComponent {
  private readonly inventory = inject(InventoryService);

  protected readonly isManager = inject(AuthService).hasRole(UserRole.OWNER, UserRole.ADMIN);
  protected readonly unitLabels = PRODUCT_UNIT_LABELS;
  protected readonly totalQuantity = totalQuantity;

  protected readonly warehouses = rxResource({
    params: () => this.isManager || undefined,
    stream: () => this.inventory.getWarehouses(),
  });
  protected readonly myStock = rxResource({
    params: () => !this.isManager || undefined,
    stream: () => this.inventory.getMyStock(),
  });

  protected readonly showForm = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    notes: [''],
  });

  protected create(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const { name, notes } = this.form.getRawValue();
    this.inventory.createWarehouse({ name: name.trim(), notes: notes.trim() || null }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.form.reset();
        this.warehouses.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(httpErrorMessage(err, 'تعذر إضافة المخزن.'));
      },
    });
  }
}
