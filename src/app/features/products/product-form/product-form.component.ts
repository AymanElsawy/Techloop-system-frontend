import { Component, OnInit, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { httpErrorMessage } from '../../../core/http/http-error';
import { PRODUCT_UNIT_LABELS, ProductInput, ProductUnit } from '../models/product.model';
import { ProductService } from '../services/product.service';
import { SupplierPickerComponent } from '../../suppliers/supplier-picker/supplier-picker.component';

const WHOLE_NUMBER = /^\d+$/;

/** Create (/products/new) and edit (/products/:id/edit). Owner/Admin only. */
@Component({
  selector: 'app-product-form',
  imports: [ReactiveFormsModule, RouterLink, SupplierPickerComponent],
  templateUrl: './product-form.component.html',
})
export class ProductFormComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);

  /** Route param; set only in edit mode. */
  readonly id = input<string>();

  protected readonly units = Object.values(ProductUnit);
  protected readonly unitLabels = PRODUCT_UNIT_LABELS;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    price: [null as number | null, [Validators.required, Validators.min(0)]],
    unit: ['' as ProductUnit | ''],
    supplierId: [''],
    code: [''],
    minQuantity: [null as number | null, [Validators.min(0), Validators.pattern(WHOLE_NUMBER)]],
    manufacturer: [''],
    expiryDate: [''],
    notes: [''],
    isActive: [true],
  });

  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const id = this.id();
    if (!id) return;
    this.loading.set(true);
    this.loadError.set(false);
    this.productService.getProduct(id).subscribe({
      next: (p) => {
        this.form.setValue({
          name: p.name,
          price: p.price,
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
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);

    const v = this.form.getRawValue();
    // Empty strings clear optional fields on the backend.
    const data: ProductInput = {
      ...v,
      price: v.price!,
      unit: v.unit || null,
      supplierId: v.supplierId || null,
      expiryDate: v.expiryDate || null,
    };
    const id = this.id();
    const request = id ? this.productService.updateProduct(id, data) : this.productService.createProduct(data);

    request.subscribe({
      // A new product has no stock yet: continue straight to receiving it (from its supplier).
      next: (product) =>
        id
          ? this.router.navigateByUrl('/inventory/products')
          : this.router.navigate(['/inventory/receive'], {
              queryParams: { productId: product.id, supplierId: product.supplier?.id },
            }),
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
