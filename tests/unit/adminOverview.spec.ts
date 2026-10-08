import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminOverviewPanel from '../../src/components/admin/AdminOverviewPanel.vue';
const mocks = vi.hoisted(() => ({ overview: vi.fn() }));
vi.mock('@ionic/vue', () => ({ IonIcon: { template: '<span />' } }));
vi.mock('../../src/services/session', () => ({ staffDatabase: {} }));
vi.mock('../../src/services/database/workspaces', () => ({ overview: mocks.overview }));
const monthly = [
  { month: 'May', bookings: 2, passengers: 4 }, { month: 'Jun', bookings: 3, passengers: 7 },
  { month: 'Jul', bookings: 4, passengers: 9 }, { month: 'Aug', bookings: 5, passengers: 10 },
  { month: 'Sep', bookings: 6, passengers: 12 }, { month: 'Oct', bookings: 7, passengers: 15 },
];
const fixture = { stats: { todayTrips: 2, todayBookings: 3, todayPassengers: 4, utilization: 12.5 }, monthly, trips: [], bookingStatus: [{ name: 'CONFIRMED', value: 8 }], categories: [{ name: 'REGULAR', value: 8 }], routes: [{ route: 'A → B', passengers: 8 }] };
const options = { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } };
beforeEach(() => { vi.clearAllMocks(); mocks.overview.mockResolvedValue({ data: fixture }); });
describe('admin operational insights', () => {
  it('changes historical totals and chart rows together without filtering all-time status data', async () => {
    const wrapper = mount(AdminOverviewPanel, { ...options, props: { analytics: true } });
    await flushPromises();
    expect(wrapper.find('.overview-metrics').text()).toContain('27');
    expect(wrapper.find('.chart-data tbody').findAll('tr')).toHaveLength(6);
    await wrapper.findAll('.period-switch button')[0].trigger('click');
    expect(wrapper.find('.overview-metrics').text()).toContain('18');
    expect(wrapper.find('.overview-metrics').text()).toContain('37');
    expect(wrapper.find('.chart-data tbody').findAll('tr')).toHaveLength(3);
    expect(wrapper.find('.booking-donut').text()).toContain('8');
    expect(wrapper.find('.today-trips').exists()).toBe(false);
    wrapper.unmount();
  });
  it('keeps daily metrics and departures on the dashboard', async () => {
    const wrapper = mount(AdminOverviewPanel, options); await flushPromises();
    expect(wrapper.find('.overview-metrics').text()).toContain('12.5%');
    expect(wrapper.find('.attendance-strip').exists()).toBe(true);
    expect(wrapper.find('.today-trips').text()).toContain('No departures scheduled today.');
    wrapper.unmount();
  });
  it('supports turning chart series off and restoring them', async () => {
    const wrapper = mount(AdminOverviewPanel, options); await flushPromises();
    const controls = wrapper.findAll('.trend-legend button');
    await controls[0].trigger('click'); await controls[1].trigger('click');
    expect(wrapper.text()).toContain('Select a series to display the trend.');
    await controls[1].trigger('click');
    expect(wrapper.find('.passenger-line').exists()).toBe(true);
    expect(wrapper.find('.booking-line').exists()).toBe(false);
    wrapper.unmount();
  });
  it('renders empty distributions and zero monthly counts without invalid chart geometry', async () => {
    mocks.overview.mockResolvedValue({ data: { ...fixture, monthly: monthly.map(month => ({ ...month, bookings: 0, passengers: 0 })), routes: [], categories: [], bookingStatus: [] } });
    const wrapper = mount(AdminOverviewPanel, { ...options, props: { analytics: true } }); await flushPromises();
    expect(wrapper.html()).not.toMatch(/NaN|Infinity/);
    expect(wrapper.text()).toContain('No reservations yet.');
    expect(wrapper.text()).toContain('No paid passengers yet.');
    wrapper.unmount();
  });
});
