export enum ProductUnit {
  LITER = 'LITER',
  PACK = 'PACK',
  CARTON = 'CARTON',
}

export const PRODUCT_UNIT_LABELS: Record<ProductUnit, string> = {
  [ProductUnit.LITER]: 'لتر',
  [ProductUnit.PACK]: 'عبوة',
  [ProductUnit.CARTON]: 'كرتونة',
};

/** Products expiring within this many days are flagged. */
export const EXPIRY_WARNING_DAYS = 90;

export interface Product {
  id: string;
  name: string;
  code: string | null;
  unit: ProductUnit | null;
  price: number;
  /** Total stock across all warehouses and rep custody (read-only, computed by the API). */
  quantity: number;
  /** Purchase costs (managers only; absent for reps). Weighted moving average over total stock. */
  avgCost?: number | null;
  lastCost?: number | null;
  lastSupplier?: { id: string; name: string } | null;
  lastPurchaseAt?: string | null;
  /** Main supplier, set on the product form (managers only). */
  supplier?: { id: string; name: string } | null;
  /** Low-stock alert threshold. */
  minQuantity: number | null;
  manufacturer: string | null;
  /** ISO date. */
  expiryDate: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFilters {
  search?: string;
  unit?: ProductUnit;
  active?: boolean;
  lowStock?: boolean;
}

export type ProductInput = Omit<
  Product,
  | 'id'
  | 'quantity'
  | 'avgCost'
  | 'lastCost'
  | 'lastSupplier'
  | 'lastPurchaseAt'
  | 'supplier'
  | 'createdAt'
  | 'updatedAt'
  | 'expiryDate'
> & {
  /** null clears the main supplier. */
  supplierId: string | null;
  /** YYYY-MM-DD */
  expiryDate: string | null;
};

export function isLowStock(p: Pick<Product, 'quantity' | 'minQuantity'>): boolean {
  return p.minQuantity !== null && p.quantity <= p.minQuantity;
}

export function expiryState(expiryDate: string | null, now = new Date()): 'expired' | 'soon' | null {
  if (!expiryDate) return null;
  const days = (new Date(expiryDate).getTime() - now.getTime()) / 86_400_000;
  if (days < 0) return 'expired';
  return days <= EXPIRY_WARNING_DAYS ? 'soon' : null;
}
