import { requireSupabase } from './supabase';
import { checkStaffPortAccess, markStaffPortBlocked, StaffPortRequiredError } from './staffPortAccess';

export async function verifyOnlinePayment(bookingId: string) {
  const client = requireSupabase();
  if (!(await checkStaffPortAccess(client))) throw new StaffPortRequiredError();
  const { data, error } = await client.rpc('verify_online_payment', { p_booking: bookingId });
  if (error) {
    if (error.code === '42501' && /no active port|assign your staff port|administrator to assign your port/i.test(error.message)) {
      markStaffPortBlocked();
      throw new StaffPortRequiredError();
    }
    throw new Error(error.message);
  }
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
