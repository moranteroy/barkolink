import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InboxPanel from '../../src/components/admin/InboxPanel.vue';
import { clearNotificationUnread, notificationUnreadCount } from '../../src/composables/notificationUnread';

const mocks = vi.hoisted(() => ({ list: vi.fn(), markRead: vi.fn(), markAll: vi.fn() }));
vi.mock('../../src/services/session', () => ({
  auth: { currentUser: { uid: 'admin' } }, database: {}, staffDatabase: {},
}));
vi.mock('../../src/services/database/passenger', () => ({
  myNotifications: mocks.list, markNotificationRead: mocks.markRead,
}));
vi.mock('../../src/services/database/experience', () => ({ markAllNotificationsRead: mocks.markAll }));

beforeEach(() => {
  vi.clearAllMocks();
  clearNotificationUnread();
  mocks.list.mockResolvedValue({ data: { notifications: [
    { id: '1', title: 'New notice', message: 'Trip updated', createdAt: '2026-10-06T00:00:00Z', readAt: null },
    { id: '2', title: 'Earlier notice', message: 'Already read', createdAt: '2026-10-05T00:00:00Z', readAt: '2026-10-05T01:00:00Z' },
  ] } });
  mocks.markRead.mockResolvedValue({});
  mocks.markAll.mockResolvedValue({});
});

describe('admin inbox unread count', () => {
  it('counts unread notifications and clears the last unread after a successful mark read', async () => {
    const wrapper = mount(InboxPanel, { global: { stubs: { RouterLink: true } } });
    await flushPromises();
    expect(notificationUnreadCount.value).toBe(1);
    await wrapper.find('article button').trigger('click');
    await flushPromises();
    expect(mocks.markRead).toHaveBeenCalledWith({}, { id: '1' });
    expect(notificationUnreadCount.value).toBe(0);
    expect(wrapper.find('article button').exists()).toBe(false);
    wrapper.unmount();
  });

  it('keeps the notification unread when marking read fails', async () => {
    mocks.markRead.mockRejectedValue(new Error('Request failed'));
    const wrapper = mount(InboxPanel, { global: { stubs: { RouterLink: true } } });
    await flushPromises();
    await wrapper.find('article button').trigger('click');
    await flushPromises();
    expect(notificationUnreadCount.value).toBe(1);
    expect(wrapper.find('article button').exists()).toBe(true);
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    wrapper.unmount();
  });
  it('filters unread notifications and removes a read item from that view', async () => {
    const wrapper = mount(InboxPanel, { global: { stubs: { RouterLink: true } } });
    await flushPromises(); await wrapper.findAll('.notification-view button')[1].trigger('click');
    expect(wrapper.findAll('article')).toHaveLength(1);
    await wrapper.find('article button').trigger('click'); await flushPromises();
    expect(wrapper.findAll('article')).toHaveLength(0);
    expect(notificationUnreadCount.value).toBe(0);
    await wrapper.findAll('.notification-view button')[0].trigger('click'); expect(wrapper.findAll('article')).toHaveLength(2);
    await wrapper.find('input[type="search"]').setValue('Earlier'); expect(wrapper.findAll('article')).toHaveLength(1);
    wrapper.unmount();
  });

  it('marks all notifications read only after the service succeeds', async () => {
    const wrapper = mount(InboxPanel, { global: { stubs: { RouterLink: true } } });
    await flushPromises();
    mocks.markAll.mockRejectedValueOnce(new Error('Offline'));
    await wrapper.find('.notification-toolbar button').trigger('click'); await flushPromises();
    expect(notificationUnreadCount.value).toBe(1);
    expect(wrapper.find('article button').exists()).toBe(true);
    await wrapper.find('.notification-toolbar button').trigger('click'); await flushPromises();
    expect(notificationUnreadCount.value).toBe(0);
    expect(wrapper.find('article button').exists()).toBe(false);
    expect(wrapper.find('.notification-toolbar button').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });

  it('filters by category and hides broadcast creation for staff', async () => {
    mocks.list.mockResolvedValue({ data: { notifications: [
      { id: 'a', category: 'TRIPS', title: 'Sailing update', message: 'Departing soon', createdAt: '2026-10-06T00:00:00Z', readAt: null },
      { id: 'b', category: 'SYSTEM', title: 'Account notice', message: 'Updated', createdAt: '2026-10-05T00:00:00Z', readAt: null },
    ] } });
    const wrapper = mount(InboxPanel, { props: { showBroadcast: false }, global: { stubs: { RouterLink: true } } });
    await flushPromises();
    expect(wrapper.text()).not.toContain('Send a broadcast');
    await wrapper.find('[aria-label="Sailings"]').trigger('click');
    expect(wrapper.findAll('article')).toHaveLength(1);
    expect(wrapper.find('article').text()).toContain('Sailing update');
    wrapper.unmount();
  });

});
