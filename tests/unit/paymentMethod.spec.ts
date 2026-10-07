import { describe, expect, it } from 'vitest';
import { paymentMethodLabel } from '../../src/data/paymentMethod';
describe('Recorded payment method', () => {
  it('uses the verified provider method for online payments', () => {
    for (const [provider, label] of [['gcash','GCash'],['paymaya','Maya'],['card','Credit / debit card']])
      expect(paymentMethodLabel({paymentMethod:'PAYMONGO_TEST',paymentProviderMethod:provider})).toBe(label);
    expect(paymentMethodLabel({paymentMethod:'PAYMONGO_TEST'})).toBe('Online (PayMongo)');
  });
  it('does not mislabel cash or unpaid bookings as an online payment', () => {
    expect(paymentMethodLabel({paymentMethod:'CASH',paymentProviderMethod:'gcash'})).toBe('Cash');
    expect(paymentMethodLabel({paymentMethod:null,paymentProviderMethod:'gcash'})).toBe('Not yet paid');
  });
});
