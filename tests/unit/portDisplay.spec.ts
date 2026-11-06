import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  displaySailings,
  loadPortDisplay,
  manilaDate,
  portDisplayKey,
  type PortDisplayData,
} from '../../src/services/portDisplay';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/supabase', () => ({ requireSupabase: () => ({ rpc }) }));

const data: PortDisplayData = {
  date: '2026-10-11',
  updatedAt: '2026-10-11T00:00:00Z',
  portId: 'cal',
  ports: [],
  advisories: [],
  sailings: [
    {
      code: 'IN',
      departureAt: '2026-10-10T15:00:00Z',
      arrivalAt: '2026-10-10T17:00:00Z',
      status: 'DELAYED',
      origin: { id: 'btg', name: 'Batangas Port', city: 'Batangas' },
      destination: { id: 'cal', name: 'Calapan Port', city: 'Calapan' },
      vessel: { name: 'Ferry' },
      operator: 'FastCat',
    },
    {
      code: 'OUT',
      departureAt: '2026-10-11T04:00:00Z',
      arrivalAt: '2026-10-11T06:00:00Z',
      status: 'CANCELLED',
      origin: { id: 'cal', name: 'Calapan Port', city: 'Calapan' },
      destination: { id: 'btg', name: 'Batangas Port', city: 'Batangas' },
      vessel: { name: 'Ferry' },
      operator: 'FastCat',
    },
  ],
};
describe('terminal schedule day boundaries', () => {
  it('uses Philippine dates and keeps overnight arrivals on the arrival board', () => {
    expect(manilaDate('2026-10-10T17:00:00Z')).toBe('2026-10-11');
    expect(displaySailings(data, 'arrivals', data.date).map((s) => s.code)).toEqual(['IN']);
    expect(displaySailings(data, 'departures', data.date).map((s) => s.code)).toEqual(['OUT']);
  });
  it('removes yesterday’s data when midnight passes even if the network is unavailable', () => {
    expect(displaySailings(data, 'departures', '2026-10-12')).toEqual([]);
    expect(displaySailings(null, 'arrivals', data.date)).toEqual([]);
  });
  it('keeps cancellations visible and orders trips by scheduled time', () => {
    const extra = { ...data.sailings[1], code: 'EARLY', departureAt: '2026-10-11T00:00:00Z' };
    const rows = displaySailings(
      { ...data, sailings: [...data.sailings, extra] },
      'departures',
      data.date,
    );
    expect(rows.map((s) => s.code)).toEqual(['EARLY', 'OUT']);
    expect(rows[1].status).toBe('CANCELLED');
  });
});

describe('terminal display links', () => {
  const ports = [
    { id: 'eeeeeeee-0000-4000-8000-000000000001', name: 'Batangas Port', city: 'Batangas' },
    { id: 'eeeeeeee-0000-4000-8000-000000000002', name: 'Calapan Port', city: 'Calapan' },
  ];
  beforeEach(() => rpc.mockReset());
  it('uses readable unique port names and keeps ambiguous names as IDs', () => {
    expect(portDisplayKey(ports[0], ports)).toBe('batangas-port');
    const duplicate = { ...ports[1], name: ports[0].name };
    expect(portDisplayKey(ports[0], [ports[0], duplicate])).toBe(ports[0].id);
    expect(
      portDisplayKey({ ...ports[0], name: '  Puértó / North  ' }, [
        { ...ports[0], name: 'Puértó / North' },
      ]),
    ).toBe('puerto-north');
  });
  it('keeps legacy UUID links on the direct public RPC', async () => {
    rpc.mockResolvedValue({ data, error: null });
    expect(await loadPortDisplay(ports[0].id)).toEqual(data);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('port_display', { p_port: ports[0].id });
  });
  it('resolves a fresh short link to the correct terminal', async () => {
    const initial = { ...data, ports, portId: ports[0].id };
    const selected = { ...initial, portId: ports[1].id };
    rpc
      .mockResolvedValueOnce({ data: initial, error: null })
      .mockResolvedValueOnce({ data: selected, error: null });
    expect(await loadPortDisplay('calapan-port')).toEqual(selected);
    expect(rpc.mock.calls).toEqual([
      ['port_display', { p_port: null }],
      ['port_display', { p_port: ports[1].id }],
    ]);
  });
  it('uses the server-assigned terminal when ticketing edits a readable link', async () => {
    const assigned = { ...data, portId: ports[1].id, ports: [ports[1]], portLocked: true };
    rpc.mockResolvedValue({ data: assigned, error: null });
    expect(await loadPortDisplay('batangas-port')).toEqual(assigned);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('port_display', { p_port: null });
  });
  it('reuses the public directory during refresh', async () => {
    rpc.mockResolvedValue({ data, error: null });
    await loadPortDisplay('batangas-port', undefined, ports);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('port_display', { p_port: ports[0].id });
  });
  it('rejects unknown or ambiguous names instead of displaying another terminal', async () => {
    rpc.mockResolvedValue({ data: { ...data, ports, portId: ports[0].id }, error: null });
    await expect(loadPortDisplay('missing-port')).rejects.toThrow('Port is unavailable');
    await expect(
      loadPortDisplay('batangas-port', undefined, [ports[0], { ...ports[1], name: ports[0].name }]),
    ).rejects.toThrow('Port is unavailable');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('does not fetch another terminal after cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(loadPortDisplay('calapan-port', controller.signal, ports)).rejects.toThrow(
      'Request aborted',
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});
