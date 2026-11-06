import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, toastMessages } from '../../src/composables/toast';
import {
  clearNotificationUnread,
  notificationUnreadCount,
  notificationUpdates,
  refreshNotificationUnread,
  syncNotificationOwner,
} from '../../src/composables/notificationUnread';
const mocks = vi.hoisted(() => ({ user: undefined as { uid: string } | undefined, list: vi.fn() }));
vi.mock('../../src/services/session', () => ({
  auth: {
    get currentUser() {
      return mocks.user;
    },
  },
  database: {},
}));
vi.mock('../../src/services/database/passenger', () => ({ myNotifications: mocks.list }));
const notice = (id: string) => ({
  id,
  title: 'New booking received',
  message: 'Booking ' + id,
  category: 'BOOKING',
  readAt: null,
  createdAt: '2026-10-31T11:00:00Z',
});
beforeEach(() => {
  mocks.user = undefined;
  syncNotificationOwner();
  mocks.user = { uid: 'staff' };
  vi.clearAllMocks();
  clearToasts();
});
describe('notification synchronization', () => {
  it('keeps the server unread total even when the summary contains only a bounded subset', async () => {
    mocks.list.mockResolvedValueOnce({
      data: { notifications: [notice('recent')], unreadCount: 120, totalCount: 300 },
    });
    await refreshNotificationUnread();
    expect(notificationUnreadCount.value).toBe(120);
    expect(mocks.list).toHaveBeenCalledWith({}, expect.objectContaining({ summary: true }));
    clearNotificationUnread('older', undefined, true);
    expect(notificationUnreadCount.value).toBe(119);
  });
  it('silently loads history, updates the inbox and badge, and announces each new unread notice once', async () => {
    mocks.list
      .mockResolvedValueOnce({ data: { notifications: [notice('old')] } })
      .mockResolvedValue({ data: { notifications: [notice('new'), notice('old')] } });
    await refreshNotificationUnread();
    expect(toastMessages.value).toHaveLength(0);
    expect(notificationUnreadCount.value).toBe(1);
    await refreshNotificationUnread();
    expect(notificationUnreadCount.value).toBe(2);
    expect(notificationUpdates.value?.items[0]?.id).toBe('new');
    expect(toastMessages.value).toHaveLength(1);
    expect(toastMessages.value[0]?.title).toBe('New booking received');
    await refreshNotificationUnread();
    expect(toastMessages.value).toHaveLength(1);
  });
  it('does not resurrect an unread notice after mark-read races a background refresh', async () => {
    mocks.list.mockResolvedValueOnce({ data: { notifications: [notice('one')] } });
    await refreshNotificationUnread();
    let finish!: (value: unknown) => void;
    mocks.list.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const request = refreshNotificationUnread();
    clearNotificationUnread('one');
    finish({ data: { notifications: [notice('one')] } });
    await request;
    expect(notificationUnreadCount.value).toBe(0);
  });
  it('discards the previous account response and private inbox during an account switch', async () => {
    let finish!: (value: unknown) => void;
    mocks.list.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const request = refreshNotificationUnread();
    mocks.user = { uid: 'passenger' };
    syncNotificationOwner();
    expect(notificationUpdates.value).toBe(null);
    expect(notificationUnreadCount.value).toBe(0);
    finish({ data: { notifications: [notice('staff-private')] } });
    await request;
    expect(notificationUnreadCount.value).toBe(0);
    expect(notificationUpdates.value).toBe(null);
    expect(toastMessages.value).toHaveLength(0);
  });
  it('keeps the last known count through a recoverable background failure', async () => {
    mocks.list.mockResolvedValueOnce({ data: { notifications: [notice('one')] } });
    await refreshNotificationUnread();
    mocks.list.mockRejectedValueOnce(new Error('Offline'));
    await refreshNotificationUnread();
    expect(notificationUnreadCount.value).toBe(1);
    expect(notificationUpdates.value?.items[0]?.id).toBe('one');
  });
  it('clears private inbox data when the server rejects changed role access', async () => {
    mocks.list.mockResolvedValueOnce({ data: { notifications: [notice('staff-only')] } });
    await refreshNotificationUnread();
    mocks.list.mockRejectedValueOnce({ code: '42501', message: 'Your account access changed.' });
    await refreshNotificationUnread();
    expect(notificationUnreadCount.value).toBe(0);
    expect(notificationUpdates.value?.items).toHaveLength(0);
  });
});
