import type { SupabaseClient } from "@supabase/supabase-js";
import { checkStaffPortAccess, markStaffPortBlocked, StaffPortRequiredError } from '../staffPortAccess';

export type DatabaseClient = SupabaseClient;
export type QueryOptions = {
  fetchPolicy?: "SERVER_ONLY" | "CACHE_ONLY" | "PREFER_CACHE";
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
  sailingCode?: string;
  paidOnly?: boolean;
};

// PostgreSQL derives identity from Supabase Auth and enforces roles itself.
export async function executeDatabase<T>(
  client: DatabaseClient,
  operation: string,
  variables: object,
): Promise<{ data: T }> {
  const terminalOperation = /^(Staff|Ticketing|Boarding)/.test(operation) || ['CollectBookingPayment', 'VerifyPassengerDiscount', 'RefundBooking', 'VerifyTicketQr', 'CheckInTicket', 'BoardTicket'].includes(operation);
  if (terminalOperation && !(await checkStaffPortAccess(client))) throw new StaffPortRequiredError();
  const { data, error } = await client.rpc("barkolink_execute", {
    operation,
    args: variables,
  });
  if (error) {
    if (error.code === '42501' && /no active port|assign your staff port|administrator to assign your port/i.test(error.message)) {
      markStaffPortBlocked();
      throw new StaffPortRequiredError();
    }
    throw error;
  }
  return { data: data as T };
}
