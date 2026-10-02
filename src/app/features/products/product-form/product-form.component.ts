import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { httpErrorMessage } from '../../../core/http/http-error';
import { PRODUCT_UNIT_LABELS, ProductInput, ProductUnit } from '../models/product.model';
import { ProductService } from '../services/product.service';
import { SupplierPickerComponent } from '../../suppliers/supplier-picker/supplier-picker.component';
import { InventoryService } from '../../inventory/services/inventory.service';

const WHOLE_NUMBER = /^\d+$/;

/** Create (/products/new) and edit (/products/:id/edit). Owner/Admin only. */
@Component({
  selector: 'app-product-form',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, SupplierPickerComponent],
  templateUrl: './product-form.component.html',
})
export class ProductFormComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);
  private readonly inventory = inject(InventoryService);

  /** Route param; set only in edit mode. */
  readonly id = input<string>();

  protected readonly units = Object.values(ProductUnit);
  protected readonly unitLabels = PRODUCT_UNIT_LABELS;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    price: [null as number | null, [Validators.required, Validators.min(0)]],
    lastCost: [null as number | null, [Validators.required, Validators.min(0)]],
    unit: ['' as ProductUnit | ''],
    supplierId: [''],
    code: [''],
    minQuantity: [null as number | null, [Validators.min(0), Validators.pattern(WHOLE_NUMBER)]],
    manufacturer: [''],
    expiryDate: [''],
    notes: [''],
    isActive: [true],
    // Create only (disabled in edit): the opening stock, received from the supplier.
    warehouseId: ['', Validators.required],
    quantity: [null as number | null, [Validators.required, Validators.min(1), Validators.pattern(WHOLE_NUMBER)]],
    /** Empty = paid in full; the rest becomes supplier debt. */
    paidAmount: [null as number | null, Validators.min(0)],
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly stockTotal = computed(() => (this.value().quantity ?? 0) * (this.value().lastCost ?? 0));
  protected readonly remainingDebt = computed(() => {
    const paid = this.value().paidAmount;
    return paid == null ? 0 : Math.round((this.stockTotal() - paid) * 100) / 100;
  });

  protected readonly warehouses = rxResource({
    params: () => (this.id() ? undefined : true),
    stream: () => this.inventory.getWarehouses().pipe(map((list) => list.filter((w) => w.isActive))),
  });

  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (this.id()) {
      for (const c of ['warehouseId', 'quantity', 'paidAmount'] as const) this.form.controls[c].disable();
    } else {
      // A new product is received from its supplier right away.
      this.form.controls.supplierId.addValidators(Validators.required);
      this.form.controls.supplierId.updateValueAndValidity();
    }
    this.load();
  }

  protected load(): void {
    const id = this.id();
    if (!id) return;
    this.loading.set(true);
    this.loadError.set(false);
    this.productService.getProduct(id).subscribe({
      next: (p) => {
        this.form.patchValue({
          name: p.name,
          price: p.price,
          lastCost: p.lastCost ?? null,
          unit: p.unit ?? '',
          supplierId: p.supplier?.id ?? '',
          code: p.code ?? '',
          minQuantity: p.minQuantity,
          manufacturer: p.manufacturer ?? '',
          expiryDate: p.expiryDate?.slice(0, 10) ?? '',
          notes: p.notes ?? '',
          isActive: p.isActive,
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.remainingDebt() < 0 || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);

    const { warehouseId, quantity, paidAmount, ...v } = this.form.getRawValue();
    const id = this.id();
    // Empty strings clear optional fields on the backend.
    const data: ProductInput = {
      ...v,
      price: v.price!,
      unit: v.unit || null,
      supplierId: v.supplierId || null,
      expiryDate: v.expiryDate || null,
      ...(!id && { stock: { warehouseId, quantity: quantity!, unitCost: v.lastCost!, paidAmount: paidAmount ?? undefined } }),
    };
    const request = id ? this.productService.updateProduct(id, data) : this.productService.createProduct(data);

    request.subscribe({
      next: () => this.router.navigateByUrl('/inventory/products'),
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(
          err instanceof HttpErrorResponse && err.status === 409
            ? 'يوجد صنف آخر بنفس الكود.'
            : httpErrorMessage(err, 'تعذر حفظ الصنف. حاول مرة أخرى.'),
        );
      },
    });
  }
}
