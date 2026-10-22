import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { DatePipe } from '../../../shared/date.pipe';
import { Router, RouterLink } from '@angular/router';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, debounceTime, map } from 'rxjs';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { pagedResource } from '../../../shared/paged';
import { CustomerStatus } from '../../customers/models/customer.model';
import { CustomerService } from '../../customers/services/customer.service';
import { SupplierService } from '../../suppliers/services/supplier.service';
import { UserService } from '../../users/user.service';
import {
  DOCUMENT_CREATE,
  DOCUMENT_TYPE_CLASSES,
  DOCUMENT_TYPE_LABELS,
  DocumentFilters,
  DocumentType,
  PARTY_LABELS,
  detailsLink,
} from '../documents.model';
import { DocumentsService } from '../documents.service';

/** /documents — every printable document: sales, collections, purchases, custody moves, handovers. */
@Component({
  selector: 'app-document-list',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, PagerComponent, RouterLink, StatusMessageComponent],
  templateUrl: './document-list.component.html',
})
export class DocumentListComponent {
  private readonly documents = inject(DocumentsService);
  private readonly router = inject(Router);
  private readonly customerService = inject(CustomerService);
  private readonly userService = inject(UserService);
  private readonly supplierService = inject(SupplierService);

  protected readonly isManager = inject(AuthService).hasRole(UserRole.OWNER, UserRole.ADMIN);
  /** Reps never see purchases or supplier returns. */
  protected readonly types = Object.values(DocumentType).filter(
    (t) => this.isManager || (t !== DocumentType.PURCHASE && t !== DocumentType.SUPPLIER_RETURN),
  );
  protected readonly typeLabels = DOCUMENT_TYPE_LABELS;
  protected readonly typeClasses = DOCUMENT_TYPE_CLASSES;
  protected readonly partyLabels = PARTY_LABELS;
  protected readonly detailsLink = detailsLink;

  protected readonly type = signal<DocumentType | ''>('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly search = signal('');
  private readonly debouncedSearch = toSignal(toObservable(this.search).pipe(debounceTime(300)), { initialValue: '' });

  protected readonly list = pagedResource(
    (): DocumentFilters => ({
      ...(this.type() && { type: this.type() as DocumentType }),
      ...(this.from() && { from: this.from() }),
      ...(this.to() && { to: this.to() }),
      ...(this.debouncedSearch().trim() && { search: this.debouncedSearch().trim() }),
    }),
    (params) => this.documents.getDocumentsPage(params),
  );

  /** Picking the customer / rep a new document needs; closes when the tab changes. */
  protected readonly picking = linkedSignal({ source: this.type, computation: () => false });
  protected readonly createLabel = computed(() => (this.type() ? DOCUMENT_TYPE_LABELS[this.type() as DocumentType] : ''));
  protected readonly partyPrompt = computed(() =>
    ({ rep: 'اختر المندوب', supplier: 'اختر المورد', customer: 'اختر العميل' })[this.createParty() ?? 'customer'],
  );
  protected readonly createParty = computed(() => (this.type() ? DOCUMENT_CREATE[this.type() as DocumentType].party : undefined));
  protected readonly parties = rxResource({
    params: () => (this.picking() ? (this.type() as DocumentType) : undefined),
    stream: ({ params: type }): Observable<{ id: string; name: string }[]> =>
      DOCUMENT_CREATE[type].party === 'supplier'
        ? this.supplierService.getSuppliers()
        : DOCUMENT_CREATE[type].party === 'rep'
        ? this.userService.getUsers().pipe(map((users) => users.filter((u) => u.role === UserRole.SALES_REP && u.isActive)))
        : this.customerService.getCustomers().pipe(
            // Rejected customers can still pay (collection) but not buy or return.
            map((list) => list.filter((c) => type === DocumentType.COLLECTION || c.status !== CustomerStatus.REJECTED)),
          ),
  });

  protected create(): void {
    const type = this.type() as DocumentType;
    if (DOCUMENT_CREATE[type].party) this.picking.set(true);
    else this.router.navigateByUrl(DOCUMENT_CREATE[type].link(''));
  }

  protected openFor(partyId: string): void {
    if (partyId) this.router.navigateByUrl(DOCUMENT_CREATE[this.type() as DocumentType].link(partyId));
  }

  protected readonly hasFilters = computed(() => !!(this.type() || this.from() || this.to() || this.search()));

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected clear(): void {
    this.type.set('');
    this.from.set('');
    this.to.set('');
    this.search.set('');
  }
}
