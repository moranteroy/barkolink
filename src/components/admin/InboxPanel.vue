<template>
  <section class="catalog-panel notification-inbox">
    <div class="communication-heading"><div><p class="eyebrow">YOUR NOTIFICATIONS</p><h2>Inbox</h2><p>{{ unreadCount }} unread / {{ items.length }} notifications</p></div><router-link class="broadcast-link" to="/admin/notifications">Send a broadcast</router-link></div>
    <div class="communication-filters"><label>Search notifications<input v-model="query" type="search" placeholder="Title or message" /></label><label>Show<select v-model="filter"><option value="ALL">All notifications</option><option value="UNREAD">Unread</option><option value="READ">Read</option></select></label><button :disabled="loading || !!busy" @click="load">Refresh inbox</button></div>
    <p v-if="loading" role="status">Loading your inbox...</p>
    <p v-if="error" class="catalog-error" role="alert">{{ error }}</p>
    <button v-if="error" :disabled="loading || !!busy" @click="load">Retry</button>
    <div v-if="!loading && !error && !visibleItems.length" class="communication-empty"><h3>{{ items.length ? 'No matching notifications' : 'Your inbox is up to date' }}</h3><p>{{ items.length ? 'Try another search or change the read status filter.' : 'New updates will appear here.' }}</p></div>
    <div class="notification-list">
    <article v-for="item in visibleItems" :key="item.id" class="notification-card" :class="{ unread: !item.readAt }">
      <div class="notification-card-heading"><h3>{{ item.title }}</h3><Badge :variant="item.readAt ? 'default' : 'warning'">{{ item.readAt ? 'Read' : 'Unread' }}</Badge></div><p>{{ item.message }}</p>
      <div class="notification-card-footer"><time :datetime="item.createdAt">{{ date(item.createdAt) }}</time><button v-if="!item.readAt" :disabled="!!busy || loading" @click="markRead(item.id)">{{ busy === item.id ? 'Marking...' : 'Mark read' }}</button><span v-else>Marked as read</span></div>
    </article>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { staffDatabase } from "../../services/session";
import { myNotifications, markNotificationRead, type MyNotificationsData } from "../../services/database/passenger";
import { databaseRequestError } from "../../data/databaseErrors";
import { clearNotificationUnread, setUnreadNotifications } from "../../composables/notificationUnread";
import { Badge } from "@/components/ui/badge";
import "../../theme/communication.css";
const items = ref<MyNotificationsData['notifications']>([]), loading = ref(false), error = ref(''), busy = ref('');
const query = ref(''), filter = ref('ALL');
const unreadCount = computed(() => items.value.filter(item => !item.readAt).length);
const visibleItems = computed(() => items.value.filter(item => (filter.value === 'ALL' || (filter.value === 'READ' ? !!item.readAt : !item.readAt)) && `${item.title} ${item.message}`.toLowerCase().includes(query.value.trim().toLowerCase())));
const date = (value: string) => new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
async function load() {
  if (!staffDatabase || loading.value || busy.value) return;
  loading.value = true; error.value = '';
  try {
    items.value = (await myNotifications(staffDatabase, { fetchPolicy: "SERVER_ONLY" })).data.notifications;
    setUnreadNotifications(items.value);
  }
  catch (cause) { error.value = databaseRequestError(cause, 'Could not load your inbox.'); }
  finally { loading.value = false; }
}
async function markRead(id: string) {
  if (!staffDatabase || busy.value) return;
  busy.value = id; error.value = "";
  try {
    await markNotificationRead(staffDatabase, { id });
    clearNotificationUnread(id);
    const item = items.value.find(item => item.id === id);
    if (item) item.readAt = new Date().toISOString();
  }
  catch (cause) { error.value = databaseRequestError(cause, 'Could not mark the notification read.'); }
  finally { busy.value = ''; }
}
onMounted(load);
</script>
