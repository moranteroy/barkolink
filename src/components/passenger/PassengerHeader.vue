<template>
  <header class="passenger-header glass-toolbar">
    <a
      :href="auth?.currentUser ? '/home' : '/'"
      class="brand-link"
      aria-label="BarkoLink home"
      @click="navigateHome"
    ><BrandMark /></a>
    <nav class="header-links" aria-label="Notifications and account access">
      <RouterLink v-if="auth?.currentUser" to="/assistant" class="assistant-link" aria-label="Ask BarkoLink assistant" title="Ask your BarkoLink guide" :aria-current="router.currentRoute.value.path === '/assistant' ? 'page' : undefined"><BarkoMascot portrait /></RouterLink>
      <a v-if="auth?.currentUser" href="/notifications" class="notification-link"
        :aria-label="notificationUnreadCount ? `Notifications, ${notificationUnreadCount} unread` : 'Notifications'" title="Notifications"
        :aria-current="router.currentRoute.value.path === '/notifications' ? 'page' : undefined"
        @click="navigate($event, '/notifications')"
      ><IonIcon :icon="notificationsOutline" aria-hidden="true" /><span v-if="notificationUnreadCount" class="notification-badge" aria-hidden="true">{{ notificationUnreadCount > 99 ? '99+' : notificationUnreadCount }}</span></a>
      <RouterLink v-else to="/login">Sign in</RouterLink>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { RouterLink, useRouter } from "vue-router";
import { IonIcon, useIonRouter } from "@ionic/vue";
import { notificationsOutline } from "ionicons/icons";
import { auth } from "../../services/session";
import BrandMark from "../shared/BrandMark.vue";
import BarkoMascot from "../shared/BarkoMascot.vue";
import { notificationUnreadCount } from "../../composables/notificationUnread";

const router = useRouter();
const ionRouter = useIonRouter();
function navigateHome(event: MouseEvent) {
  navigate(event, auth?.currentUser ? "/home" : "/");
}
function navigate(event: MouseEvent, path: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (router.currentRoute.value.path !== path) ionRouter.navigate(path, "root", "push");
}
</script>

<style scoped>
.passenger-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  min-height: 44px;
}
.brand-link {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  text-decoration: none;
}
.header-links {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
}
.header-links a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 6px;
  color: var(--ocean);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}
.header-links a:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}
.header-links .notification-link,
.header-links .assistant-link {
  position: relative;
  width: 44px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-soft);
  color: var(--ink);
  font-size: 21px;
}
.notification-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  display: grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border: 2px solid var(--surface);
  border-radius: 999px;
  background: #c73646;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.header-links .notification-link:hover,
.header-links .assistant-link:hover,
.header-links .assistant-link[aria-current="page"],
.header-links .notification-link[aria-current="page"] {
  background: var(--light-blue);
  color: var(--ocean);
  text-decoration: none;
}
.brand-link:focus-visible,
.header-links a:focus-visible {
  outline: 2px solid var(--ocean);
  outline-offset: 3px;
  border-radius: 6px;
}
@container passenger (max-width:380px) {
  .brand-link :deep(.brand-symbol) { width: 34px; height: 34px; }
  .brand-link :deep(.brand-copy strong),
  .brand-link :deep(.brand-copy b) { font-size: 16px; }
  .brand-link :deep(.brand-copy small) { display: none; }
}
</style>
