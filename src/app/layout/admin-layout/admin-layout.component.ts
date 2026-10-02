import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { switchMap, timer } from 'rxjs';

import { ROLE_LABELS, UserRole } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationsService } from '../../features/notifications/notifications.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles?: UserRole[];
}

const NOT_WAREHOUSE_REP = [UserRole.OWNER, UserRole.ADMIN, UserRole.SALES_REP];

const NAV_ITEMS: NavItem[] = [
  { label: 'الرئيسية', path: '/dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10', roles: NOT_WAREHOUSE_REP },
  {
    label: 'الزيارات',
    path: '/visits',
    icon: 'M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
    roles: NOT_WAREHOUSE_REP,
  },
  { label: 'العملاء', path: '/customers', icon: 'M3 21V8l9-5 9 5v13M9 21v-6h6v6', roles: NOT_WAREHOUSE_REP },
  {
    label: 'المخزن',
    path: '/inventory',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  },
  {
    label: 'الموردين',
    path: '/suppliers',
    icon: 'M3 17h2m14 0h2M5 17a2 2 0 104 0 2 2 0 00-4 0zm10 0a2 2 0 104 0 2 2 0 00-4 0zM3 17V6h11v11m0-7h4l3 3v4',
    roles: [UserRole.OWNER, UserRole.ADMIN],
  },
  {
    label: 'الفواتير',
    path: '/documents',
    icon: 'M9 12h6m-6 4h6M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm7 0v5h5',
    roles: [UserRole.OWNER, UserRole.ADMIN],
  },
  {
    label: 'الخزنة',
    path: '/treasury',
    icon: 'M3 7h18v12H3zM3 7l2-3h14l2 3M12 10v6m-3-3h6',
    roles: NOT_WAREHOUSE_REP,
  },
  {
    label: 'الإشعارات',
    path: '/notifications',
    icon: 'M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  },
  {
    label: 'التقارير',
    path: '/reports',
    icon: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
    roles: [UserRole.OWNER, UserRole.ADMIN],
  },
  {
    label: 'التارجت والعمولات',
    path: '/targets',
    icon: 'M12 21a9 9 0 110-18 9 9 0 010 18zm0-4a5 5 0 110-10 5 5 0 010 10zm0-4a1 1 0 110-2 1 1 0 010 2z',
    roles: [UserRole.OWNER, UserRole.ADMIN],
  },
  {
    label: 'المستخدمون',
    path: '/users',
    icon: 'M17 20h5v-2a4 4 0 00-5-3.87M9 20H2v-2a4 4 0 015-3.87m6-4.13a4 4 0 11-8 0 4 4 0 018 0zm6 2a3 3 0 11-6 0 3 3 0 016 0z',
    roles: [UserRole.OWNER, UserRole.ADMIN],
  },
];

/** App shell: sidebar on desktop, drawer on mobile, header with the current user. */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
  host: { '(document:keydown.escape)': 'menuOpen.set(false)' },
})
export class AdminLayoutComponent {
  private readonly auth = inject(AuthService);

  protected readonly user = this.auth.currentUser;
  protected readonly unread = inject(NotificationsService).unread;
  protected readonly roleLabel = computed(() => {
    const user = this.user();
    return user ? ROLE_LABELS[user.role] : '';
  });
  protected readonly navItems = computed(() =>
    NAV_ITEMS.filter((item) => !item.roles || this.auth.hasRole(...item.roles)),
  );

  constructor() {
    // ponytail: polling, no push; the badge can lag up to a minute.
    const notifications = inject(NotificationsService);
    timer(0, 60_000)
      .pipe(
        switchMap(() => notifications.refreshUnread()),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected readonly menuOpen = signal(false);

  protected readonly dark = signal(document.documentElement.classList.contains('dark'));

  protected toggleTheme(): void {
    this.dark.update((d) => !d);
    document.documentElement.classList.toggle('dark', this.dark());
    try {
      localStorage.setItem('theme', this.dark() ? 'dark' : 'light');
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
  }

  protected logout(): void {
    this.auth.logout();
  }
}
