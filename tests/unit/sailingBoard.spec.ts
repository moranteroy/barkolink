import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import SailingBoard from '../../src/components/passenger/SailingBoard.vue';
const mocks = vi.hoisted(() => ({ load: vi.fn(), ports: vi.fn(), enter: undefined as undefined | (() => void), leave: undefined as undefined | (() => void) }));
vi.mock('../../src/services/sailingBoard', () => ({ passengerSailingBoard: mocks.load }));
vi.mock('../../src/services/database/passenger', () => ({ browseActivePorts: mocks.ports }));
vi.mock('../../src/services/session', () => ({ database: {} }));
vi.mock('@ionic/vue', () => ({ IonIcon: { template: '<span />' }, onIonViewWillEnter: (fn: () => void) => { mocks.enter = fn; }, onIonViewDidLeave: (fn: () => void) => { mocks.leave = fn; } }));
const trip = { code: 'OUTBOUND', departureAt: '2026-10-08T02:00:00Z', arrivalAt: '2026-10-08T04:00:00Z', status: 'BOARDING', origin: { id: 'batangas', name: 'Batangas Port' }, destination: { id: 'calapan', name: 'Calapan Port' }, vessel: { name: 'MV Test' } };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T01:00:00Z')); vi.clearAllMocks();
  mocks.ports.mockResolvedValue({ data: { ports: [{ id: 'batangas', name: 'Batangas Port' }, { id: 'calapan', name: 'Calapan Port' }] } });
  mocks.load.mockResolvedValue({ data: { date: '2026-10-08', updatedAt: '2026-10-08T01:00:00Z', sailings: [trip, { ...trip, code: 'OVERNIGHT', departureAt: '2026-10-07T15:00:00Z', arrivalAt: '2026-10-07T17:00:00Z', origin: trip.destination, destination: trip.origin, status: 'COMPLETED' }] } });
});
afterEach(() => vi.useRealTimers());
describe('passenger departures and arrivals board', () => {
  it('separates port departures and arrivals and includes an overnight arrival', async () => {
    const wrapper = mount(SailingBoard, { props: { initialPortId: 'batangas' } }); mocks.enter?.(); await flushPromises();
    expect(wrapper.findAll('article')).toHaveLength(1);
    expect(wrapper.text()).toContain('OUTBOUND'); expect(wrapper.text()).toContain('Boarding');
    await wrapper.findAll('.board-tabs button')[1].trigger('click');
    expect(wrapper.text()).toContain('OVERNIGHT'); expect(wrapper.text()).toContain('Completed');
    expect(wrapper.text()).toContain('Oct 7'); expect(wrapper.text()).not.toContain('OUTBOUND');
    wrapper.unmount();
  });
  it('refreshes operator status and stops polling when leaving the page', async () => {
    const wrapper = mount(SailingBoard, { props: { initialPortId: 'batangas' } }); mocks.enter?.(); await flushPromises();
    mocks.load.mockResolvedValue({ data: { date: '2026-10-08', updatedAt: '2026-10-08T01:00:30Z', sailings: [{ ...trip, status: 'CANCELLED' }] } });
    await vi.advanceTimersByTimeAsync(30000); await flushPromises();
    expect(wrapper.text()).toContain('Cancelled');
    await wrapper.setProps({ active: false }); await vi.advanceTimersByTimeAsync(60000);
    expect(mocks.load).toHaveBeenCalledTimes(2); wrapper.unmount();
  });
  it('keeps the last schedule visible and labels failed updates', async () => {
    const wrapper = mount(SailingBoard, { props: { initialPortId: 'batangas' } }); mocks.enter?.(); await flushPromises();
    mocks.load.mockRejectedValue(new Error('Offline'));
    await wrapper.find('header button').trigger('click'); await flushPromises();
    expect(wrapper.text()).toContain('Update delayed'); expect(wrapper.text()).toContain('OUTBOUND');
    wrapper.unmount();
  });
});
