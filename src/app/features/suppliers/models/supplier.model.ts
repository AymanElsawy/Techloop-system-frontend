export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  company: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  /** Number of warehouse receipts from this supplier. */
  receipts: number;
  /** Σ quantity × purchase price over those receipts. */
  totalPurchases: number;
  lastPurchaseAt: string | null;
  createdAt: string;
}

export type SupplierInput = Pick<Supplier, 'name' | 'phone' | 'company' | 'address' | 'notes'>;
