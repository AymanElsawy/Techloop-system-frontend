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
  /** سعر البيع: only the default price on a new invoice line. */
  price: number;
  /** Total stock across all warehouses and rep custody (read-only, computed by the API). */
  quantity: number;
  /** Purchase costs (managers only; absent for reps). Weighted moving average over total stock. */
  avgCost?: number | null;
  /** سعر الشراء: set on the product form or by the last warehouse receipt. */
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
  /** Create only: opening stock received from the supplier into a warehouse. */
  stock?: { warehouseId: string; quantity: number; unitCost: number; paidAmount?: number };
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

/** One purchase of a product, taken from a RECEIVE movement. */
export interface PurchaseLine {
  movementId: string;
  number: number | null;
  date: string;
  supplier: { id: string; name: string } | null;
  warehouse: { id: string; name: string } | null;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface SupplierPurchases {
  supplier: { id: string; name: string } | null;
  count: number;
  quantity: number;
  total: number;
  avgCost: number;
  lastCost: number;
  lastDate: string;
}

/** Purchase history of one product from its RECEIVE movements (newest first), totals per supplier and overall. */
export function purchaseHistory(
  movements: {
    id: string;
    number: number | null;
    createdAt: string;
    supplier: { id: string; name: string } | null;
    warehouse: { id: string; name: string } | null;
    items: { product: string; quantity: number; unitCost: number | null }[];
  }[],
  productId: string,
) {
  const lines: PurchaseLine[] = movements.flatMap((m) =>
    m.items
      .filter((i) => i.product === productId && i.unitCost != null)
      .map((i) => ({
        movementId: m.id,
        number: m.number,
        date: m.createdAt,
        supplier: m.supplier,
        warehouse: m.warehouse,
        quantity: i.quantity,
        unitCost: i.unitCost!,
        total: i.quantity * i.unitCost!,
      })),
  );
  const bySupplier = new Map<string, SupplierPurchases>();
  for (const l of lines) {
    const key = l.supplier?.id ?? '';
    const s = bySupplier.get(key);
    // Lines are newest first, so the first one seen is the supplier's last purchase.
    if (!s) bySupplier.set(key, { supplier: l.supplier, count: 1, quantity: l.quantity, total: l.total, avgCost: 0, lastCost: l.unitCost, lastDate: l.date });
    else Object.assign(s, { count: s.count + 1, quantity: s.quantity + l.quantity, total: s.total + l.total });
  }
  const suppliers = [...bySupplier.values()].map((s) => ({ ...s, avgCost: s.total / s.quantity }));
  const quantity = lines.reduce((sum, l) => sum + l.quantity, 0);
  const total = lines.reduce((sum, l) => sum + l.total, 0);
  const costs = lines.map((l) => l.unitCost);
  return {
    lines,
    suppliers,
    quantity,
    total,
    avgCost: quantity ? total / quantity : null,
    minCost: costs.length ? Math.min(...costs) : null,
    maxCost: costs.length ? Math.max(...costs) : null,
  };
}
