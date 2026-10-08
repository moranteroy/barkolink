import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TripOperationsPanel from '../../src/components/admin/TripOperationsPanel.vue';

const mocks = vi.hoisted(() => ({ list: vi.fn(), operations: vi.fn(), reconcile: vi.fn(), confirm: vi.fn() }));
vi.mock('vue-router', () => ({ useRoute: () => ({ query: { sailing: 'TRP1' } }), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@ionic/vue', () => ({ IonIcon: { template: '<span />' } }));
vi.mock('../../src/services/session', () => ({ staffDatabase: {} }));
vi.mock('../../src/services/database/staff', () => ({ adminSailings: mocks.list }));
vi.mock('../../src/services/database/experience', () => ({ tripOperations: mocks.operations, reconcileNoShows: mocks.reconcile }));
vi.mock('../../src/composables/confirmation', () => ({ confirmAction: mocks.confirm }));

const sailing = { code: 'TRP1', departureAt: '2020-01-01T08:00:00Z', arrivalAt: '2020-01-01T09:00:00Z', status: 'COMPLETED', availableSeats: 97, origin: { name: 'Batangas' }, destination: { name: 'Calapan' }, vessel: { name: 'Ferry', passengerCapacity: 100 } };
const passenger = (id: string, ticketStatus: string, paymentStatus = 'PAID') => ({ id, fullName: `Passenger ${id}`, passengerType: 'REGULAR', ticketStatus, checkedInAt: ticketStatus === 'CHECKED_IN' ? sailing.departureAt : null, boardedAt: null, noShow: false, booking: { reference: `BOOK${id}`, status: 'CONFIRMED', paymentStatus } });
const data = { sailing, bookings: [], passengers: [passenger('arrival', 'ISSUED'), passenger('boarding', 'CHECKED_IN'), passenger('unpaid', 'ISSUED', 'UNPAID')], activity: [{ id: 'event', action: 'INSERT', createdAt: sailing.departureAt }] };
const mountPanel = () => mount(TripOperationsPanel, { props: { embedded: true }, global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, AdminManifestExport: true } } });
async function selectTab(wrapper: ReturnType<typeof mountPanel>, name: string) {
  await wrapper.findAll('nav button').find(b => b.text().startsWith(name))!.trigger('click');
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({ data: { sailings: [sailing], totalCount: 1 } });
  mocks.operations.mockResolvedValue({ data });
  mocks.confirm.mockResolvedValue(true);
  mocks.reconcile.mockResolvedValue({ data: { marked: 2 } });
});
describe('sailing workspace', () => {
  it('separates paid arrival and boarding queues and filters passenger records', async () => {
    const wrapper = mountPanel(); await flushPromises();
    await selectTab(wrapper, 'Check-in');
    expect(wrapper.find('tbody').text()).toContain('Passenger arrival');
    expect(wrapper.find('tbody').text()).not.toContain('Passenger boarding');
    expect(wrapper.find('tbody').text()).not.toContain('Passenger unpaid');
    await selectTab(wrapper, 'Boarding');
    expect(wrapper.find('tbody').text()).toContain('Passenger boarding');
    expect(wrapper.find('tbody').text()).not.toContain('Passenger arrival');
    await selectTab(wrapper, 'Passengers');
    await wrapper.find('input').setValue('BOOKunpaid');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.find('tbody').text()).toContain('Passenger unpaid');
    wrapper.unmount();
  });
  it('explains cancelled sailings without allowing no-show reconciliation', async () => {
    mocks.operations.mockResolvedValue({ data: { ...data, sailing: { ...sailing, status: 'CANCELLED' } } });
    const wrapper = mountPanel(); await flushPromises();
    await selectTab(wrapper, 'No-shows');
    expect(wrapper.find('.reconcile').text()).toContain('unavailable for cancelled sailings');
    expect(wrapper.find('.reconcile button').attributes('disabled')).toBeDefined();
    await wrapper.find('.reconcile button').trigger('click');
    expect(mocks.reconcile).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('confirms eligible no-shows on completed departed sailings', async () => {
    const wrapper = mountPanel(); await flushPromises();
    await selectTab(wrapper, 'No-shows');
    await wrapper.find('.reconcile button').trigger('click'); await flushPromises();
    expect(mocks.confirm.mock.calls[0][0].message).toContain('2 paid, non-boarded passengers');
    expect(mocks.reconcile).toHaveBeenCalledWith({}, 'TRP1');
    wrapper.unmount();
  });
  it('passes the workspace sailing to manifest export and labels raw audit events', async () => {
    const wrapper = mountPanel(); await flushPromises();
    await selectTab(wrapper, 'Manifest');
    expect(wrapper.findComponent({ name: 'AdminManifestExport' }).props('sailingCode')).toBe('TRP1');
    await selectTab(wrapper, 'Activity');
    expect(wrapper.find('.activity').text()).toContain('Record created');
    expect(wrapper.find('.activity').text()).toContain('Audit action: INSERT');
    wrapper.unmount();
  });
});
