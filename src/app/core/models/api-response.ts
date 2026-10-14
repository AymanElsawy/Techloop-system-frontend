export interface ApiResponse<T> {
  success: boolean;
  data: T;
  /** Only on lists requested with `?page=`. `sum`: documents only. */
  meta?: { page: number; limit: number; total: number; sum?: number };
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

/** One page of a list plus the total row count across every page. */
export interface Page<T> {
  items: T[];
  total: number;
  sum?: number;
}

export interface PageParams {
  page: number;
  limit: number;
}
