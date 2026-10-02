import { expiryState, isLowStock, purchaseHistory } from './product.model';

describe('product helpers', () => {
  const now = new Date('2026-09-24T12:00:00Z');

  it('flags expired, soon-to-expire and far-off dates', () => {
    expect(expiryState('2026-09-01', now)).toBe('expired');
    expect(expiryState('2026-11-01', now)).toBe('soon');
    expect(expiryState('2027-09-01', now)).toBeNull();
    expect(expiryState(null, now)).toBeNull();
  });

  it('flags low stock only when a threshold is set', () => {
    expect(isLowStock({ quantity: 5, minQuantity: 5 })).toBe(true);
    expect(isLowStock({ quantity: 6, minQuantity: 5 })).toBe(false);
    expect(isLowStock({ quantity: 0, minQuantity: null })).toBe(false);
  });

  it('sums purchases per supplier and overall (weighted average)', () => {
    const a = { id: 'a', name: 'A' };
    const b = { id: 'b', name: 'B' };
    const wh = { id: 'w', name: 'W' };
    const h = purchaseHistory(
      [
        { id: 'm3', number: 3, createdAt: '2026-10-01', supplier: a, warehouse: wh, items: [{ product: 'p', quantity: 10, unitCost: 12 }] },
        { id: 'm2', number: 2, createdAt: '2026-09-15', supplier: b, warehouse: wh, items: [{ product: 'x', quantity: 5, unitCost: 1 }, { product: 'p', quantity: 20, unitCost: 9 }] },
        { id: 'm1', number: 1, createdAt: '2026-09-01', supplier: a, warehouse: wh, items: [{ product: 'p', quantity: 10, unitCost: 10 }] },
      ],
      'p',
    );
    expect(h.lines.length).toBe(3);
    expect(h.quantity).toBe(40);
    expect(h.total).toBe(400);
    expect(h.avgCost).toBe(10);
    expect([h.minCost, h.maxCost]).toEqual([9, 12]);
    expect(h.suppliers).toEqual([
      { supplier: a, count: 2, quantity: 20, total: 220, avgCost: 11, lastCost: 12, lastDate: '2026-10-01' },
      { supplier: b, count: 1, quantity: 20, total: 180, avgCost: 9, lastCost: 9, lastDate: '2026-09-15' },
    ]);
    expect(purchaseHistory([], 'p').avgCost).toBeNull();
  });
});
