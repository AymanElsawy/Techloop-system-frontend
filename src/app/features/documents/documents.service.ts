import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response';
import { Movement } from '../inventory/models/inventory.model';
import { Backup, Company, DocumentFilters, DocumentRow } from './documents.model';

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  getDocuments(filters: DocumentFilters): Observable<DocumentRow[]> {
    const params = new HttpParams({
      fromObject: Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) as Record<string, string>,
    });
    return this.http.get<ApiResponse<DocumentRow[]>>(`${this.api}/documents`, { params }).pipe(map(({ data }) => data));
  }

  getMovement(id: string): Observable<Movement & { number: number | null }> {
    return this.http
      .get<ApiResponse<Movement & { number: number | null }>>(`${this.api}/inventory/movements/${id}`)
      .pipe(map(({ data }) => data));
  }

  getCompany(): Observable<Company> {
    return this.http.get<ApiResponse<Company>>(`${this.api}/settings/company`).pipe(map(({ data }) => data));
  }

  updateCompany(data: Company): Observable<Company> {
    return this.http.put<ApiResponse<Company>>(`${this.api}/settings/company`, data).pipe(map(({ data }) => data));
  }

  getBackups(): Observable<Backup[]> {
    return this.http.get<ApiResponse<Backup[]>>(`${this.api}/settings/backups`).pipe(map(({ data }) => data));
  }

  createBackup(): Observable<Backup> {
    return this.http.post<ApiResponse<Backup>>(`${this.api}/settings/backups`, {}).pipe(map(({ data }) => data));
  }

  downloadBackup(name: string): Observable<Blob> {
    return this.http.get(`${this.api}/settings/backups/${name}`, { responseType: 'blob' });
  }
}
