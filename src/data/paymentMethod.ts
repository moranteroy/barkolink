type PaymentDetails = { paymentMethod?: string | null; paymentProviderMethod?: string | null };
const labels: Record<string, string> = {
  CASH: 'Cash', GCASH: 'GCash', PAYMAYA: 'Maya', MAYA: 'Maya', CARD: 'Credit / debit card',
  GRAB_PAY: 'GrabPay', GRABPAY: 'GrabPay', SHOPEE_PAY: 'ShopeePay', SHOPEEPAY: 'ShopeePay', QRPH: 'QR Ph',
};
export function paymentMethodLabel(booking: PaymentDetails | null | undefined): string {
  const method = booking?.paymentMethod?.toUpperCase();
  if (!method) return 'Not yet paid';
  if (method === 'PAYMONGO_TEST' || method === 'PAYMONGO') {
    const provider = booking?.paymentProviderMethod?.toUpperCase();
    return (provider && labels[provider]) || 'Online (PayMongo)';
  }
  return labels[method] || 'Online payment';
}
