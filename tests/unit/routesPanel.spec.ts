import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RoutesPanel from '../../src/components/admin/RoutesPanel.vue';

const mocks = vi.hoisted(() => ({ routes: vi.fn(), ports: vi.fn(), save: vi.fn(), confirm: vi.fn() }));
vi.mock('../../src/services/session', () => ({ staffDatabase: {} }));
vi.mock('../../src/services/database/workspaces', () => ({ routes: mocks.routes, saveRoute: mocks.save }));
vi.mock('../../src/services/database/staff', () => ({ adminPorts: mocks.ports }));
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
const ports = [
  { id: 'btg', name: 'Batangas Port', isActive: true },
  { id: 'cal', name: 'Calapan Port', isActive: true },
];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.routes.mockResolvedValue({ data: { routes: [
    { id: 'r1', code: 'BTG-CAL', originPortId: 'btg', destinationPortId: 'cal', origin: ports[0], destination: ports[1], durationMinutes: 90, isActive: true },
    { id: 'r2', code: 'CAL-BTG', originPortId: 'cal', destinationPortId: 'btg', origin: ports[1], destination: ports[0], durationMinutes: 120, isActive: false },
  ] } });
  mocks.ports.mockResolvedValue({ data: { ports } });
  mocks.save.mockResolvedValue({});
  mocks.confirm.mockResolvedValue(true);
});
async function openForm() {
  const wrapper = mount(RoutesPanel, { global: { stubs: { RouterLink: true } } });
  await flushPromises();
  await wrapper.find('.directory-heading button').trigger('click');
  return wrapper;
}
describe('route directory and modal', () => {
  it('opens Add route in a dialog and saves the entered route', async () => {
    const wrapper = await openForm();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    await wrapper.find('#new-route-code').setValue('BTG-CAL-NEW');
    await wrapper.find('#new-route-origin').setValue('btg');
    await wrapper.find('#new-route-destination').setValue('cal');
    await wrapper.find('#new-route-duration').setValue('95');
    await wrapper.find('.route-form').trigger('submit');
    await flushPromises();
    expect(mocks.save).toHaveBeenCalledWith({}, expect.objectContaining({ code: 'BTG-CAL-NEW', originPortId: 'btg', destinationPortId: 'cal', durationMinutes: 95 }));
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it('keeps edited input and the dialog open when save fails', async () => {
    mocks.save.mockRejectedValue(new Error('Request failed'));
    const wrapper = await openForm();
    await wrapper.find('#new-route-code').setValue('BTG-CAL-NEW');
    await wrapper.find('#new-route-origin').setValue('btg');
    await wrapper.find('#new-route-destination').setValue('cal');
    await wrapper.find('.route-form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.route-form-error[role="alert"]').exists()).toBe(true);
    expect((wrapper.find('#new-route-code').element as HTMLInputElement).value).toBe('BTG-CAL-NEW');
    wrapper.unmount();
  });
  it('respects declined discard confirmation and rejects identical ports', async () => {
    mocks.confirm.mockResolvedValue(false);
    const wrapper = await openForm();
    await wrapper.find('#new-route-code').setValue('NEW');
    await wrapper.find('#new-route-origin').setValue('btg');
    await wrapper.find('#new-route-destination').setValue('cal');
    await wrapper.find('#new-route-origin').setValue('cal');
    await wrapper.find('.route-form').trigger('submit');
    await flushPromises();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Choose different origin and destination ports.');
    await wrapper.find('.route-close').trigger('click');
    await flushPromises();
    expect(mocks.confirm).toHaveBeenCalled();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    wrapper.unmount();
  });
  it('filters route status and resets the loaded list', async () => {
    const wrapper = mount(RoutesPanel, { global: { stubs: { RouterLink: true } } });
    await flushPromises();
    await wrapper.find('#route-filter-status').setValue('INACTIVE');
    expect(wrapper.findAll('.test-grid-row')).toHaveLength(1);
    expect(wrapper.find('.records-grid').text()).toContain('CAL-BTG');
    await wrapper.findAll('button').find(button => button.text() === 'Reset filters')!.trigger('click');
    expect(wrapper.findAll('.test-grid-row')).toHaveLength(2);
    wrapper.unmount();
  });
});
