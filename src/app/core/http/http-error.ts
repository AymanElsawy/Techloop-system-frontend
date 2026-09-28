import { HttpErrorResponse } from '@angular/common/http';

/** Arabic user-facing message for a failed API call. */
export function httpErrorMessage(error: unknown, fallback = 'حدث خطأ غير متوقع. حاول مرة أخرى.'): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'تعذر الاتصال بالخادم. تحقق من الاتصال بالإنترنت.';
    if (error.status === 403) return 'ليس لديك صلاحية لتنفيذ هذا الإجراء.';
    if (error.status === 404) return 'العنصر المطلوب غير موجود.';
  }
  return fallback;
}
