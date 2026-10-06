<template>
  <ion-app :class="{ 'passenger-preview': isPassengerRoute }">
    <ion-router-outlet
      :key="sessionViewsKey"
      @ionRouteDidChange="refreshPassengerLayout"
    />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from "@ionic/vue";
import { computed, nextTick, watch, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { initializeTheme } from "./composables/useTheme";
import { sessionViewsKey } from "./composables/sessionViews";
import { auth } from "./services/session";
import { refreshNotificationUnread } from "./composables/notificationUnread";

initializeTheme();
const route = useRoute();
watch(() => [auth?.currentUser?.uid, route.fullPath], () => {
  void refreshNotificationUnread();
}, { immediate: true });
let notificationTimer: ReturnType<typeof setInterval>;
function refreshVisibleNotifications() {
  if (document.visibilityState === "visible") void refreshNotificationUnread();
}
onMounted(() => {
  notificationTimer = setInterval(refreshVisibleNotifications, 30000);
  window.addEventListener("focus", refreshVisibleNotifications);
  document.addEventListener("visibilitychange", refreshVisibleNotifications);
});
onUnmounted(() => {
  clearInterval(notificationTimer);
  window.removeEventListener("focus", refreshVisibleNotifications);
  document.removeEventListener("visibilitychange", refreshVisibleNotifications);
});
const passengerPaths = new Set([
  "/home",
  "/search",
  "/trip-details",
  "/passenger-info",
  "/booking-summary",
  "/booking-confirmed",
  "/bookings",
  "/booking-details",
  "/ticket",
  "/notifications",
  "/profile",
  "/travelers",
  "/help",
  "/settings",
  "/settings/appearance",
  "/settings/profile",
  "/settings/password",
]);
const isPassengerRoute = computed(() => passengerPaths.has(route.path) ||
  (route.path === "/privacy" && route.query.from === "profile"));
function refreshPassengerLayout() {
  if (!isPassengerRoute.value) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize"))),
  );
}
watch(isPassengerRoute, async () => {
  await nextTick();
  refreshPassengerLayout();
});
</script>

<style>
/* The passenger outlet is the container for compact page layouts. Its centered
   560px browser canvas and shared surfaces are defined in theme/ui.css. */
ion-app.passenger-preview {
  width: 100%;
  height: 100%;
}
ion-app.passenger-preview > ion-router-outlet {
  left: 0;
  right: 0;
  width: 100%;
  margin-inline: auto;
  container: passenger / inline-size;
}
ion-app.passenger-preview ion-content::part(scroll) {
  overflow-anchor: none;
}
@media (max-width: 599px) {
  ion-app.passenger-preview .bottom-nav {
    left: 0;
    right: 0;
    width: 100%;
    transform: none;
  }
}
</style>
