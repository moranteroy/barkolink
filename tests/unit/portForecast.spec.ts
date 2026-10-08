import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortForecast from '../../src/components/shared/PortForecast.vue';
import { philippineDateKey } from '../../src/data/travelDate';
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../../src/services/weather', () => ({ portForecast: mocks.load }));
vi.mock('@ionic/vue', () => ({ IonIcon: { template: '<span />' }, onIonViewWillEnter: vi.fn() }));
const days = Array.from({ length: 7 }, (_, i) => ({ date: philippineDateKey(new Date(Date.now() + i * 86400000)), condition: 'Light rain', conditionCode: 1183, highC: 30, lowC: 24, rainChance: 70, windKph: 18 }));
const fixture = { configured: true, ports: [{ id: 'batangas', city: 'Batangas', available: true, days }] };
beforeEach(() => vi.clearAllMocks());
describe('home port forecast', () => {
  it('shows seven daily forecasts and actual rain chances', async () => {
    mocks.load.mockResolvedValue(fixture);
    const wrapper = mount(PortForecast, { props: { portId: 'batangas' } }); await flushPromises();
    expect(wrapper.findAll('button.forecast-day')).toHaveLength(7);
    expect(wrapper.text()).toContain('7-day forecast');
    expect(wrapper.text()).toContain('Today');
    expect(wrapper.text()).toContain('70%');
    await wrapper.findAll('button.forecast-day')[0].trigger('click');
    expect(wrapper.find('.selected-forecast').text()).toContain('Light rain');
    expect(wrapper.find('.selected-forecast').text()).toContain('18 km/h');
    wrapper.unmount();
  });
  it('labels shorter provider forecasts without inventing the remaining days', async () => {
    mocks.load.mockResolvedValue({ ...fixture, ports: [{ ...fixture.ports[0], days: days.slice(0, 3) }] });
    const wrapper = mount(PortForecast, { props: { portId: 'batangas' } }); await flushPromises();
    expect(wrapper.findAll('button.forecast-day')).toHaveLength(3);
    expect(wrapper.text()).toContain('3-day forecast');
    expect(wrapper.text()).toContain('3 forecast days are currently available');
    wrapper.unmount();
  });
  it('ignores the old response after changing departure port', async () => {
    let resolve!: (value: unknown) => void;
    mocks.load.mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValueOnce({ configured: false, ports: [] });
    const wrapper = mount(PortForecast, { props: { portId: 'batangas' } });
    await wrapper.setProps({ portId: 'calapan' }); await flushPromises();
    resolve(fixture); await flushPromises();
    expect(mocks.load).toHaveBeenLastCalledWith('calapan');
    expect(wrapper.text()).not.toContain('Batangas');
    expect(wrapper.findAll('button.forecast-day')).toHaveLength(0);
    expect(wrapper.text()).toContain('currently unavailable');
    wrapper.unmount();
  });
});
