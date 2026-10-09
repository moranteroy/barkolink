import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { executeDatabase } from '../../src/services/database/client';
import { checkStaffPortAccess, claimStaffPortNotice, resetStaffPortAccess, staffPortAccess } from '../../src/services/staffPortAccess';
import { databaseRequestError } from '../../src/data/databaseErrors';

function fixture(role = 'TICKETING') {
  let uid = 'staff-one';
  let assigned = false;
  let active = true;
  let denied = false;
  const rpc = vi.fn(async (_name: string, args: { operation: string }) => {
    if (args.operation === 'MyProfile') return { data: { user: { uid, assignedPortId: assigned ? 'calapan' : null, assignedPort: assigned ? { id: 'calapan', name: 'Calapan Port', isActive: active } : null } }, error: null };
    return denied ? { data: null, error: { code: '42501', message: 'No active port is assigned to your staff account. Ask an administrator to assign your port.' } } : { data: { records: [] }, error: null };
  });
  const client = { rpc, auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: uid, app_metadata: { role } } } }, error: null })) } } as unknown as SupabaseClient;
  return { client, rpc, assign: () => { assigned = true; }, deactivate: () => { active = false; }, switchUser: () => { uid = 'staff-two'; assigned = false; }, revoke: () => { denied = true; } };
}

beforeEach(() => resetStaffPortAccess(''));

describe('staff port request gate', () => {
  it.each(['TICKETING', 'BOARDING'])('blocks concurrent queues without sending forbidden requests for %s', async role => {
    const { client, rpc } = fixture(role);
    const results = await Promise.allSettled(['StaffDashboard', 'StaffBookings', 'BoardingSailings', 'TicketingSailings'].map(op => executeDatabase(client, op, {})));
    expect(results.every(result => result.status === 'rejected' && result.reason.code === 'STAFF_PORT_REQUIRED')).toBe(true);
    expect(rpc.mock.calls.map(call => call[1].operation)).toEqual(['MyProfile']);
    await expect(executeDatabase(client, 'StaffBookings', {})).rejects.toMatchObject({ code: 'STAFF_PORT_REQUIRED' });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(claimStaffPortNotice()).toBe(true);
    expect(claimStaffPortNotice()).toBe(false);
  });

  it('rechecks an admin assignment and resumes terminal requests without signing in again', async () => {
    const f = fixture();
    expect(await checkStaffPortAccess(f.client)).toBe(false);
    f.assign();
    expect(await checkStaffPortAccess(f.client, true)).toBe(true);
    await expect(executeDatabase(f.client, 'StaffBookings', {})).resolves.toEqual({ data: { records: [] } });
    expect(staffPortAccess.portName).toBe('Calapan Port');
    expect(f.rpc.mock.calls.map(call => call[1].operation)).toEqual(['MyProfile', 'MyProfile', 'StaffBookings']);
  });

  it('blocks an inactive port and clears a previous account assignment', async () => {
    const f = fixture(); f.assign(); f.deactivate();
    expect(await checkStaffPortAccess(f.client)).toBe(false);
    const second = fixture(); second.assign();
    expect(await checkStaffPortAccess(second.client)).toBe(true);
    second.switchUser();
    await expect(executeDatabase(second.client, 'StaffBookings', {})).rejects.toMatchObject({ code: 'STAFF_PORT_REQUIRED' });
    expect(staffPortAccess.uid).toBe('staff-two');
    expect(staffPortAccess.portName).toBe('');
  });

  it.each(['ADMIN', 'PASSENGER'])('leaves permissions to the backend for %s and does not require a staff assignment', async role => {
    const { client, rpc } = fixture(role);
    await executeDatabase(client, role === 'ADMIN' ? 'StaffDashboard' : 'BrowseSailings', {});
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1].operation).not.toBe('MyProfile');
  });

  it('stops subsequent requests if an assignment is removed while the page is open', async () => {
    const f = fixture(); f.assign();
    await executeDatabase(f.client, 'StaffBookings', {});
    f.revoke();
    await expect(executeDatabase(f.client, 'StaffBookings', {})).rejects.toMatchObject({ code: 'STAFF_PORT_REQUIRED' });
    await expect(executeDatabase(f.client, 'StaffDashboard', {})).rejects.toMatchObject({ code: 'STAFF_PORT_REQUIRED' });
    expect(f.rpc.mock.calls.map(call => call[1].operation)).toEqual(['MyProfile', 'StaffBookings', 'StaffBookings']);
    expect(databaseRequestError({ code: 'STAFF_PORT_REQUIRED' }, '')).toContain('administrator');
    expect(databaseRequestError({ code: '42501', message: 'No active port is assigned to your staff account.' }, '')).not.toContain('Sign in again');
  });

  it('refreshes the assignment after the queue interval', async () => {
    const f = fixture();
    const now = Date.now(); const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      expect(await checkStaffPortAccess(f.client)).toBe(false);
      f.assign(); clock.mockReturnValue(now + 15001);
      await executeDatabase(f.client, 'StaffBookings', {});
      expect(staffPortAccess.status).toBe('ready');
    } finally { clock.mockRestore(); }
  });
});
