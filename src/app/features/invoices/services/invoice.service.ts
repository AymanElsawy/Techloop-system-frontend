import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response';
import { AttachmentKind, CreateInvoiceRequest, Invoice } from '../models/invoice.model';

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/invoices`;

  getInvoices(filters: { customerId?: string; visitId?: string } = {}): Observable<Invoice[]> {
    const params = new HttpParams({ fromObject: { ...filters } });
    return this.http.get<ApiResponse<Invoice[]>>(this.url, { params }).pipe(map(({ data }) => data));
  }

  getInvoice(id: string): Observable<Invoice> {
    return this.http.get<ApiResponse<Invoice>>(`${this.url}/${id}`).pipe(map(({ data }) => data));
  }

  createInvoice(data: CreateInvoiceRequest): Observable<Invoice> {
    return this.http.post<ApiResponse<Invoice>>(this.url, data).pipe(map(({ data }) => data));
  }

  cancelInvoice(id: string, reason: string): Observable<Invoice> {
    return this.http
      .patch<ApiResponse<Invoice>>(`${this.url}/${id}/cancel`, { reason })
      .pipe(map(({ data }) => data));
  }

  uploadAttachment(id: string, kind: AttachmentKind, file: File): Observable<Invoice> {
    const body = new FormData();
    body.append('kind', kind);
    body.append('file', file);
    return this.http
      .post<ApiResponse<Invoice>>(`${this.url}/${id}/attachments`, body)
      .pipe(map(({ data }) => data));
  }

  /** Attachments need the auth header, so they are fetched as blobs rather than linked directly. */
  downloadAttachment(id: string, attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/attachments/${attachmentId}`, { responseType: 'blob' });
  }
}
