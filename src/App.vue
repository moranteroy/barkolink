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
import { computed, nextTick, watch } from "vue";
import { useRoute } from "vue-router";
import { initializeTheme } from "./composables/useTheme";
import { sessionViewsKey } from "./composables/sessionViews";

initializeTheme();
const route = useRoute();
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
const isPassengerRoute = computed(() => passengerPaths.has(route.path));
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
