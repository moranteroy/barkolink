import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NoShowsPanel from '../../src/components/admin/NoShowsPanel.vue';
const mocks = vi.hoisted(() => ({ trips: vi.fn(), list: vi.fn(), mark: vi.fn(), confirm: vi.fn() }));
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }));
vi.mock('@ionic/vue', () => ({ IonIcon: { template: '<span />' } }));
vi.mock('../../src/services/session', () => ({ staffDatabase: {} }));
vi.mock('../../src/services/database/workspaces', () => ({ staffTrips: mocks.trips, noShows: mocks.list, markNoShow: mocks.mark }));
vi.mock('../../src/composables/confirmation', () => ({ confirmAction: mocks.confirm }));
vi.mock('../../src/components/shared/RecordsGrid.vue', () => ({ default: {
  props: ['rows', 'columns', 'density', 'maxGridHeight', 'actionWidth'],
  template: '<div class="records-grid"><div v-for="row in rows" :key="row.key" class="test-grid-row"><slot name="cell" v-for="(value, index) in row.cells" :row="row" :value="value" :index="index" /><slot name="actions" :row="row" /></div></div>',
} }));
const sailing = { code: 'TRP1', status: 'COMPLETED', origin: { name: 'Batangas' }, destination: { name: 'Calapan' } };
const passenger = { id: 'p1', fullName: 'Test Passenger', ticketStatus: 'CHECKED_IN', noShow: false, booking: { reference: 'BOOK1' } };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.trips.mockResolvedValue({ data: { sailings: [sailing], totalCount: 1 } });
  mocks.list.mockResolvedValue({ data: { sailing, passengers: [passenger] } });
  mocks.confirm.mockResolvedValue(true);
  mocks.mark.mockResolvedValue({ data: { marked: 1 } });
});
describe('no-show attendance review', () => {
  it('clears passengers and disables recording when the trip selection is cleared', async () => {
    const wrapper = mount(NoShowsPanel);
    await flushPromises();
    expect(wrapper.findAll('.test-grid-row')).toHaveLength(1);
    await wrapper.find('#no-show-search').setValue('Test');
    await wrapper.find('select').setValue('');
    await flushPromises();
    expect(wrapper.find('.records-grid').exists()).toBe(false);
    expect(wrapper.find('.no-show-counts').exists()).toBe(false);
    expect(wrapper.text()).toContain('Choose a completed trip');
    expect(wrapper.find('.primary-button').attributes('disabled')).toBeDefined();
    expect(mocks.list).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
  it('records attendance only after confirmation for a completed trip', async () => {
    const wrapper = mount(NoShowsPanel);
    await flushPromises();
    await wrapper.find('.primary-button').trigger('click');
    await flushPromises();
    expect(mocks.confirm).toHaveBeenCalled();
    expect(mocks.mark).toHaveBeenCalledWith({}, 'TRP1', undefined);
    expect(wrapper.text()).toContain('1 no-show records added.');
    wrapper.unmount();
  });
  it('keeps recording disabled for an incomplete trip', async () => {
    mocks.list.mockResolvedValue({ data: { sailing: { ...sailing, status: 'SCHEDULED' }, passengers: [passenger] } });
    const wrapper = mount(NoShowsPanel);
    await flushPromises();
    expect(wrapper.find('.primary-button').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.mark-no-show').attributes('disabled')).toBeDefined();
    expect(mocks.mark).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
