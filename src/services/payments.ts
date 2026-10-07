import { requireSupabase } from './supabase';

export async function verifyOnlinePayment(bookingId: string) {
  const { data, error } = await requireSupabase().rpc('verify_online_payment', { p_booking: bookingId });
  if (error) throw new Error(error.message);
  return data;
}

export async function paymentRequest(action: 'checkout' | 'status' | 'close', bookingId: string) {
  const { data, error } = await requireSupabase().functions.invoke('paymongo', { body: { action, bookingId } });
  if (error) {
    const context = (error as { context?: Response }).context;
    const detail = context instanceof Response ? await context.json().catch(() => null) : null;
    throw new Error(detail?.error || 'Online payment is unavailable. Check your connection or contact ticketing.');
  }
  if (data?.error) throw new Error(data.error);
  return data as { status?: string; checkoutUrl?: string; testMode?: boolean };
}
