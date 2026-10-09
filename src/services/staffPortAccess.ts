import { reactive } from 'vue';
import type { SupabaseClient } from '@supabase/supabase-js';

type Profile = { uid: string; assignedPortId?: string | null; assignedPort?: { id: string; name: string; isActive: boolean } | null };
export const staffPortAccess = reactive({ uid: '', status: 'unknown' as 'unknown' | 'ready' | 'blocked', portName: '', checkedAt: 0, notice: 0 });
const cache = new WeakMap<SupabaseClient, { uid: string; pending?: Promise<boolean> }>();
let claimedNotice = 0;
let checkedClient: SupabaseClient | undefined;
export const staffPortMessage = 'Your staff account has no active port assignment. Ask your administrator to assign your departure port.';
export class StaffPortRequiredError extends Error {
  readonly code = 'STAFF_PORT_REQUIRED';
  constructor() { super(staffPortMessage); }
}
export function claimStaffPortNotice() {
  if (claimedNotice >= staffPortAccess.notice) return false;
  claimedNotice = staffPortAccess.notice;
  return true;
}
export function markStaffPortBlocked() {
  if (staffPortAccess.status !== 'blocked') staffPortAccess.notice++;
  staffPortAccess.status = 'blocked'; staffPortAccess.portName = ''; staffPortAccess.checkedAt = Date.now();
}
export function resetStaffPortAccess(uid = '') {
  if (staffPortAccess.uid === uid) return;
  Object.assign(staffPortAccess, { uid, status: 'unknown', portName: '', checkedAt: 0 });
}
// Read the allowed MyProfile operation first. Blocked staff never request terminal records.
// Short-lived caching deduplicates concurrent queues and detects later admin assignments.
export async function checkStaffPortAccess(client: SupabaseClient, force = false): Promise<boolean> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  const user = data.session?.user;
  if (!user || !['TICKETING', 'BOARDING'].includes(String(user.app_metadata.role).toUpperCase())) return true;
  resetStaffPortAccess(user.id);
  const current = cache.get(client);
  if (current?.uid === user.id && current.pending) return current.pending;
  // Expire before the 15-second queue tick, even if the initial profile loaded after mount.
  if (!force && checkedClient === client && Date.now() - staffPortAccess.checkedAt < 12000) return staffPortAccess.status === 'ready';
  const pending = (async () => {
    const { data: response, error: profileError } = await client.rpc('barkolink_execute', { operation: 'MyProfile', args: {} });
    if (profileError) throw profileError;
    const profile = response?.user as Profile | undefined;
    const ready = profile?.uid === user.id && !!profile.assignedPortId && !!profile.assignedPort?.isActive;
    if (staffPortAccess.uid !== user.id) throw new Error('Your account changed. Please refresh this page.');
    checkedClient = client;
    if (!ready) markStaffPortBlocked();
    else Object.assign(staffPortAccess, { status: 'ready', portName: profile!.assignedPort!.name, checkedAt: Date.now() });
    return ready;
  })();
  cache.set(client, { uid: user.id, pending });
  try { return await pending; }
  finally { if (cache.get(client)?.pending === pending) cache.delete(client); }
}
