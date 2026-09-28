import { expiryState, isLowStock } from './product.model';

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
});
