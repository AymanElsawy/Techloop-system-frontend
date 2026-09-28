import { Component, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';

import { httpErrorMessage } from '../../../core/http/http-error';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { Movement, MovementType } from '../../inventory/models/inventory.model';
import { InventoryService } from '../../inventory/services/inventory.service';
import { Supplier } from '../models/supplier.model';
import { SupplierService } from '../services/supplier.service';

/** /suppliers/:id — supplier info and everything bought from them. */
@Component({
  selector: 'app-supplier-details',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, StatusMessageComponent],
  templateUrl: './supplier-details.component.html',
})
export class SupplierDetailsComponent {
  private readonly supplierService = inject(SupplierService);
  private readonly inventory = inject(InventoryService);

  readonly id = input.required<string>();

  protected readonly supplier = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.supplierService.getSupplier(params),
  });
  protected readonly purchases = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.inventory.getMovements({ supplierId: params, type: MovementType.RECEIVE }),
  });

  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phone: [''],
    company: [''],
    address: [''],
    notes: [''],
  });

  protected receiptTotal(m: Movement): number {
    return Math.round(m.items.reduce((sum, i) => sum + i.quantity * (i.unitCost ?? 0), 0) * 100) / 100;
  }

  protected startEdit(s: Supplier): void {
    this.form.setValue({ name: s.name, phone: s.phone ?? '', company: s.company ?? '', address: s.address ?? '', notes: s.notes ?? '' });
    this.error.set(null);
    this.editing.set(true);
  }

  protected save(data: Parameters<SupplierService['updateSupplier']>[1]): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.supplierService.updateSupplier(this.id(), data).subscribe({
      next: (s) => {
        this.saving.set(false);
        this.editing.set(false);
        this.supplier.set(s);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const message = httpErrorMessage(err, 'تعذر حفظ المورد.');
        this.error.set(/already in use/.test(message) ? 'فيه مورد بنفس الاسم.' : message);
      },
    });
  }

  protected saveEdit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.save({ name: v.name.trim(), phone: v.phone.trim() || null, company: v.company.trim() || null, address: v.address.trim() || null, notes: v.notes.trim() || null });
  }
}
