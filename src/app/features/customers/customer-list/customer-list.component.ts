import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { DatePipe } from '../../../shared/date.pipe';
import { Router, RouterLink } from '@angular/router';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import {
  CUSTOMER_STATUS_CLASSES,
  CUSTOMER_STATUS_LABELS,
  CustomerFilters,
  CustomerStatus,
  GOVERNORATES,
  Governorate,
} from '../models/customer.model';
import { CustomerService } from '../services/customer.service';

@Component({
  selector: 'app-customer-list',
  imports: [CurrencyPipe, DatePipe, RouterLink, StatusMessageComponent],
  templateUrl: './customer-list.component.html',
})
export class CustomerListComponent {
  private readonly customerService = inject(CustomerService);
  private readonly router = inject(Router);

  private readonly auth = inject(AuthService);
  protected readonly isManager = this.auth.hasRole(UserRole.OWNER, UserRole.ADMIN);
  /** Reps filter within their own region only. */
  protected readonly governorates = this.isManager ? GOVERNORATES : (this.auth.currentUser()?.governorates ?? []);
  protected readonly noRegion = !this.isManager && !this.governorates.length;
  protected readonly statuses = Object.values(CustomerStatus);
  protected readonly statusLabels = CUSTOMER_STATUS_LABELS;
  protected readonly statusClasses = CUSTOMER_STATUS_CLASSES;

  protected readonly governorate = signal<Governorate | ''>('');
  protected readonly status = signal<CustomerStatus | ''>('');
  protected readonly search = signal('');
  private readonly debouncedSearch = toSignal(toObservable(this.search).pipe(debounceTime(300)), {
    initialValue: '',
  });

  protected readonly hasFilters = computed(() => !!(this.governorate() || this.status() || this.search()));

  protected readonly customers = rxResource({
    params: (): CustomerFilters => ({
      ...(this.governorate() && { governorate: this.governorate() as Governorate }),
      ...(this.status() && { status: this.status() as CustomerStatus }),
      ...(this.debouncedSearch().trim() && { search: this.debouncedSearch().trim() }),
    }),
    stream: ({ params }) => this.customerService.getCustomers(params),
  });

  /** Pending-approval count for the managers' shortcut. */
  protected readonly pending = rxResource({
    params: () => this.isManager || undefined,
    stream: () => this.customerService.getCustomers({ status: CustomerStatus.PENDING }),
  });

  /** Row click; the name stays a real link for keyboard and screen-reader users. */
  protected open(id: string): void {
    this.router.navigate(['/customers', id]);
  }

  protected selectValue(event: Event): string {
    return (event.target as HTMLSelectElement | HTMLInputElement).value;
  }

  protected setGovernorate(event: Event): void {
    this.governorate.set(this.selectValue(event) as Governorate | '');
  }

  protected setStatus(event: Event): void {
    this.status.set(this.selectValue(event) as CustomerStatus | '');
  }

  protected showPending(): void {
    this.status.set(CustomerStatus.PENDING);
  }

  protected clearFilters(): void {
    this.governorate.set('');
    this.status.set('');
    this.search.set('');
  }
}
