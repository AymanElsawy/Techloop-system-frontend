export enum VisitStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  [VisitStatus.PLANNED]: 'مخططة',
  [VisitStatus.IN_PROGRESS]: 'جارية',
  [VisitStatus.COMPLETED]: 'مكتملة',
  [VisitStatus.CANCELLED]: 'ملغاة',
};

export const VISIT_STATUS_CLASSES: Record<VisitStatus, string> = {
  [VisitStatus.PLANNED]: 'bg-soft-apricot-800 text-soft-apricot-200',
  [VisitStatus.IN_PROGRESS]: 'bg-stormy-teal-900 text-stormy-teal',
  [VisitStatus.COMPLETED]: 'bg-yale-blue-900 text-yale-blue-500',
  [VisitStatus.CANCELLED]: 'bg-vibrant-coral-900 text-vibrant-coral-300',
};

export enum VisitPurpose {
  SALE = 'SALE',
  COLLECTION = 'COLLECTION',
  FOLLOW_UP = 'FOLLOW_UP',
}

export const VISIT_PURPOSE_LABELS: Record<VisitPurpose, string> = {
  [VisitPurpose.SALE]: 'بيع',
  [VisitPurpose.COLLECTION]: 'تحصيل',
  [VisitPurpose.FOLLOW_UP]: 'متابعة',
};

export interface VisitCustomer {
  id: string;
  name: string;
  phone: string | null;
  governorate: string;
  city: string | null;
  address: string | null;
  location: { latitude: number; longitude: number } | null;
  /** Current debt, for context during the visit. */
  debit: number;
  status: string;
}

export interface Visit {
  id: string;
  customer: VisitCustomer;
  salesRep: { id: string; name: string };
  createdBy: { id: string; name: string };
  purpose: VisitPurpose;
  scheduledAt: string;
  status: VisitStatus;

  startedAt: string | null;
  latitude: number | null;
  longitude: number | null;

  completedAt: string | null;
  notes: string | null;
  productsDiscussed: string[];
  customerFeedback: string | null;
  nextVisitAt: string | null;

  cancelReason: string | null;
  cancelledAt: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface VisitFilters {
  from?: string;
  to?: string;
  status?: VisitStatus;
  customerId?: string;
}

export interface CreateVisitRequest {
  customerId: string;
  /** Required for Owner/Admin; ignored for sales reps. */
  salesRepId?: string;
  purpose: VisitPurpose;
  scheduledAt: string;
}

export interface CompleteVisitRequest {
  notes?: string;
  productsDiscussed?: string[];
  customerFeedback?: string;
  nextVisitAt?: string;
}
