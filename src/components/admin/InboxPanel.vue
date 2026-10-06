<template>
  <section class="catalog-panel">
    <p v-if="loading" role="status">Loading your inbox...</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <button v-if="error" @click="load">Retry</button>
    <p v-if="!loading && !error && !items.length">Your inbox is up to date. No notifications yet.</p>
    <article v-for="item in items" :key="item.id" class="catalog-panel">
      <h2>{{ item.title }}</h2><p>{{ item.message }}</p>
      <small>{{ new Date(item.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) }}</small>
      <button v-if="!item.readAt" :disabled="busy === item.id" @click="markRead(item.id)">Mark read</button>
    </article>
    <router-link to="/admin/notifications">Send a broadcast</router-link>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { staffDatabase } from "../../services/session";
import { myNotifications, markNotificationRead, type MyNotificationsData } from "../../services/database/passenger";
import { databaseRequestError } from "../../data/databaseErrors";
const items = ref<MyNotificationsData['notifications']>([]), loading = ref(false), error = ref(''), busy = ref('');
async function load() {
  if (!staffDatabase) return;
  loading.value = true; error.value = '';
  try { items.value = (await myNotifications(staffDatabase)).data.notifications; }
  catch (cause) { error.value = databaseRequestError(cause, 'Could not load your inbox.'); }
  finally { loading.value = false; }
}
async function markRead(id: string) {
  if (!staffDatabase || busy.value) return;
  busy.value = id;
  try { await markNotificationRead(staffDatabase, { id }); await load(); }
  catch (cause) { error.value = databaseRequestError(cause, 'Could not mark the notification read.'); }
  finally { busy.value = ''; }
}
onMounted(load);
</script>
