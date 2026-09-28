import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { PRODUCT_UNIT_LABELS, ProductFilters, ProductUnit, expiryState, isLowStock } from '../models/product.model';
import { ProductService } from '../services/product.service';
import { InventoryTabsComponent } from '../../inventory/inventory-tabs/inventory-tabs.component';

type ActiveFilter = '' | 'true' | 'false';

@Component({
  selector: 'app-product-list',
  imports: [CurrencyPipe, DatePipe, InventoryTabsComponent, RouterLink, StatusMessageComponent],
  templateUrl: './product-list.component.html',
})
export class ProductListComponent {
  private readonly productService = inject(ProductService);

  protected readonly isManager = inject(AuthService).hasRole(UserRole.OWNER, UserRole.ADMIN);
  protected readonly units = Object.values(ProductUnit);
  protected readonly unitLabels = PRODUCT_UNIT_LABELS;
  protected readonly isLowStock = isLowStock;
  protected readonly expiryState = expiryState;

  protected readonly search = signal('');
  protected readonly unit = signal<ProductUnit | ''>('');
  protected readonly lowStock = signal(false);
  protected readonly active = signal<ActiveFilter>(this.isManager ? 'true' : '');
  private readonly debouncedSearch = toSignal(toObservable(this.search).pipe(debounceTime(300)), {
    initialValue: '',
  });

  protected readonly hasFilters = computed(
    () => !!(this.search() || this.unit() || this.lowStock() || (this.isManager && this.active() !== 'true')),
  );

  protected readonly products = rxResource({
    params: (): ProductFilters => ({
      ...(this.debouncedSearch().trim() && { search: this.debouncedSearch().trim() }),
      ...(this.unit() && { unit: this.unit() as ProductUnit }),
      ...(this.lowStock() && { lowStock: true }),
      ...(this.active() && { active: this.active() === 'true' }),
    }),
    stream: ({ params }) => this.productService.getProducts(params),
  });

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected setUnit(event: Event): void {
    this.unit.set(this.inputValue(event) as ProductUnit | '');
  }

  protected setActive(event: Event): void {
    this.active.set(this.inputValue(event) as ActiveFilter);
  }

  protected toggleLowStock(event: Event): void {
    this.lowStock.set((event.target as HTMLInputElement).checked);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.unit.set('');
    this.lowStock.set(false);
    this.active.set(this.isManager ? 'true' : '');
  }
}
