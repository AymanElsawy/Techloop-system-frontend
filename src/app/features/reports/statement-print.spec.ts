import { whatsappNumber } from './statement-print.component';

describe('whatsappNumber', () => {
  it('turns an Egyptian mobile into a wa.me number', () => {
    expect(whatsappNumber('01014777777')).toBe('201014777777');
    expect(whatsappNumber('010 1477 7777')).toBe('201014777777');
    expect(whatsappNumber('+201014777777')).toBe('201014777777');
  });

  it('gives null without a usable phone', () => {
    expect(whatsappNumber(null)).toBeNull();
    expect(whatsappNumber('123')).toBeNull();
  });
});
