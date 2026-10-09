<template><section class="notification-inbox">          <section class="notification-toolbar" aria-label="Inbox overview">
            <span class="inbox-icon"><IonIcon :icon="notificationsOutline" aria-hidden="true" /></span>
            <div><strong>{{ unreadCount ? `${unreadCount} unread ${unreadCount === 1 ? 'update' : 'updates'}` : 'You are all caught up' }}</strong><p>{{ unreadCount ? 'Keep track of your latest account and operational updates.' : 'Your account notices and operational updates stay here.' }}</p></div>
            <button :disabled="noticeBusy || !!noticeUpdating || !unreadCount" @click="markAllRead"><IonIcon :icon="checkmarkOutline" aria-hidden="true" />{{ noticeBusy ? 'Updating...' : 'Mark all read' }}</button>
          </section>
<div class="inbox-actions"><label>Search notifications<input v-model="query" type="search" placeholder="Title or message" /></label><button :disabled="loading || !!busy" @click="load">Refresh inbox</button><router-link v-if="showBroadcast" to="/admin/notifications">Send a broadcast</router-link></div>
<p v-if="loading" role="status">Loading your inbox...</p><p v-if="error" role="alert" class="notice-error">{{ error }}<button :disabled="loading || !!busy" @click="load">Retry</button></p>
          <div class="notification-view" role="group" aria-label="Read status">
            <button :aria-pressed="!unreadOnly" :class="{ selected: !unreadOnly }" @click="unreadOnly = false">All updates <small>{{ notices.length }}</small></button>
            <button :aria-pressed="unreadOnly" :class="{ selected: unreadOnly }" @click="unreadOnly = true">Unread <small>{{ unreadCount }}</small></button>
          </div>
          <div class="notification-filters" role="group" aria-label="Notification category">
            <button v-for="category in notificationCategories" :key="category" :aria-pressed="notificationFilter === category" :aria-label="notificationCategoryLabel(category)" :class="{ active: notificationFilter === category }" @click="notificationFilter = category">
              <IonIcon :icon="noticeIcon(category)" aria-hidden="true" />{{ notificationCategoryLabel(category) }}<small aria-hidden="true">{{ notificationCategoryCount(category) }}</small>
            </button>
          </div>

          <p class="notification-results" aria-live="polite">{{ filteredNotices.length }} {{ filteredNotices.length === 1 ? 'update' : 'updates' }}<span>Latest first</span></p>
          <div v-if="filteredNotices.length" class="notifications">
            <article v-for="notice in filteredNotices" :key="notice.id" :class="{ unread: notice.unread }">
              <span class="notice-icon" :class="notice.type.toLowerCase()"><IonIcon :icon="noticeIcon(notice.type)" aria-hidden="true" /></span>
              <div class="notice-copy">
                <div class="notice-eyebrow"><span>{{ notificationCategoryLabel(notice.type) }}</span><b v-if="notice.unread"><i aria-hidden="true"></i>Unread</b></div>
                <h2>{{ notice.title }}</h2>
                <p>{{ notice.body }}</p>
                <div class="notice-footer"><time :datetime="notice.createdAt"><IonIcon :icon="timeOutline" aria-hidden="true" />{{ notice.time }}</time>
                  <button v-if="notice.unread" :disabled="noticeBusy || !!noticeUpdating" :aria-label="`Mark read: ${notice.title}`" @click="markNotice(notice)"><IonIcon :icon="checkmarkOutline" aria-hidden="true" />{{ noticeUpdating === notice.id ? 'Updating...' : 'Mark read' }}</button>
                  <span v-else class="notice-read"><IonIcon :icon="checkmarkCircleOutline" aria-hidden="true" />Read</span>
                </div>
              </div>
            </article>
          </div>
          <div v-else-if="!loading && !error" class="empty-state">
            <div class="empty-icon"><IonIcon :icon="notificationsOutline" aria-hidden="true" /></div>
            <h2>{{ query ? 'No matching notifications' : unreadOnly ? 'No unread updates' : notificationFilter !== 'ALL' ? `No ${notificationCategoryLabel(notificationFilter).toLowerCase()} updates` : 'Your inbox is ready' }}</h2>
            <p>{{ unreadOnly ? 'You have read all updates in this view. Check all updates to see your history.' : 'Account notices and operational updates will appear here.' }}</p>
            <button v-if="query || unreadOnly || notificationFilter !== 'ALL'" class="reset-notices" @click="query = ''; unreadOnly = false; notificationFilter = 'ALL'">View all updates</button>
          </div>
</section></template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { IonIcon } from '@ionic/vue';
import { notificationsOutline, checkmarkOutline, checkmarkCircleOutline, timeOutline, boatOutline, giftOutline, ticketOutline } from 'ionicons/icons';
import { staffDatabase, auth } from '../../services/session';
import { myNotifications, markNotificationRead, type MyNotificationsData } from '../../services/database/passenger';
import { markAllNotificationsRead } from '../../services/database/experience';
import { databaseRequestError } from '../../data/databaseErrors';
import { clearNotificationUnread, setUnreadNotifications } from '../../composables/notificationUnread';
withDefaults(defineProps<{ showBroadcast?: boolean }>(), { showBroadcast: true });
const items = ref<MyNotificationsData['notifications']>([]), loading = ref(false), error = ref(''), busy = ref('');
const query = ref(''), unreadOnly = ref(false), notificationFilter = ref('ALL');
const noticeBusy = computed(() => loading.value || busy.value === 'ALL'), noticeUpdating = computed(() => busy.value);
const date = (value: string) => new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
const notices = computed(() => items.value.map(item => ({ ...item, type: item.category || 'GENERAL', body: item.message, unread: !item.readAt, time: date(item.createdAt) })));
const unreadCount = computed(() => items.value.filter(item => !item.readAt).length);
const notificationCategories = computed(() => ['ALL', ...new Set(notices.value.map(item => item.type))]);
const filteredNotices = computed(() => notices.value.filter(item => (!unreadOnly.value || item.unread) && (notificationFilter.value === 'ALL' || item.type === notificationFilter.value) && (item.title + ' ' + item.body).toLowerCase().includes(query.value.trim().toLowerCase())));
function notificationCategoryLabel(value: string) { return ({ ALL: 'All categories', BOOKING: 'Bookings', TRIPS: 'Sailings', PROMO: 'Promos', GENERAL: 'General', SYSTEM: 'System' } as Record<string,string>)[value] || value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' '); }
function notificationCategoryCount(value: string) { return notices.value.filter(item => (value === 'ALL' || item.type === value) && (!unreadOnly.value || item.unread)).length; }
function noticeIcon(value: string) { return value === 'TRIPS' ? boatOutline : value === 'PROMO' ? giftOutline : value === 'BOOKING' ? ticketOutline : notificationsOutline; }
async function load() {
 if (!staffDatabase || loading.value || busy.value) return;
 loading.value = true; error.value = '';
 try { items.value = (await myNotifications(staffDatabase, { fetchPolicy: 'SERVER_ONLY' })).data.notifications.slice().sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt)); setUnreadNotifications(items.value); if(!notificationCategories.value.includes(notificationFilter.value)) notificationFilter.value = 'ALL'; }
 catch(cause) { error.value = databaseRequestError(cause, 'Could not load your inbox.'); }
 finally { loading.value = false; }
}
async function markNotice(notice: { id: string }) {
 if (!staffDatabase || busy.value || loading.value) return;
 const uid = auth?.currentUser?.uid;
 busy.value = notice.id; error.value = '';
 try { await markNotificationRead(staffDatabase, { id: notice.id }); clearNotificationUnread(notice.id, uid); const item = items.value.find(item => item.id === notice.id); if(item) item.readAt = new Date().toISOString(); }
 catch(cause) { error.value = databaseRequestError(cause, 'Could not mark the notification read.'); }
 finally { busy.value = ''; }
}
async function markAllRead() {
 if (!staffDatabase || busy.value || loading.value || !unreadCount.value) return;
 const uid = auth?.currentUser?.uid;
 busy.value = 'ALL'; error.value = '';
 try { await markAllNotificationsRead(staffDatabase); items.value.forEach(item => { if(!item.readAt) item.readAt = new Date().toISOString(); }); clearNotificationUnread(undefined, uid); }
 catch(cause) { error.value = databaseRequestError(cause, 'Could not mark notifications read.'); }
 finally { busy.value = ''; }
}
onMounted(load);
</script>
<style scoped>
.notification-inbox { min-width:0; color:var(--ink); font-family:var(--ion-font-family); }
.notification-inbox .notification-toolbar { grid-template-columns:44px minmax(0,1fr) auto; align-items:center; }
.notification-inbox .notification-toolbar button { grid-column:auto; }
.inbox-actions { display:flex; align-items:end; flex-wrap:wrap; gap:12px; margin-bottom:14px; }
.inbox-actions label { display:grid; gap:7px; flex:1; min-width:180px; color:var(--muted); font-size:12px; }
.inbox-actions input { width:100%; min-width:0; min-height:40px; padding:8px 12px; border:1px solid var(--line); border-radius:9px; color:var(--ink); background:var(--surface-soft); font:inherit; }
.inbox-actions button,.inbox-actions a,.notice-footer button,.notice-error button { display:inline-flex; align-items:center; justify-content:center; gap:6px; border:1px solid var(--line); border-radius:9px; background:var(--surface); color:var(--ocean); min-height:40px; padding:8px 12px; font:inherit; font-size:12px; text-decoration:none; }
.notice-icon { display:grid; place-items:center; font-size:22px; }
.notifications { display:grid; }
.notice-copy { min-width:0; }
.notice-copy p { white-space:pre-wrap; overflow-wrap:anywhere; color:var(--muted); }
.notice-footer button { margin-left:auto; }
.empty-state { text-align:center; }
.empty-icon { display:grid; place-items:center; width:40px; height:40px; margin:0 auto 12px; border-radius:11px; background:var(--light-blue); color:var(--ocean); font-size:22px; }
.notice-error button { margin-left:12px; }
.notification-inbox .notification-toolbar { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 10px 12px; margin: 0 0 18px; padding: 18px; border: 1px solid var(--line); border-radius: 16px; background: linear-gradient(120deg, var(--light-blue), var(--surface)); }
.notification-inbox .inbox-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 13px; background: var(--surface); color: var(--ocean); font-size: 24px; }
.notification-inbox .notification-toolbar strong { font-size: 15px; line-height: 1.5; }
.notification-inbox .notification-toolbar p { margin: 4px 0 0; color: var(--muted); font-size: 11px; line-height: 1.7; }
.notification-inbox .notification-toolbar button { grid-column: auto; justify-self: start; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 9px 12px; background: var(--surface); color: var(--ocean); border: 1px solid var(--line); border-radius: 9px; font: inherit; font-size: 12px; font-weight: 600; }
.notification-inbox .notification-view { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; padding: 5px; margin-bottom: 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); }
.notification-inbox .notification-view button { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); font: inherit; font-size: 12px; font-weight: 600; }
.notification-inbox .notification-view button.selected { background: var(--action); color: #fff; }
.notification-inbox .notification-view small { display: grid; place-items: center; min-width: 22px; padding: 2px 5px; border-radius: 5px; background: var(--surface); font-size: 10px; }
.notification-inbox .notification-view .selected small { background: #ffffff26; }
.notification-inbox .notification-filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 18px; }
.notification-inbox .notification-filters button { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface); color: var(--muted); font: inherit; font-size: 11px; font-weight: 500; }
.notification-inbox .notification-filters ion-icon { font-size: 15px; color: var(--ocean); }
.notification-inbox .notification-filters small { font-size: 10px; color: inherit; }
.notification-inbox .notification-filters .active { background: var(--light-blue); color: var(--ocean); border-color: var(--ocean); }
.notification-inbox .notification-results { display: flex; align-items: center; justify-content: space-between; margin: 0 0 12px; color: var(--muted); font-size: 11px; }
.notification-inbox .notification-results span { font-size: 10px; }
.notification-inbox .notifications { max-width: none; gap: 12px; }
.notification-inbox .notifications article { display: grid; grid-template-columns: 40px minmax(0, 1fr); align-items: start; gap: 12px; padding: 18px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); box-shadow: none; }
.notification-inbox .notifications article.unread { border-left: 3px solid var(--ocean); background: color-mix(in srgb, var(--light-blue) 25%, var(--surface)); }
.notification-inbox .notice-icon { width: 40px; height: 40px; border-radius: 11px; background: var(--light-blue); color: var(--ocean); }
.notification-inbox .notice-icon.promo { color: #937100; background: #fff2c9; }
.notification-inbox .notice-icon.general, .notification-inbox .notice-icon.system { color: #197767; background: #e1f4ed; }
.notification-inbox .notice-icon.trips { color: #8455bb; background: #f1e8ff; }
.notification-inbox .notice-eyebrow { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; font-size: 10px; color: var(--muted); }
.notification-inbox .notice-eyebrow b { display: inline-flex; align-items: center; gap: 5px; color: var(--ocean); font-size: 10px; font-weight: 600; }
.notification-inbox .notice-eyebrow i { width: 5px; height: 5px; border-radius: 50%; background: var(--ocean); }
.notification-inbox .notice-copy h2 { margin: 0; font-size: 14px; line-height: 1.6; font-weight: 650; overflow-wrap: anywhere; }
.notification-inbox .notice-copy p { margin: 7px 0 12px; font-size: 12px; line-height: 1.8; }
.notification-inbox .notice-footer { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; padding-top: 10px; border-top: 1px solid var(--line); }
.notification-inbox .notice-footer time, .notification-inbox .notice-read { display: inline-flex; align-items: center; gap: 5px; color: var(--muted); font-size: 10px; line-height: 1.7; }
.notification-inbox .notice-footer ion-icon { flex: none; font-size: 14px; }
.notification-inbox .notice-footer button { margin: 0; min-height: 40px; padding: 8px 10px; font-size: 11px; font-weight: 600; }
.notification-inbox .notice-read { margin-left: auto; }
.notification-inbox button { cursor: pointer; }
.notification-inbox button:disabled { opacity: .5; cursor: default; }
.notification-inbox button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
.notification-inbox .notice-error { padding: 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--danger); font-size: 12px; line-height: 1.7; }
.notification-inbox .empty-state { padding: 32px 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); }
.notification-inbox .empty-state h2 { font-family: inherit; font-size: 21px; }
.notification-inbox .empty-state p { font-size: 12px; line-height: 1.8; }
.notification-inbox .reset-notices { min-height: 44px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 9px; background: var(--light-blue); color: var(--ocean); font: inherit; font-size: 12px; }
:global(:root[data-theme="dark"]) .notification-inbox .notice-icon.promo { color: #f0ce75; background: #352d1a; }
:global(:root[data-theme="dark"]) .notification-inbox .notice-icon.general, :global(:root[data-theme="dark"]) .notification-inbox .notice-icon.system { color: #74d7bd; background: #17372e; }
:global(:root[data-theme="dark"]) .notification-inbox .notice-icon.trips { color: #c6a3f4; background: #30213e; }
@media(max-width:600px) {
  .notification-inbox .notification-toolbar { padding: 14px; }
  .notification-inbox .notifications article { padding: 14px; gap: 10px; grid-template-columns: 34px minmax(0,1fr); }
  .notification-inbox .notice-icon { width: 34px; height: 34px; }
}

@media(max-width:600px) { .notification-inbox .notification-toolbar { grid-template-columns:44px minmax(0,1fr); } .notification-inbox .notification-toolbar button { grid-column:2; } .inbox-actions label { flex-basis:100%; } .inbox-actions input { font-size:16px; min-height:44px; } .notification-inbox button { min-height:44px; } }
</style>
