import { PersonRef } from '../customers/models/customer.model';
import { ProductUnit } from '../products/models/product.model';

export enum ReturnStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
}

/** فاتورة مرتجع: goods a customer gives back from a sales invoice; reduces their debt. */
export interface SalesReturn {
  id: string;
  number: number;
  invoice: { id: string; invoiceNumber: string; createdAt: string };
  customer: { id: string; name: string; governorate: string; city: string | null; phone: string | null };
  createdBy: PersonRef;
  /** Goods went to this rep's custody; null = the warehouse's main stock. */
  rep: PersonRef | null;
  warehouse: { id: string; name: string };
  items: { product: string; name: string; unit: ProductUnit | null; unitPrice: number; quantity: number; total: number }[];
  total: number;
  notes: string | null;
  status: ReturnStatus;
  cancelReason: string | null;
  cancelledBy: PersonRef | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface CreateReturnRequest {
  invoiceId: string;
  /** Managers only; defaults to the invoice's warehouse. */
  warehouseId: string | null;
  items: { productId: string; quantity: number }[];
  notes: string | null;
}

/** productId -> quantity already returned (active returns only). */
export function returnedByProduct(returns: SalesReturn[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of returns) {
    if (r.status !== ReturnStatus.ACTIVE) continue;
    for (const i of r.items) map.set(i.product, (map.get(i.product) ?? 0) + i.quantity);
  }
  return map;
}
