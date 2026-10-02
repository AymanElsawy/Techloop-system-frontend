import { DatePipe as NgDatePipe } from '@angular/common';
import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';

/**
 * "27/9/2026" -> "٢٧/٩/٢٠٢٦" with Arabic-Indic digits. RLMs around "/" split the numbers into separate
 * right-to-left runs, so the day shows on the right (otherwise the whole date renders left-to-right).
 * Dates only; money and quantities keep Western digits.
 */
export const arabicDigits = (s: string) =>
  s.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]).replace(/\u200F?\/\u200F?/g, '\u200F/\u200F');

/** Drop-in for Angular's `date` pipe that prints Arabic-Indic digits. */
@Pipe({ name: 'date' })
export class DatePipe implements PipeTransform {
  private readonly ng = new NgDatePipe(inject(LOCALE_ID));

  transform(value: Date | string | number | null | undefined, format?: string): string | null {
    const s = this.ng.transform(value, format);
    return s && arabicDigits(s);
  }
}
