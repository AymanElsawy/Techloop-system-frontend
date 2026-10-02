import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '../../../shared/date.pipe';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';

import { StatusMessageComponent } from '../../../shared/components/status-message/status-message.component';
import {
  VISIT_PURPOSE_LABELS,
  VISIT_STATUS_CLASSES,
  VISIT_STATUS_LABELS,
  VisitFilters,
  VisitStatus,
} from '../models/visit.model';
import { VisitService } from '../services/visit.service';

type Period = 'today' | 'week' | 'all';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'اليوم' },
  { value: 'week', label: 'هذا الأسبوع' },
  { value: 'all', label: 'الكل' },
];

const EMPTY_MESSAGES: Record<Period, string> = {
  today: 'لا توجد زيارات اليوم.',
  week: 'لا توجد زيارات هذا الأسبوع.',
  all: 'لا توجد زيارات.',
};

/** Week starts on Saturday. */
function periodRange(period: Period): Pick<VisitFilters, 'from' | 'to'> {
  if (period === 'all') return {};
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  if (period === 'week') from.setDate(from.getDate() - ((from.getDay() + 1) % 7));
  const to = new Date(from);
  to.setDate(to.getDate() + (period === 'week' ? 7 : 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

@Component({
  selector: 'app-visit-list',
  imports: [DatePipe, RouterLink, StatusMessageComponent],
  templateUrl: './visit-list.component.html',
})
export class VisitListComponent {
  private readonly visitService = inject(VisitService);

  protected readonly periods = PERIODS;
  protected readonly statuses = Object.values(VisitStatus);
  protected readonly statusLabels = VISIT_STATUS_LABELS;
  protected readonly statusClasses = VISIT_STATUS_CLASSES;
  protected readonly purposeLabels = VISIT_PURPOSE_LABELS;

  protected readonly period = signal<Period>('today');
  protected readonly status = signal<VisitStatus | ''>('');
  protected readonly emptyMessage = computed(() => EMPTY_MESSAGES[this.period()]);

  protected readonly visits = rxResource({
    params: (): VisitFilters => ({
      ...periodRange(this.period()),
      ...(this.status() && { status: this.status() as VisitStatus }),
    }),
    stream: ({ params }) => this.visitService.getVisits(params),
  });

  protected onStatusChange(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as VisitStatus | '');
  }
}
