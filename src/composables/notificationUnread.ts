import { computed, ref } from "vue";
import { auth, database } from "../services/session";
import { myNotifications } from "../services/database/passenger";

const unreadIds = ref<string[]>([]);
let owner: string | undefined;
let revision = 0;
let pending: Promise<void> | undefined;
export const notificationUnreadCount = computed(() => unreadIds.value.length);

export function syncNotificationOwner() {
  const uid = auth?.currentUser?.uid;
  if (owner !== uid) {
    owner = uid;
    revision++;
    unreadIds.value = [];
    pending = undefined;
  }
  return uid;
}

export function setUnreadNotifications(items: { id: string; readAt?: string | null }[], uid = auth?.currentUser?.uid) {
  if (!uid || uid !== auth?.currentUser?.uid) return;
  syncNotificationOwner();
  revision++;
  unreadIds.value = [...new Set(items.filter(item => !item.readAt).map(item => item.id))];
}

export function clearNotificationUnread(id?: string, uid = auth?.currentUser?.uid) {
  if (!uid || uid !== auth?.currentUser?.uid) return;
  syncNotificationOwner();
  revision++;
  unreadIds.value = id ? unreadIds.value.filter(value => value !== id) : [];
}

export function refreshNotificationUnread(): Promise<void> {
  const uid = syncNotificationOwner();
  if (!uid || !database) return Promise.resolve();
  if (pending) return pending;
  const version = revision;
  const request = myNotifications(database, { fetchPolicy: "SERVER_ONLY" })
    .then(result => {
      if (auth?.currentUser?.uid === uid && revision === version)
        setUnreadNotifications(result.data.notifications);
    })
    // Keep the last known count when a background refresh fails.
    .catch(() => undefined)
    .finally(() => { if (pending === request) pending = undefined; });
  pending = request;
  return request;
}
