import { linkedSignal, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, map } from 'rxjs';

import { ApiResponse, Page, PageParams } from '../core/models/api-response';

/** GET one page of a list endpoint; empty filter values are dropped. */
export function getPage<T>(http: HttpClient, url: string, query: object): Observable<Page<T>> {
  const params = new HttpParams({
    fromObject: Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== '')),
  });
  return http
    .get<ApiResponse<T[]>>(url, { params })
    .pipe(map(({ data, meta }) => ({ items: data, total: meta?.total ?? data.length, sum: meta?.sum })));
}

/**
 * A paged list for a table: changing the filters or the page size goes back to page 1.
 * Call from a field initializer (injection context).
 */
export function pagedResource<F extends object, P extends Page<unknown>>(
  filters: () => F,
  load: (params: F & PageParams) => Observable<P>, // P: a Page, maybe with extra totals
) {
  const limit = signal(20);
  const page = linkedSignal({ source: () => ({ ...filters(), limit: limit() }), computation: () => 1 });
  const resource = rxResource({
    params: () => ({ ...filters(), page: page(), limit: limit() }),
    stream: ({ params }) => load(params),
  });
  /** rxResource drops its value when the params change; keep the last page on screen while the next one loads. */
  const value = linkedSignal<P | undefined, P | undefined>({
    source: () => (resource.hasValue() ? resource.value() : undefined),
    computation: (next, prev) => next ?? prev?.value,
  });
  return { page, limit, resource, value };
}
