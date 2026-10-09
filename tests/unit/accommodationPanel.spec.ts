import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccommodationPanel from '../../src/components/admin/AccommodationPanel.vue';

const mocks = vi.hoisted(() => ({ list: vi.fn(), vessels: vi.fn(), save: vi.fn(), confirm: vi.fn() }));
vi.mock('../../src/services/session', () => ({ staffDatabase: {} }));
vi.mock('../../src/services/database/workspaces', () => ({ accommodations: mocks.list, saveAccommodation: mocks.save }));
vi.mock('../../src/services/database/staff', () => ({ adminVessels: mocks.vessels }));
vi.mock('../../src/composables/unsavedChanges', () => ({ useUnsavedChanges: vi.fn() }));
vi.mock('../../src/composables/confirmation', () => ({ confirmAction: mocks.confirm }));
vi.mock('../../src/components/shared/RecordsGrid.vue', () => ({ default: {
  props: ['rows', 'columns', 'density', 'maxGridHeight', 'actionWidth'],
  template: '<div class="records-grid"><div v-for="row in rows" :key="row.key" class="test-grid-row"><slot name="cell" v-for="(value, index) in row.cells" :row="row" :value="value" :index="index" /><slot name="actions" :row="row" /></div></div>',
} }));
vi.mock('@ionic/vue', () => ({
  IonIcon: { template: '<span />' },
  IonModal: { props: ['isOpen', 'canDismiss'], template: '<div v-if="isOpen" role="dialog"><slot /></div>' },
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({ data: { accommodations: [
    { id: 'a1', vesselId: 'v1', vesselName: 'Ferry One', name: 'Economy', description: '', capacity: 60, surcharge: 0, isActive: true },
    { id: 'a2', vesselId: 'v1', vesselName: 'Ferry One', name: 'Business', description: '', capacity: 20, surcharge: 200, isActive: false },
  ] } });
  mocks.vessels.mockResolvedValue({ data: { vessels: [{ id: 'v1', name: 'Ferry One', passengerCapacity: 100, isActive: true }] } });
  mocks.save.mockResolvedValue({});
  mocks.confirm.mockResolvedValue(true);
});
async function openForm() {
  const wrapper = mount(AccommodationPanel, { global: { stubs: { RouterLink: true } } });
  await flushPromises();
  await wrapper.find('.directory-heading button').trigger('click');
  await wrapper.find('.accommodation-field-grid select').setValue('v1');
  await wrapper.find('#accommodation-class-name').setValue('Premium');
  return wrapper;
}
describe('accommodation modal and capacity', () => {
  it('opens in a dialog and saves capacity and surcharge', async () => {
    const wrapper = await openForm();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.find('.capacity-note').text()).toContain('40 seats available');
    await wrapper.findAll('.accommodation-field-grid input[type="number"]')[0].setValue('40');
    await wrapper.findAll('.accommodation-field-grid input[type="number"]')[1].setValue('100');
    await wrapper.find('.accommodation-form').trigger('submit');
    await flushPromises();
    expect(mocks.save).toHaveBeenCalledWith({}, expect.objectContaining({ vesselId: 'v1', name: 'Premium', capacity: 40, surcharge: 100, isActive: true }));
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it('rejects allocating more seats than are available and keeps declined discard changes', async () => {
    mocks.confirm.mockResolvedValue(false);
    const wrapper = await openForm();
    await wrapper.findAll('.accommodation-field-grid input[type="number"]')[0].setValue('41');
    await wrapper.find('.accommodation-form').trigger('submit');
    await flushPromises();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(wrapper.find('.form-error').text()).toContain('remaining seats');
    await wrapper.find('.dialog-close').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    wrapper.unmount();
  });
  it('retains input and shows save failures inside the modal', async () => {
    mocks.save.mockRejectedValue(new Error('Request failed'));
    const wrapper = await openForm();
    await wrapper.find('.accommodation-form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('[role="dialog"] [role="alert"]').exists()).toBe(true);
    expect((wrapper.find('#accommodation-class-name').element as HTMLSelectElement).value).toBe('Premium');
    wrapper.unmount();
  });
  it('filters inactive classes and resets the directory', async () => {
    const wrapper = mount(AccommodationPanel, { global: { stubs: { RouterLink: true } } });
    await flushPromises();
    await wrapper.find('#accommodation-status').setValue('INACTIVE');
    expect(wrapper.findAll('.test-grid-row')).toHaveLength(1);
    expect(wrapper.find('.records-grid').text()).toContain('Business');
    await wrapper.findAll('button').find(button => button.text() === 'Reset filters')!.trigger('click');
    expect(wrapper.findAll('.test-grid-row')).toHaveLength(2);
    wrapper.unmount();
  });
  it('preserves an existing custom class in the dropdown when editing', async () => {
    mocks.list.mockResolvedValue({ data: { accommodations: [
      { id: 'a3', vesselId: 'v1', vesselName: 'Ferry One', name: 'Private cabin', description: '', capacity: 10, surcharge: 300, isActive: true },
    ] } });
    const wrapper = mount(AccommodationPanel, { global: { stubs: { RouterLink: true } } });
    await flushPromises();
    await wrapper.find('.class-edit').trigger('click');
    const select = wrapper.find('#accommodation-class-name');
    expect(select.findAll('option').map(option => option.text())).toEqual(expect.arrayContaining(['Economy', 'Tourist', 'Premium', 'Business', 'Private cabin']));
    expect((select.element as HTMLSelectElement).value).toBe('Private cabin');
    await wrapper.find('.accommodation-form').trigger('submit');
    await flushPromises();
    expect(mocks.save).toHaveBeenCalledWith({}, expect.objectContaining({ id: 'a3', name: 'Private cabin' }));
    wrapper.unmount();
  });
});
