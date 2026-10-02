import { Component, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { DatePipe } from '../../../shared/date.pipe';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { httpErrorMessage } from '../../../core/http/http-error';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { Backup, Company } from '../documents.model';
import { DocumentsService } from '../documents.service';

/** /documents/company — details printed on every document. Managers only. */
@Component({
  selector: 'app-company-form',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, RouterLink, StatusMessageComponent],
  templateUrl: './company-form.component.html',
})
export class CompanyFormComponent {
  private readonly documents = inject(DocumentsService);

  protected readonly company = rxResource({ stream: () => this.documents.getCompany() });
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    phone: [''],
    address: [''],
    taxNumber: [''],
    commercialRegister: [''],
    footer: [''],
  });
  protected readonly saving = signal(false);

  // Backups: owner only.
  protected readonly isOwner = inject(AuthService).hasRole(UserRole.OWNER);
  protected readonly backups = rxResource({
    stream: () => (this.isOwner ? this.documents.getBackups() : of([] as Backup[])),
  });
  protected readonly backingUp = signal(false);
  protected readonly backupError = signal<string | null>(null);

  protected readonly message = signal<{ ok: boolean; text: string } | null>(null);

  constructor() {
    effect(() => {
      const c = this.company.value();
      if (c) this.form.reset(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? ''])));
    });
  }

  protected save(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.saving.set(true);
    this.message.set(null);
    this.documents.updateCompany(this.form.getRawValue() as Company).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set({ ok: true, text: 'اتحفظت. هتظهر على كل الفواتير.' });
      },
      error: (err) => {
        this.saving.set(false);
        this.message.set({ ok: false, text: httpErrorMessage(err) });
      },
    });
  }

  protected backupNow(): void {
    this.backingUp.set(true);
    this.backupError.set(null);
    this.documents.createBackup().subscribe({
      next: () => {
        this.backingUp.set(false);
        this.backups.reload();
      },
      error: (err) => {
        this.backingUp.set(false);
        this.backupError.set(httpErrorMessage(err, 'تعذر عمل النسخة. اتأكد إن mongodump متسطب على السيرفر.'));
      },
    });
  }

  protected download(b: Backup): void {
    this.documents.downloadBackup(b.name).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: b.name });
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => this.backupError.set(httpErrorMessage(err)),
    });
  }
}
