import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import TravelersPage from '../../src/views/passenger/TravelersPage.vue';

const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), remove: vi.fn() }));
vi.mock('@ionic/vue', () => ({
  IonPage: { template: '<div><slot /></div>' },
  IonContent: { template: '<div><slot /></div>' },
  onIonViewWillEnter: vi.fn(),
}));
vi.mock('../../src/components/passenger/PassengerHeader.vue', () => ({ default: { template: '<header />' } }));
vi.mock('../../src/components/passenger/PassengerBottomNav.vue', () => ({ default: { template: '<nav />' } }));
vi.mock('../../src/services/session', () => ({ database: {} }));
vi.mock('../../src/services/database/experience', () => ({ savedTravelers: mocks.load, saveTraveler: mocks.save, deleteTraveler: mocks.remove }));
vi.mock('../../src/composables/toast', () => ({ notifyError: (message: string) => message, notifySuccess: (message: string) => message }));

const traveler = { id:'t1', fullName:'Ana Santos', birthDate:'1990-01-01', sex:'FEMALE', phone:'09123456789', nationality:'Filipino' };
async function fill(wrapper: ReturnType<typeof mount>) {
  const inputs = wrapper.findAll('form input');
  await inputs[0].setValue(traveler.fullName);
  await inputs[1].setValue(traveler.birthDate);
  await wrapper.get('form select').setValue(traveler.sex);
  await inputs[2].setValue(traveler.phone);
}
describe('Saved traveler recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.load.mockResolvedValue({data:{travelers:[]}});
    mocks.save.mockResolvedValue({data:{}});
  });
  it('shows retry instead of claiming the saved list is empty after a failed load', async () => {
    mocks.load.mockRejectedValueOnce(new Error('Offline'));
    const wrapper = mount(TravelersPage); await flushPromises();
    expect(wrapper.get('.traveler-list [role="alert"]').text()).toContain('Offline');
    expect(wrapper.get('.traveler-list').text()).not.toContain('No saved travelers yet');
    mocks.load.mockResolvedValue({data:{travelers:[traveler]}});
    await wrapper.get('.traveler-list button').trigger('click'); await flushPromises();
    expect(wrapper.get('.traveler-list').text()).toContain('Ana Santos');
    expect(wrapper.find('.traveler-list [role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it('links errors to the failing controls and blocks invalid data from being saved', async () => {
    const wrapper = mount(TravelersPage); await flushPromises();
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(4);
    for (const input of wrapper.findAll('[aria-invalid="true"]')) {
      expect(wrapper.get('#'+input.attributes('aria-describedby')).text()).not.toBe('');
    }
    await fill(wrapper);
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(0);
    wrapper.unmount();
  });
  it('keeps entered traveler details after a failed save', async () => {
    mocks.save.mockRejectedValueOnce(new Error('Save unavailable'));
    const wrapper = mount(TravelersPage); await flushPromises(); await fill(wrapper);
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Save unavailable');
    expect((wrapper.get('form input').element as HTMLInputElement).value).toBe(traveler.fullName);
    expect(wrapper.get('form button').attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });
});
