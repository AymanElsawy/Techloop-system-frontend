import { Component, inject, input, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';

import { httpErrorMessage } from '../../../core/http/http-error';
import { SupplierService } from '../services/supplier.service';

/** Active-supplier select with a "+ مورد جديد" quick-add (name + phone) that selects the new supplier. */
@Component({
  selector: 'app-supplier-picker',
  imports: [ReactiveFormsModule],
  templateUrl: './supplier-picker.component.html',
})
export class SupplierPickerComponent {
  private readonly supplierService = inject(SupplierService);

  /** Holds the supplier id ('' = none). */
  readonly control = input.required<FormControl<string>>();
  readonly required = input(false);

  protected readonly suppliers = rxResource({ stream: () => this.supplierService.getSuppliers({ active: true }) });

  protected readonly showForm = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phone: [''],
  });

  protected add(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const { name, phone } = this.form.getRawValue();
    this.supplierService
      .createSupplier({ name: name.trim(), phone: phone.trim() || null, company: null, address: null, notes: null })
      .subscribe({
        next: (s) => {
          this.saving.set(false);
          this.showForm.set(false);
          this.form.reset();
          this.suppliers.update((list) => [...(list ?? []), s].sort((a, b) => a.name.localeCompare(b.name, 'ar')));
          this.control().setValue(s.id);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          const message = httpErrorMessage(err, 'تعذر إضافة المورد.');
          this.error.set(/already in use/.test(message) ? 'فيه مورد بنفس الاسم. اختاره من القائمة.' : message);
        },
      });
  }
}
