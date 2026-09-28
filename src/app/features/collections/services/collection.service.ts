import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response';
import { AttachmentKind } from '../../invoices/models/invoice.model';
import { Collection, CreateCollectionRequest } from '../models/collection.model';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/collections`;

  getCollections(filters: { customerId?: string; visitId?: string } = {}): Observable<Collection[]> {
    const params = new HttpParams({ fromObject: { ...filters } });
    return this.http.get<ApiResponse<Collection[]>>(this.url, { params }).pipe(map(({ data }) => data));
  }

  getCollection(id: string): Observable<Collection> {
    return this.http.get<ApiResponse<Collection>>(`${this.url}/${id}`).pipe(map(({ data }) => data));
  }

  createCollection(data: CreateCollectionRequest): Observable<Collection> {
    return this.http.post<ApiResponse<Collection>>(this.url, data).pipe(map(({ data }) => data));
  }

  cancelCollection(id: string, reason: string): Observable<Collection> {
    return this.http
      .patch<ApiResponse<Collection>>(`${this.url}/${id}/cancel`, { reason })
      .pipe(map(({ data }) => data));
  }

  uploadAttachment(id: string, kind: AttachmentKind, file: File): Observable<Collection> {
    const body = new FormData();
    body.append('kind', kind);
    body.append('file', file);
    return this.http
      .post<ApiResponse<Collection>>(`${this.url}/${id}/attachments`, body)
      .pipe(map(({ data }) => data));
  }

  /** Attachments need the auth header, so they are fetched as blobs. */
  downloadAttachment(id: string, attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/attachments/${attachmentId}`, { responseType: 'blob' });
  }
}
