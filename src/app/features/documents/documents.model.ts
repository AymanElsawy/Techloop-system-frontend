/** Every printable document (see backend GET /documents). */
export enum DocumentType {
  SALE = 'SALE',
  SALE_RETURN = 'SALE_RETURN',
  COLLECTION = 'COLLECTION',
  PURCHASE = 'PURCHASE',
  ISSUE = 'ISSUE',
  RETURN = 'RETURN',
  DEPOSIT = 'DEPOSIT',
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  [DocumentType.SALE]: 'فاتورة بيع',
  [DocumentType.SALE_RETURN]: 'فاتورة مرتجع',
  [DocumentType.COLLECTION]: 'إيصال تحصيل',
  [DocumentType.PURCHASE]: 'فاتورة شراء (مورد)',
  [DocumentType.ISSUE]: 'إذن صرف عهدة',
  [DocumentType.RETURN]: 'إذن مرتجع عهدة',
  [DocumentType.DEPOSIT]: 'إيصال توريد للخزنة',
};

export const DOCUMENT_TYPE_CLASSES: Record<DocumentType, string> = {
  [DocumentType.SALE]: 'bg-yale-blue-900 text-yale-blue-500',
  [DocumentType.SALE_RETURN]: 'bg-vibrant-coral-900 text-vibrant-coral-300',
  [DocumentType.COLLECTION]: 'bg-stormy-teal-900 text-stormy-teal',
  [DocumentType.PURCHASE]: 'bg-soft-apricot-800 text-soft-apricot-200',
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
  [DocumentType.ISSUE]: 'المندوب',
  [DocumentType.RETURN]: 'المندوب',
  [DocumentType.DEPOSIT]: 'المندوب',
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
