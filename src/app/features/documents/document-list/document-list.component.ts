import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import {
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
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, StatusMessageComponent],
  templateUrl: './document-list.component.html',
})
export class DocumentListComponent {
  private readonly documents = inject(DocumentsService);

  protected readonly isManager = inject(AuthService).hasRole(UserRole.OWNER, UserRole.ADMIN);
  /** Reps never see purchases. */
  protected readonly types = Object.values(DocumentType).filter((t) => this.isManager || t !== DocumentType.PURCHASE);
  protected readonly typeLabels = DOCUMENT_TYPE_LABELS;
  protected readonly typeClasses = DOCUMENT_TYPE_CLASSES;
  protected readonly partyLabels = PARTY_LABELS;
  protected readonly detailsLink = detailsLink;

  protected readonly type = signal<DocumentType | ''>('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly search = signal('');
  private readonly debouncedSearch = toSignal(toObservable(this.search).pipe(debounceTime(300)), { initialValue: '' });

  protected readonly list = rxResource({
    params: (): DocumentFilters => ({
      ...(this.type() && { type: this.type() as DocumentType }),
      ...(this.from() && { from: this.from() }),
      ...(this.to() && { to: this.to() }),
      ...(this.debouncedSearch().trim() && { search: this.debouncedSearch().trim() }),
    }),
    stream: ({ params }) => this.documents.getDocuments(params),
  });

  protected readonly hasFilters = computed(() => !!(this.type() || this.from() || this.to() || this.search()));
  protected readonly total = computed(() =>
    (this.list.value() ?? []).filter((d) => d.status === 'ACTIVE').reduce((s, d) => s + (d.amount ?? 0), 0),
  );

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
