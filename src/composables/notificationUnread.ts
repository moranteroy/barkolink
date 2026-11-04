import { computed, ref, shallowRef, readonly } from "vue";
import { auth, database } from "../services/session";
import { myNotifications, type MyNotificationsData } from "../services/database/passenger";

import { notify, clearToasts } from './toast';
const latestUpdate = shallowRef<{uid:string;items:MyNotificationsData['notifications'];totalCount?:number}|null>(null);
export const notificationUpdates = readonly(latestUpdate);
let seenIds: Set<string> | undefined;
const unreadIds = ref<string[]>([]);
const unreadTotal = ref(0);
let owner: string | undefined;
let revision = 0;
let pending: Promise<void> | undefined;
export const notificationUnreadCount = computed(() => unreadTotal.value);

export function syncNotificationOwner() {
  const uid = auth?.currentUser?.uid;
  if (owner !== uid) {
    owner = uid;
    revision++;
    unreadIds.value = [];
    unreadTotal.value = 0;
    latestUpdate.value=null;seenIds=undefined;
    pending = undefined;
  }
  return uid;
}

export function setUnreadNotifications(items: { id: string; readAt?: string | null }[], uid = auth?.currentUser?.uid, total?:number) {
  if (!uid || uid !== auth?.currentUser?.uid) return;
  syncNotificationOwner();
  revision++;
  unreadIds.value = [...new Set(items.filter(item => !item.readAt).map(item => item.id))];
  unreadTotal.value = total ?? unreadIds.value.length;
}

export function clearNotificationUnread(id?: string, uid = auth?.currentUser?.uid, knownUnread=false) {
  if (!uid || uid !== auth?.currentUser?.uid) return;
  syncNotificationOwner();
  revision++;
  if (!id) unreadTotal.value = 0;
  else if (knownUnread || unreadIds.value.includes(id)) unreadTotal.value = Math.max(0,unreadTotal.value-1);
  unreadIds.value = id ? unreadIds.value.filter(value => value !== id) : [];
}

export function refreshNotificationUnread(): Promise<void> {
  const uid = syncNotificationOwner();
  if (!uid || !database) return Promise.resolve();
  if (pending) return pending;
  const version = revision;
  const request = myNotifications(database, { fetchPolicy: "SERVER_ONLY", summary:true })
    .then(result => {
      if (auth?.currentUser?.uid === uid && revision === version) {
        const items=result.data.notifications;
        const fresh=seenIds ? items.filter(item=>!item.readAt&&!seenIds!.has(item.id)) : [];
        seenIds=new Set(items.map(item=>item.id));
        setUnreadNotifications(items,uid,result.data.unreadCount);
        latestUpdate.value={uid,items:items.map(item=>({...item})),totalCount:result.data.totalCount};
        if(fresh.length===1)notify(fresh[0]!.message,'info',fresh[0]!.title);
        else if(fresh.length>1)notify(`${fresh.length} new updates are available in your notifications.`,'info','New notifications');
      }
    })
    // Keep the last known count when a background refresh fails.
    .catch((cause:{code?:string}) => {
      if(auth?.currentUser?.uid===uid && revision===version && ['42501','PGRST301'].includes(cause?.code||'')){
        revision++;unreadIds.value=[];unreadTotal.value=0;seenIds=undefined;latestUpdate.value={uid,items:[]};clearToasts();
      }
    })
    .finally(() => { if (pending === request) pending = undefined; });
  pending = request;
  return request;
}
