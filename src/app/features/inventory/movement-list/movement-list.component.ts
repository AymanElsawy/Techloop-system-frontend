import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { DatePipe } from '../../../shared/date.pipe';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { MOVEMENT_TYPE_CLASSES, MOVEMENT_TYPE_LABELS, MovementType } from '../models/inventory.model';
import { InventoryService } from '../services/inventory.service';
import { InventoryTabsComponent } from '../inventory-tabs/inventory-tabs.component';

/** /inventory/movements — stock log. Reps only get their own custody movements (backend rule). */
@Component({
  selector: 'app-movement-list',
  imports: [DatePipe, InventoryTabsComponent, RouterLink, StatusMessageComponent],
  templateUrl: './movement-list.component.html',
})
export class MovementListComponent {
  private readonly inventory = inject(InventoryService);

  /** Query params (links from the warehouse page). */
  readonly warehouseId = input<string>();
  readonly repId = input<string>();

  protected readonly isManager = inject(AuthService).hasRole(UserRole.OWNER, UserRole.ADMIN);
  /** Custody papers are printed by the warehouse side; a sales rep only sees the data. */
  protected readonly canPrint = !inject(AuthService).hasRole(UserRole.SALES_REP);
  protected readonly types = Object.values(MovementType);
  /** Movement types that are printable documents of their own; sales print their invoice. */
  protected readonly printType: Partial<Record<MovementType, string>> = !this.canPrint ? {} : {
    [MovementType.RECEIVE]: 'PURCHASE',
    [MovementType.ISSUE]: 'ISSUE',
    [MovementType.RETURN]: 'RETURN',
  };
  protected readonly typeLabels = MOVEMENT_TYPE_LABELS;
  protected readonly typeClasses = MOVEMENT_TYPE_CLASSES;

  protected readonly warehouse = linkedSignal(() => this.warehouseId() ?? '');
  protected readonly rep = linkedSignal(() => this.repId() ?? '');
  protected readonly type = linkedSignal<MovementType | ''>(() => '');

  protected readonly warehouses = rxResource({
    stream: () => (this.isManager ? this.inventory.getWarehouses() : of([])),
  });
  protected readonly movements = rxResource({
    params: () => ({
      ...(this.warehouse() && { warehouseId: this.warehouse() }),
      ...(this.rep() && { repId: this.rep() }),
      ...(this.type() && { type: this.type() as MovementType }),
    }),
    stream: ({ params }) => this.inventory.getMovements(params),
  });

  /** Name of the rep filter, taken from the loaded rows. */
  protected readonly repName = computed(() => this.movements.value()?.find((m) => m.rep)?.rep?.name ?? '');
  protected readonly hasFilters = computed(() => !!(this.warehouse() || this.rep() || this.type()));

  protected selectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected setType(event: Event): void {
    this.type.set(this.selectValue(event) as MovementType | '');
  }

  protected clearFilters(): void {
    this.warehouse.set('');
    this.rep.set('');
    this.type.set('');
  }
}
