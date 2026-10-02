import { Component, inject, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { DatePipe } from '../../../shared/date.pipe';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';

import { UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { httpErrorMessage } from '../../../core/http/http-error';
import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import { ReturnStatus } from '../returns.model';
import { ReturnsService } from '../returns.service';

/** /returns/:id — one فاتورة مرتجع; managers can cancel it. */
@Component({
  selector: 'app-return-details',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, StatusMessageComponent],
  templateUrl: './return-details.component.html',
})
export class ReturnDetailsComponent {
  private readonly returns = inject(ReturnsService);

  readonly id = input.required<string>();

  protected readonly isManager = inject(AuthService).hasRole(UserRole.OWNER, UserRole.ADMIN);
  protected readonly Status = ReturnStatus;
  protected readonly doc = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.returns.getReturn(params),
  });

  protected readonly showCancel = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly cancelError = signal<string | null>(null);
  protected readonly cancelReason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3)],
  });

  protected cancel(): void {
    this.cancelling.set(true);
    this.cancelError.set(null);
    this.returns.cancelReturn(this.id(), this.cancelReason.value.trim()).subscribe({
      next: (r) => {
        this.doc.set(r);
        this.cancelling.set(false);
        this.showCancel.set(false);
      },
      error: (err) => {
        this.cancelling.set(false);
        this.cancelError.set(httpErrorMessage(err));
      },
    });
  }
}
