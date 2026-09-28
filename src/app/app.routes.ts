import { Routes } from '@angular/router';

import { UserRole } from './core/auth/auth.models';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { AdminLayoutComponent } from './layout/admin-layout/admin-layout.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'تسجيل الدخول',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'الرئيسية',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'customers',
        title: 'العملاء',
        loadComponent: () =>
          import('./features/customers/customer-list/customer-list.component').then((m) => m.CustomerListComponent),
      },
      {
        path: 'customers/new',
        title: 'عميل جديد',
        loadComponent: () =>
          import('./features/customers/customer-form/customer-form.component').then((m) => m.CustomerFormComponent),
      },
      {
        path: 'customers/:id',
        title: 'بيانات العميل',
        loadComponent: () =>
          import('./features/customers/customer-details/customer-details.component').then(
            (m) => m.CustomerDetailsComponent,
          ),
      },
      {
        path: 'customers/:id/edit',
        title: 'تعديل العميل',
        loadComponent: () =>
          import('./features/customers/customer-form/customer-form.component').then((m) => m.CustomerFormComponent),
      },
      {
        path: 'visits',
        title: 'الزيارات',
        loadComponent: () =>
          import('./features/visits/visit-list/visit-list.component').then((m) => m.VisitListComponent),
      },
      {
        path: 'visits/new',
        title: 'زيارة جديدة',
        loadComponent: () =>
          import('./features/visits/visit-form/visit-form.component').then((m) => m.VisitFormComponent),
      },
      {
        path: 'visits/:id',
        title: 'تفاصيل الزيارة',
        loadComponent: () =>
          import('./features/visits/visit-details/visit-details.component').then((m) => m.VisitDetailsComponent),
      },
      {
        path: 'customers/:id/invoices/new',
        title: 'فاتورة جديدة',
        loadComponent: () =>
          import('./features/invoices/invoice-form/invoice-form.component').then((m) => m.InvoiceFormComponent),
      },
      {
        path: 'invoices/:id',
        title: 'تفاصيل الفاتورة',
        loadComponent: () =>
          import('./features/invoices/invoice-details/invoice-details.component').then(
            (m) => m.InvoiceDetailsComponent,
          ),
      },
      {
        path: 'customers/:id/collections/new',
        title: 'تحصيل',
        loadComponent: () =>
          import('./features/collections/collection-form/collection-form.component').then(
            (m) => m.CollectionFormComponent,
          ),
      },
      {
        path: 'collections/:id',
        title: 'تفاصيل التحصيل',
        loadComponent: () =>
          import('./features/collections/collection-details/collection-details.component').then(
            (m) => m.CollectionDetailsComponent,
          ),
      },
      {
        path: 'inventory',
        title: 'المخزن',
        loadComponent: () =>
          import('./features/inventory/inventory-home/inventory-home.component').then((m) => m.InventoryHomeComponent),
      },
      {
        path: 'inventory/movements',
        title: 'سجل حركات المخزن',
        loadComponent: () =>
          import('./features/inventory/movement-list/movement-list.component').then((m) => m.MovementListComponent),
      },
      {
        path: 'inventory/warehouses/:id',
        title: 'المخزن',
        canActivate: [roleGuard(UserRole.OWNER, UserRole.ADMIN)],
        loadComponent: () =>
          import('./features/inventory/warehouse-details/warehouse-details.component').then(
            (m) => m.WarehouseDetailsComponent,
          ),
      },
      {
        path: 'inventory/warehouses/:id/move',
        title: 'حركة مخزن',
        canActivate: [roleGuard(UserRole.OWNER, UserRole.ADMIN)],
        loadComponent: () =>
          import('./features/inventory/stock-move-form/stock-move-form.component').then(
            (m) => m.StockMoveFormComponent,
          ),
      },
      {
        path: 'inventory/products',
        title: 'الأصناف',
        loadComponent: () =>
          import('./features/products/product-list/product-list.component').then((m) => m.ProductListComponent),
      },
      {
        path: 'inventory/products/new',
        title: 'صنف جديد',
        canActivate: [roleGuard(UserRole.OWNER, UserRole.ADMIN)],
        loadComponent: () =>
          import('./features/products/product-form/product-form.component').then((m) => m.ProductFormComponent),
      },
      {
        path: 'inventory/products/:id/edit',
        title: 'تعديل صنف',
        canActivate: [roleGuard(UserRole.OWNER, UserRole.ADMIN)],
        loadComponent: () =>
          import('./features/products/product-form/product-form.component').then((m) => m.ProductFormComponent),
      },
      {
        path: 'inventory/receive',
        title: 'وارد من مورد',
        canActivate: [roleGuard(UserRole.OWNER, UserRole.ADMIN)],
        loadComponent: () =>
          import('./features/inventory/stock-move-form/stock-move-form.component').then(
            (m) => m.StockMoveFormComponent,
          ),
      },
      {
        path: 'suppliers',
        title: 'الموردين',
        canActivate: [roleGuard(UserRole.OWNER, UserRole.ADMIN)],
        loadComponent: () =>
          import('./features/suppliers/supplier-list/supplier-list.component').then((m) => m.SupplierListComponent),
      },
      {
        path: 'suppliers/:id',
        title: 'المورد',
        canActivate: [roleGuard(UserRole.OWNER, UserRole.ADMIN)],
        loadComponent: () =>
          import('./features/suppliers/supplier-details/supplier-details.component').then(
            (m) => m.SupplierDetailsComponent,
          ),
      },
      { path: 'products', redirectTo: 'inventory/products' },
      {
        path: 'customers/:id/returns/new',
        title: 'فاتورة مرتجع',
        loadComponent: () =>
          import('./features/returns/return-form/return-form.component').then((m) => m.ReturnFormComponent),
      },
      {
        path: 'returns/:id',
        title: 'فاتورة مرتجع',
        loadComponent: () =>
          import('./features/returns/return-details/return-details.component').then((m) => m.ReturnDetailsComponent),
      },
      {
        path: 'documents',
        title: 'الفواتير',
        loadComponent: () =>
          import('./features/documents/document-list/document-list.component').then((m) => m.DocumentListComponent),
      },
      {
        path: 'documents/company',
        title: 'بيانات الشركة',
        canActivate: [roleGuard(UserRole.OWNER, UserRole.ADMIN)],
        loadComponent: () =>
          import('./features/documents/company-form/company-form.component').then((m) => m.CompanyFormComponent),
      },
      {
        path: 'documents/:type/:id',
        title: 'طباعة مستند',
        loadComponent: () =>
          import('./features/documents/document-print/document-print.component').then((m) => m.DocumentPrintComponent),
      },
      {
        path: 'treasury',
        title: 'الخزنة',
        loadComponent: () =>
          import('./features/treasury/treasury-home/treasury-home.component').then((m) => m.TreasuryHomeComponent),
      },
      {
        path: 'treasury/handover/:repId',
        title: 'استلام من مندوب',
        canActivate: [roleGuard(UserRole.OWNER, UserRole.ADMIN)],
        loadComponent: () =>
          import('./features/treasury/handover-form/handover-form.component').then((m) => m.HandoverFormComponent),
      },
      {
        path: 'treasury/deposits/:id',
        title: 'استلام',
        loadComponent: () =>
          import('./features/treasury/deposit-details/deposit-details.component').then(
            (m) => m.DepositDetailsComponent,
          ),
      },
      {
        path: 'users',
        title: 'المستخدمون',
        canActivate: [roleGuard(UserRole.OWNER, UserRole.ADMIN)],
        loadComponent: () => import('./features/users/user-list.component').then((m) => m.UserListComponent),
      },
      {
        path: 'users/new',
        title: 'مستخدم جديد',
        canActivate: [roleGuard(UserRole.OWNER, UserRole.ADMIN)],
        loadComponent: () => import('./features/users/user-form.component').then((m) => m.UserFormComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
