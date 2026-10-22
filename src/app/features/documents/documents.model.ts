/** Every printable document (see backend GET /documents). */
export enum DocumentType {
  SALE = 'SALE',
  SALE_RETURN = 'SALE_RETURN',
  COLLECTION = 'COLLECTION',
  PURCHASE = 'PURCHASE',
  SUPPLIER_RETURN = 'SUPPLIER_RETURN',
  ISSUE = 'ISSUE',
  RETURN = 'RETURN',
  DEPOSIT = 'DEPOSIT',
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  [DocumentType.SALE]: 'فاتورة بيع',
  [DocumentType.SALE_RETURN]: 'فاتورة مرتجع',
  [DocumentType.COLLECTION]: 'إيصال تحصيل',
  [DocumentType.PURCHASE]: 'فاتورة شراء (مورد)',
  [DocumentType.SUPPLIER_RETURN]: 'فاتورة مرتجع مورد',
  [DocumentType.ISSUE]: 'إذن صرف عهدة',
  [DocumentType.RETURN]: 'إذن مرتجع عهدة',
  [DocumentType.DEPOSIT]: 'إيصال توريد للخزنة',
};

export const DOCUMENT_TYPE_CLASSES: Record<DocumentType, string> = {
  [DocumentType.SALE]: 'bg-yale-blue-900 text-yale-blue-500',
  [DocumentType.SALE_RETURN]: 'bg-vibrant-coral-900 text-vibrant-coral-300',
  [DocumentType.COLLECTION]: 'bg-stormy-teal-900 text-stormy-teal',
  [DocumentType.PURCHASE]: 'bg-soft-apricot-800 text-soft-apricot-200',
  [DocumentType.SUPPLIER_RETURN]: 'bg-vibrant-coral-900 text-vibrant-coral-300',
  [DocumentType.ISSUE]: 'bg-alabaster-grey-900 text-alabaster-grey-100',
  [DocumentType.RETURN]: 'bg-alabaster-grey-900 text-alabaster-grey-100',
  [DocumentType.DEPOSIT]: 'bg-yale-blue-900 text-yale-blue-600',
};

/** Party column header per type. */
export const PARTY_LABELS: Record<DocumentType, string> = {
  [DocumentType.SALE]: 'العميل',
  [DocumentType.SALE_RETURN]: 'العميل',
  [DocumentType.COLLECTION]: 'العميل',
  [DocumentType.PURCHASE]: 'المورد',
  [DocumentType.SUPPLIER_RETURN]: 'المورد',
  [DocumentType.ISSUE]: 'المندوب',
  [DocumentType.RETURN]: 'المندوب',
  [DocumentType.DEPOSIT]: 'المندوب',
};

/**
 * "إنشاء" from the documents tab opens the existing form of each type. `party` must be picked first
 * (the forms live under the customer / rep / supplier); its id goes into `link`.
 */
export const DOCUMENT_CREATE: Record<DocumentType, { party?: 'customer' | 'rep' | 'supplier'; link: (id: string) => string }> = {
  [DocumentType.SALE]: { party: 'customer', link: (id) => `/customers/${id}/invoices/new` },
  [DocumentType.SALE_RETURN]: { party: 'customer', link: (id) => `/customers/${id}/returns/new` },
  [DocumentType.COLLECTION]: { party: 'customer', link: (id) => `/customers/${id}/collections/new` },
  [DocumentType.PURCHASE]: { link: () => '/documents/purchases/new' },
  [DocumentType.SUPPLIER_RETURN]: { party: 'supplier', link: (id) => `/inventory/move?type=SUPPLIER_RETURN&supplierId=${id}` },
  [DocumentType.ISSUE]: { link: () => '/inventory/move?type=ISSUE' },
  [DocumentType.RETURN]: { link: () => '/inventory/move?type=RETURN' },
  [DocumentType.DEPOSIT]: { party: 'rep', link: (id) => `/treasury/handover/${id}` },
};

type Ref = { id: string; name: string } | null;

export interface DocumentRow {
  type: DocumentType;
  id: string;
  number: string;
  date: string;
  party: Ref;
  by: Ref;
  /** Money; null for custody moves. */
  amount: number | null;
  /** Items count for custody moves / purchases. */
  quantity: number | null;
  status: 'ACTIVE' | 'CANCELLED';
}

export interface DocumentFilters {
  type?: DocumentType;
  /** YYYY-MM-DD */
  from?: string;
  to?: string;
  search?: string;
}

export interface Company {
  name: string;
  phone: string | null;
  address: string | null;
  taxNumber: string | null;
  commercialRegister: string | null;
  footer: string | null;
  /** data URL (PNG/JPEG), printed in the header. */
  logo: string | null;
}

/** App page with the full details of a document. */
export function detailsLink(row: Pick<DocumentRow, 'type' | 'id'>): string[] | null {
  switch (row.type) {
    case DocumentType.SALE:
      return ['/invoices', row.id];
    case DocumentType.COLLECTION:
      return ['/collections', row.id];
    case DocumentType.SALE_RETURN:
      return ['/returns', row.id];
    case DocumentType.DEPOSIT:
      return ['/treasury/deposits', row.id];
    default:
      return null; // movements have no page of their own; the print view is the details
  }
}

/** A daily backup archive (database + attachments). Owner only. */
export interface Backup {
  name: string;
  size: number;
  createdAt: string;
}
