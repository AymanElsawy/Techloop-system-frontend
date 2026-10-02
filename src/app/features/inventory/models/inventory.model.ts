import { ProductUnit } from '../../products/models/product.model';

export enum MovementType {
  RECEIVE = 'RECEIVE',
  ISSUE = 'ISSUE',
  RETURN = 'RETURN',
  SALE = 'SALE',
  SALE_CANCEL = 'SALE_CANCEL',
  SALE_RETURN = 'SALE_RETURN',
  SALE_RETURN_CANCEL = 'SALE_RETURN_CANCEL',
  ADJUST = 'ADJUST',
  TRANSFER = 'TRANSFER',
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  [MovementType.RECEIVE]: 'وارد للمخزن',
  [MovementType.ISSUE]: 'صرف لمندوب',
  [MovementType.RETURN]: 'مرتجع من مندوب',
  [MovementType.SALE]: 'بيع (فاتورة)',
  [MovementType.SALE_CANCEL]: 'إلغاء فاتورة',
  [MovementType.SALE_RETURN]: 'مرتجع من عميل',
  [MovementType.SALE_RETURN_CANCEL]: 'إلغاء مرتجع عميل',
  [MovementType.ADJUST]: 'تسوية جرد',
  [MovementType.TRANSFER]: 'تحويل لمخزن',
};

export const MOVEMENT_TYPE_CLASSES: Record<MovementType, string> = {
  [MovementType.RECEIVE]: 'bg-yale-blue-900 text-yale-blue-600',
  [MovementType.ISSUE]: 'bg-soft-apricot-800 text-soft-apricot-200',
  [MovementType.RETURN]: 'bg-stormy-teal-900 text-stormy-teal',
  [MovementType.SALE]: 'bg-vibrant-coral-900 text-vibrant-coral-300',
  [MovementType.SALE_CANCEL]: 'bg-alabaster-grey-400 text-alabaster-grey-100',
  [MovementType.SALE_RETURN]: 'bg-stormy-teal-900 text-stormy-teal',
  [MovementType.SALE_RETURN_CANCEL]: 'bg-alabaster-grey-400 text-alabaster-grey-100',
  [MovementType.ADJUST]: 'bg-soft-apricot-800 text-soft-apricot-200',
  [MovementType.TRANSFER]: 'bg-yale-blue-900 text-yale-blue-600',
};

/** Movement types a manager records by hand from a warehouse page. */
export type ManualMovement = MovementType.RECEIVE | MovementType.ISSUE | MovementType.RETURN | MovementType.TRANSFER;

export interface Warehouse {
  id: string;
  name: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface WarehouseSummary extends Warehouse {
  /** Main stock only (custody not included). */
  totalQuantity: number;
  repsCount: number;
}

export interface StockProduct {
  id: string;
  name: string;
  code: string | null;
  unit: ProductUnit | null;
  price: number;
  minQuantity: number | null;
  isActive: boolean;
}

export interface StockRow {
  id: string;
  product: StockProduct;
  quantity: number;
}

export interface RepCustody {
  rep: { id: string; name: string; username: string; isActive: boolean };
  custody: StockRow[];
}

export interface WarehouseDetails {
  warehouse: Warehouse;
  stock: StockRow[];
  reps: RepCustody[];
}

export interface MyStock {
  warehouse: Warehouse | null;
  custody: StockRow[];
  warehouseStock: StockRow[];
}

export interface Movement {
  id: string;
  type: MovementType;
  /** Printable document number (RECEIVE / ISSUE / RETURN). */
  number: number | null;
  warehouse: { id: string; name: string } | null;
  rep: { id: string; name: string } | null;
  invoice: { id: string; invoiceNumber: string } | null;
  /** RECEIVE only. */
  supplier: { id: string; name: string } | null;
  /** TRANSFER only: the receiving warehouse (`warehouse` is the source). */
  toWarehouse?: { id: string; name: string } | null;
  /** `unitCost`: purchase price, RECEIVE only. ADJUST: `quantity` is signed (+ surplus, − shortage). */
  items: { product: string; name: string; quantity: number; fromCustody: number; unitCost: number | null }[];
  /** RECEIVE only: total purchase cost and what was actually paid; the rest is supplier debt. */
  totalCost: number | null;
  paidAmount: number | null;
  notes: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface MovementFilters {
  warehouseId?: string;
  repId?: string;
  type?: MovementType;
  supplierId?: string;
  productId?: string;
}

export interface StockItemInput {
  productId: string;
  quantity: number;
  /** Purchase price per unit; required for RECEIVE. */
  unitCost?: number;
}

/** productId -> quantity */
export function quantityMap(rows: StockRow[]): Map<string, number> {
  return new Map(rows.map((r) => [r.product.id, r.quantity]));
}

export function totalQuantity(rows: StockRow[]): number {
  return rows.reduce((sum, r) => sum + r.quantity, 0);
}
