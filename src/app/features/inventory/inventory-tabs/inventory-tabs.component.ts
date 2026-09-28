import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';

/** Sub-navigation shared by every page under "المخزن". */
@Component({
  selector: 'app-inventory-tabs',
  host: { class: 'block' },
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-stormy-teal-900" aria-label="أقسام المخزن">
      @for (tab of tabs; track tab.path) {
        <a
          [routerLink]="tab.path"
          routerLinkActive="border-vibrant-coral-400! text-yale-blue!"
          [routerLinkActiveOptions]="{ exact: tab.exact }"
          ariaCurrentWhenActive="page"
          class="-mb-px whitespace-nowrap border-b-2 border-transparent px-4 py-2.5 text-sm font-semibold text-stormy-teal-400 transition hover:text-yale-blue"
        >
          {{ tab.label }}
        </a>
      }
    </nav>
  `,
})
export class InventoryTabsComponent {
  private readonly isManager = inject(AuthService).hasRole(UserRole.OWNER, UserRole.ADMIN);

  protected readonly tabs = [
    { label: this.isManager ? 'المخازن' : 'عهدتي', path: '/inventory', exact: true },
    { label: 'الأصناف', path: '/inventory/products', exact: false },
    { label: 'سجل الحركات', path: '/inventory/movements', exact: false },
  ];
}
