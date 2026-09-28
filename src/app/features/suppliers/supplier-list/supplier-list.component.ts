import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';

import { httpErrorMessage } from '../../../core/http/http-error';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { SupplierService } from '../services/supplier.service';

/** /suppliers — Owner/Admin only. */
@Component({
  selector: 'app-supplier-list',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, StatusMessageComponent],
  templateUrl: './supplier-list.component.html',
})
export class SupplierListComponent {
  private readonly supplierService = inject(SupplierService);

  protected readonly search = signal('');
  private readonly debouncedSearch = toSignal(toObservable(this.search).pipe(debounceTime(300)), { initialValue: '' });
  protected readonly active = signal<'true' | 'false' | ''>('true');

  protected readonly suppliers = rxResource({
    params: () => ({
      ...(this.debouncedSearch().trim() && { search: this.debouncedSearch().trim() }),
      ...(this.active() && { active: this.active() === 'true' }),
    }),
    stream: ({ params }) => this.supplierService.getSuppliers(params),
  });
  protected readonly hasFilters = computed(() => !!this.search() || this.active() !== 'true');

  protected readonly showForm = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phone: [''],
    company: [''],
    address: [''],
    notes: [''],
  });

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected create(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();
    this.supplierService
      .createSupplier({ name: v.name.trim(), phone: v.phone.trim() || null, company: v.company.trim() || null, address: v.address.trim() || null, notes: v.notes.trim() || null })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showForm.set(false);
          this.form.reset();
          this.suppliers.reload();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          const message = httpErrorMessage(err, 'تعذر إضافة المورد.');
          this.error.set(/already in use/.test(message) ? 'فيه مورد بنفس الاسم.' : message);
        },
      });
  }
}
