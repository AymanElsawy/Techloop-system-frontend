import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { DatePipe, arabicDigits } from '../../shared/date.pipe';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response';
import { UserRole } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { StatusMessageComponent } from '../../shared/components/status-message/status-message.component';
import { PAYMENT_METHOD_LABELS, PaymentMethod } from '../invoices/models/invoice.model';
import { VISIT_STATUS_CLASSES, VISIT_STATUS_LABELS, VisitStatus } from '../visits/models/visit.model';
import { DepositStatus } from '../treasury/models/treasury.model';

type Ref = { id: string; name: string };
type Money = { total: number; count: number };

/** GET /dashboard. Manager-only parts are missing for reps and the other way round. */
interface Dashboard {
  sales: { today: Money; month: Money };
  collected: { today: number; month: number };
  daily: { day: string; sales: number; collected: number }[];
  visits: {
    today: Record<VisitStatus, number>;
    monthCompleted: number;
    list: { id: string; scheduledAt: string; status: VisitStatus; customer: Ref & { governorate: string }; salesRep: Ref }[];
  };
  customers: {
    total: number;
    pendingApproval: number;
    debt: number;
    debtors: number;
    pendingPayments: number;
    topDebtors: { id: string; name: string; governorate: string; debit: number; pendingPayments: number; lastCollection: { date: string } | null }[];
  };
  cheques: {
    kind: 'INVOICE' | 'COLLECTION';
    id: string;
    number: string;
    customer: Ref;
    amount: number;
    chequeNumber: string | null;
    dueDate: string;
    depositStatus: DepositStatus | null;
  }[];
  recentInvoices: { id: string; invoiceNumber: string; customer: Ref; createdBy: Ref; total: number; remaining: number; status: string; createdAt: string }[];
  // Sales rep
  cashBox?: { total: number; count: number };
  custody?: { items: number; quantity: number };
  // Managers
  treasury?: { total: number; byMethod: { method: PaymentMethod; total: number; count: number }[]; withReps: number };
  stock?: { products: number; value: number; lowStock: { id: string; name: string; unit: string | null; quantity: number; minQuantity: number }[] };
  suppliers?: { debt: number; count: number };
  reps?: { id: string; name: string; sales: number; invoices: number; collected: number; visitsCompleted: number; visitsToday: number; cashHeld: number; salesProgress: number | null; collectionProgress: number | null; commission: number; yearSalesProgress: number | null; yearCollectionProgress: number | null }[];
}

const dayKey = (d: Date) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD, local time like the API

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, StatusMessageComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  protected readonly isManager = this.auth.hasRole(UserRole.OWNER, UserRole.ADMIN);
  protected readonly userName = computed(() => this.auth.currentUser()?.name ?? '');
  protected readonly today = new Date();
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly visitLabels = VISIT_STATUS_LABELS;
  protected readonly visitClasses = VISIT_STATUS_CLASSES;
  protected readonly visitStatuses = Object.values(VisitStatus).filter((s) => s !== VisitStatus.CANCELLED);
  protected readonly Pending = DepositStatus.PENDING;

  protected readonly data = rxResource({
    stream: () =>
      this.http.get<ApiResponse<Dashboard>>(`${environment.apiUrl}/dashboard`).pipe(map(({ data }) => data)),
  });

  /** Every day of the month so far, with bar heights as % of the busiest day. */
  protected readonly chart = computed(() => {
    const daily = new Map((this.data.value()?.daily ?? []).map((d) => [d.day, d]));
    const days = Array.from({ length: this.today.getDate() }, (_, i) => {
      const key = dayKey(new Date(this.today.getFullYear(), this.today.getMonth(), i + 1));
      return { day: i + 1, label: arabicDigits(String(i + 1)), sales: daily.get(key)?.sales ?? 0, collected: daily.get(key)?.collected ?? 0 };
    });
    const max = Math.max(1, ...days.flatMap((d) => [d.sales, d.collected]));
    return days.map((d) => ({ ...d, salesPct: (d.sales / max) * 100, collectedPct: (d.collected / max) * 100 }));
  });

  protected readonly visitsToday = computed(() => {
    const t = this.data.value()?.visits.today;
    return t ? t.PLANNED + t.IN_PROGRESS + t.COMPLETED : 0;
  });

  protected daysUntil(date: string): number {
    const start = new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());
    return Math.round((new Date(date).getTime() - start.getTime()) / 86_400_000);
  }
}
