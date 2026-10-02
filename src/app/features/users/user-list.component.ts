import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '../../shared/date.pipe';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';

import { ROLE_LABELS, UserRole } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { httpErrorMessage } from '../../core/http/http-error';
import { StatusMessageComponent } from '../../shared/components/status-message/status-message.component';
import { GovernoratePickerComponent } from '../../shared/components/governorate-picker/governorate-picker.component';
import { ManagedUser, UserService } from './user.service';
import { InventoryService } from '../inventory/services/inventory.service';

@Component({
  selector: 'app-user-list',
  imports: [DatePipe, GovernoratePickerComponent, ReactiveFormsModule, RouterLink, StatusMessageComponent],
  templateUrl: './user-list.component.html',
})
export class UserListComponent {
  private readonly userService = inject(UserService);
  private readonly auth = inject(AuthService);

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly UserRole = UserRole;
  private readonly inventory = inject(InventoryService);
  protected readonly users = rxResource({ stream: () => this.userService.getUsers() });
  protected readonly warehouses = rxResource({ stream: () => this.inventory.getWarehouses() });

  /** Saves right away; the backend refuses while the rep still holds custody. */
  protected changeWarehouse(user: ManagedUser, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const warehouse = select.value || null;
    this.feedback.set(null);
    this.userService.setWarehouse(user.id, warehouse).subscribe({
      next: (updated) => {
        this.users.update((list) => list?.map((u) => (u.id === updated.id ? updated : u)));
        this.feedback.set({ ok: true, message: `تم تحديث مخزن ${user.name}.` });
      },
      error: (err: unknown) => {
        select.value = user.warehouse ?? '';
        const message = httpErrorMessage(err, 'تعذر تحديث المخزن.');
        this.feedback.set({
          ok: false,
          message: /custody/.test(message) ? `${user.name} معه بضاعة في عهدته. سجّل المرتجع أولاً ثم غيّر المخزن.` : message,
        });
      },
    });
  }

  /** Row currently showing the set-password form. */
  protected readonly passwordUserId = signal<string | null>(null);
  protected readonly password = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(8)],
  });
  protected readonly saving = signal(false);
  protected readonly feedback = signal<{ ok: boolean; message: string } | null>(null);

  /** Row currently editing the rep's governorates. */
  protected readonly regionUserId = signal<string | null>(null);
  protected readonly regionDraft = signal<string[]>([]);

  protected openRegion(user: ManagedUser): void {
    this.feedback.set(null);
    this.passwordUserId.set(null);
    this.regionDraft.set([...user.governorates]);
    this.regionUserId.set(user.id);
  }

  protected saveRegion(user: ManagedUser): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.userService.setGovernorates(user.id, this.regionDraft()).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.regionUserId.set(null);
        this.users.update((list) => list?.map((u) => (u.id === updated.id ? updated : u)));
        this.feedback.set({ ok: true, message: `تم تحديث محافظات ${user.name}.` });
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.feedback.set({ ok: false, message: httpErrorMessage(err, 'تعذر تحديث المحافظات.') });
      },
    });
  }

  /** Only an owner may change an owner's password (enforced by the backend too). */
  protected canSetPassword(user: ManagedUser): boolean {
    return user.role !== UserRole.OWNER || this.auth.hasRole(UserRole.OWNER);
  }

  protected openPasswordForm(user: ManagedUser): void {
    this.regionUserId.set(null);
    this.password.reset();
    this.feedback.set(null);
    this.passwordUserId.set(user.id);
  }

  protected savePassword(event: Event, user: ManagedUser): void {
    // Plain <form> (no NgForm here): stop the native submit from reloading the page.
    event.preventDefault();
    if (this.password.invalid || this.saving()) return;
    this.saving.set(true);
    this.userService.setPassword(user.id, this.password.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.passwordUserId.set(null);
        this.feedback.set({ ok: true, message: `تم تعيين كلمة مرور جديدة لـ ${user.name}.` });
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.feedback.set({ ok: false, message: httpErrorMessage(err, 'تعذر تعيين كلمة المرور.') });
      },
    });
  }
}
