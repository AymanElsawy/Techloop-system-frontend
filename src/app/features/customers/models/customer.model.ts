export enum CustomerStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum CustomerType {
  CLINIC = 'CLINIC',
  FARM = 'FARM',
  PHARMACY = 'PHARMACY',
  TRADER = 'TRADER',
  OTHER = 'OTHER',
}

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  [CustomerStatus.PENDING]: 'بانتظار الموافقة',
  [CustomerStatus.APPROVED]: 'معتمد',
  [CustomerStatus.REJECTED]: 'مرفوض',
};

export const CUSTOMER_STATUS_CLASSES: Record<CustomerStatus, string> = {
  [CustomerStatus.PENDING]: 'bg-soft-apricot-800 text-soft-apricot-200',
  [CustomerStatus.APPROVED]: 'bg-yale-blue-900 text-yale-blue-500',
  [CustomerStatus.REJECTED]: 'bg-vibrant-coral-900 text-vibrant-coral-300',
};

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  [CustomerType.CLINIC]: 'عيادة بيطرية',
  [CustomerType.FARM]: 'مزرعة',
  [CustomerType.PHARMACY]: 'صيدلية بيطرية',
  [CustomerType.TRADER]: 'تاجر',
  [CustomerType.OTHER]: 'أخرى',
};

// Kept in sync with backend/src/modules/customers/customer.types.ts
export const GOVERNORATES = [
  'القاهرة',
  'الجيزة',
  'الإسكندرية',
  'القليوبية',
  'الشرقية',
  'الدقهلية',
  'الغربية',
  'المنوفية',
  'البحيرة',
  'كفر الشيخ',
  'دمياط',
  'بورسعيد',
  'الإسماعيلية',
  'السويس',
  'الفيوم',
  'بني سويف',
  'المنيا',
  'أسيوط',
  'سوهاج',
  'قنا',
  'الأقصر',
  'أسوان',
  'البحر الأحمر',
  'الوادي الجديد',
  'مطروح',
  'شمال سيناء',
  'جنوب سيناء',
] as const;

export type Governorate = (typeof GOVERNORATES)[number];

export interface MoneyEvent {
  date: string;
  amount: number;
}

export interface PersonRef {
  id: string;
  name: string;
}

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  phone: string | null;
  contactPerson: string | null;

  governorate: Governorate;
  city: string | null;
  address: string | null;
  location: { latitude: number; longitude: number } | null;

  notes: string | null;

  status: CustomerStatus;
  rejectionReason: string | null;
  createdBy: PersonRef;
  reviewedBy: PersonRef | null;
  reviewedAt: string | null;

  /** مدين: what the customer owes. */
  debit: number;
  /** دائن: what the company owes the customer. */
  credit: number;
  lastInvoice: MoneyEvent | null;
  lastCollection: MoneyEvent | null;
  /** Collected by a rep, not handed to the treasury yet; not deducted from `debit` yet. */
  pendingPayments: number;
  /** حد الائتمان: a rep can't sell past this debt; null = no limit. */
  creditLimit: number | null;
  /** مدة السداد: invoices are due this many days after the sale; null = no terms. */
  paymentTermDays: number | null;
  /** Default discount %, also the most a rep may give; null = none. */
  discountPercent: number | null;
  /** Details endpoint only: what's owed on invoices past their due date. */
  overdue?: number;

  createdAt: string;
  updatedAt: string;
}

export interface CustomerFilters {
  governorate?: Governorate;
  status?: CustomerStatus;
  search?: string;
}

export type CustomerInput = Pick<
  Customer,
  'name' | 'type' | 'phone' | 'contactPerson' | 'governorate' | 'city' | 'address' | 'location' | 'notes'
> &
  Partial<Pick<Customer, 'creditLimit' | 'paymentTermDays' | 'discountPercent'>>;

/** What a rep can still sell on credit before hitting the limit; null = no limit. */
export function creditLeft(c: Pick<Customer, 'creditLimit' | 'debit' | 'pendingPayments'>): number | null {
  if (c.creditLimit == null) return null;
  return Math.round((c.creditLimit - Math.max(c.debit - c.pendingPayments, 0)) * 100) / 100;
}
