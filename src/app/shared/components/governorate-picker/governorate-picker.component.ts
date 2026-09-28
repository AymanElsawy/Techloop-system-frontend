import { Component, input, model } from '@angular/core';

import { GOVERNORATES } from '../../../features/customers/models/customer.model';

/** Checkbox grid for choosing a sales rep's governorates (region). */
@Component({
  selector: 'app-governorate-picker',
  template: `
    <fieldset>
      <legend class="form-label">{{ label() }}</legend>
      <div class="mb-2 flex gap-3 text-xs">
        <button type="button" class="text-vibrant-coral-400 hover:underline" (click)="selected.set([...all])">تحديد الكل</button>
        <button type="button" class="text-vibrant-coral-400 hover:underline" (click)="selected.set([])">إلغاء التحديد</button>
        <span class="text-stormy-teal">({{ selected().length }} محافظة)</span>
      </div>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        @for (g of all; track g) {
          <label class="flex cursor-pointer items-center gap-2 rounded-md border border-stormy-teal-900 bg-surface px-2 py-1.5 text-sm has-checked:border-stormy-teal has-checked:bg-stormy-teal-900">
            <input type="checkbox" class="accent-stormy-teal" [checked]="selected().includes(g)" (change)="toggle(g)" />
            {{ g }}
          </label>
        }
      </div>
    </fieldset>
  `,
})
export class GovernoratePickerComponent {
  readonly selected = model<string[]>([]);
  readonly label = input('المحافظات (منطقة المندوب)');

  protected readonly all = GOVERNORATES;

  protected toggle(governorate: string): void {
    this.selected.update((list) =>
      list.includes(governorate) ? list.filter((g) => g !== governorate) : [...list, governorate],
    );
  }
}
