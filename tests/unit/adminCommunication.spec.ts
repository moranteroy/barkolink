import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdvisoriesPanel from '../../src/components/admin/AdvisoriesPanel.vue';
import NotificationsPanel from '../../src/components/admin/NotificationsPanel.vue';

const mocks = vi.hoisted(() => ({ advisories: vi.fn(), sailings: vi.fn(), save: vi.fn(), campaigns: vi.fn(), recipients: vi.fn(), send: vi.fn(), trips: vi.fn(), confirm: vi.fn() }));
vi.mock('../../src/services/session', () => ({ staffDatabase: {} }));
vi.mock('../../src/services/database/experience', () => ({ adminAdvisories: mocks.advisories, saveAdvisory: mocks.save }));
vi.mock('../../src/services/database/staff', () => ({ adminSailings: mocks.sailings }));
vi.mock('../../src/services/database/workspaces', () => ({ campaigns: mocks.campaigns, notificationRecipients: mocks.recipients, sendNotification: mocks.send, staffTrips: mocks.trips }));
vi.mock('../../src/composables/unsavedChanges', () => ({ useUnsavedChanges: vi.fn() }));
vi.mock('../../src/composables/confirmation', () => ({ confirmAction: mocks.confirm }));
vi.mock('@ionic/vue', () => ({ IonIcon: { template: '<span />' }, IonModal: { props: ['isOpen', 'canDismiss'], template: '<div v-if="isOpen" role="dialog"><slot /></div>' } }));
vi.mock('../../src/components/shared/RecordsGrid.vue', () => ({ default: {
  props: ['rows', 'columns'],
  template: '<div class="records-grid"><div v-for="row in rows" :key="row.key"><slot name="cell" v-for="(value, index) in row.cells" :row="row" :value="value" :index="index" /></div></div>',
} }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.advisories.mockResolvedValue({ data: { advisories: [] } });
  mocks.sailings.mockResolvedValue({ data: { sailings: [], totalCount: 0 } });
  mocks.campaigns.mockResolvedValue({ data: { campaigns: [], totalCount: 0 } });
  mocks.trips.mockResolvedValue({ data: { sailings: [], totalCount: 0 } });
  mocks.save.mockResolvedValue({}); mocks.recipients.mockResolvedValue({ data: { recipients: 7 } });
  mocks.send.mockResolvedValue({ data: { sent: 7 } }); mocks.confirm.mockResolvedValue(true);
});
async function advisory() {
  const wrapper = mount(AdvisoriesPanel, { props: { embedded: true } });
  await flushPromises(); await wrapper.find('.communication-heading button').trigger('click');
  await wrapper.find('form input').setValue('Weather update');
  await wrapper.find('form textarea').setValue('Expect delays at the port.');
  return wrapper;
}
async function broadcast() {
  const wrapper = mount(NotificationsPanel); await flushPromises();
  await wrapper.find('.catalog-tools button').trigger('click');
  await wrapper.find('form input').setValue('Welcome aboard');
  await wrapper.find('form textarea').setValue('Have your ticket ready.');
  return wrapper;
}
describe('admin communication compose dialogs', () => {
  it('saves an advisory in a modal with Philippine time converted to UTC', async () => {
    const wrapper = await advisory();
    const dates = wrapper.findAll('input[type="datetime-local"]');
    await dates[0].setValue('2026-10-06T08:00'); await dates[1].setValue('2026-10-06T09:00');
    await wrapper.find('form').trigger('submit'); await flushPromises();
    expect(mocks.save).toHaveBeenCalledWith({}, expect.objectContaining({ title: 'Weather update', startsAt: '2026-10-06T00:00:00.000Z', endsAt: '2026-10-06T01:00:00.000Z' }));
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false); wrapper.unmount();
  });
  it('rejects an invalid period and retains the form after a failed save', async () => {
    const wrapper = await advisory(); const dates = wrapper.findAll('input[type="datetime-local"]');
    await dates[0].setValue('2026-10-06T09:00'); await dates[1].setValue('2026-10-06T08:00');
    await wrapper.find('form').trigger('submit'); expect(mocks.save).not.toHaveBeenCalled();
    await dates[1].setValue('2026-10-06T10:00'); mocks.save.mockRejectedValue(new Error('Failed'));
    await wrapper.find('form').trigger('submit'); await flushPromises();
    expect(wrapper.find('[role="dialog"] [role="alert"]').exists()).toBe(true);
    expect((wrapper.find('form input').element as HTMLInputElement).value).toBe('Weather update'); wrapper.unmount();
  });
  it('preserves advisory input when discard is declined', async () => {
    const wrapper = await advisory(); mocks.confirm.mockResolvedValue(false);
    await wrapper.find('[aria-label="Close advisory"]').trigger('click'); await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true); expect(mocks.confirm).toHaveBeenCalled(); wrapper.unmount();
  });
  it('reviews the recipient count before sending and closes after success', async () => {
    const wrapper = await broadcast(); await wrapper.find('form').trigger('submit'); await flushPromises();
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('7 accounts') }));
    expect(mocks.send).toHaveBeenCalledWith({}, expect.objectContaining({ title: 'Welcome aboard', audience: 'PASSENGERS', requestId: expect.any(String) }));
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false); expect(wrapper.text()).toContain('Notification sent to 7 accounts.'); wrapper.unmount();
  });
  it('keeps broadcast input on failure and does not send to an empty audience', async () => {
    const wrapper = await broadcast(); mocks.recipients.mockResolvedValue({ data: { recipients: 0 } });
    await wrapper.find('form').trigger('submit'); await flushPromises();
    expect(mocks.send).not.toHaveBeenCalled(); expect(wrapper.find('form').text()).toContain('No eligible accounts');
    mocks.recipients.mockResolvedValue({ data: { recipients: 7 } }); mocks.send.mockRejectedValue(new Error('Failed'));
    await wrapper.find('form').trigger('submit'); await flushPromises();
    expect(wrapper.find('[role="dialog"] [role="alert"]').exists()).toBe(true);
    expect((wrapper.find('form input').element as HTMLInputElement).value).toBe('Welcome aboard'); wrapper.unmount();
  });
});
