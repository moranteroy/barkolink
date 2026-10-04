<template>
  <ion-app :class="{ 'passenger-preview': isPassengerRoute }">
    <ion-router-outlet :key="sessionViewsKey" @ionRouteDidChange="refreshPassengerLayout" />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { computed, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { initializeTheme } from './composables/useTheme';
import { sessionViewsKey } from './composables/sessionViews';

initializeTheme();
const route = useRoute();
const passengerPaths = new Set(['/home', '/search', '/trip-details', '/passenger-info', '/booking-summary', '/booking-confirmed', '/bookings', '/booking-details', '/ticket', '/notifications', '/profile', '/settings', '/settings/appearance', '/settings/profile', '/settings/password']);
const isPassengerRoute = computed(() => passengerPaths.has(route.path));
function refreshPassengerLayout() {
  if (!isPassengerRoute.value) return;
  requestAnimationFrame(() => requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))));
}
watch(isPassengerRoute, async () => {
  await nextTick();
  refreshPassengerLayout();
});
</script>

<style>
@media (min-width: 600px) {
  body:has(ion-app.passenger-preview) { background: #e9eff5; }
  ion-app.passenger-preview { top: 0; height: 100%; width: min(100%, 430px); margin-inline: auto; overflow: hidden; box-shadow: 0 18px 55px #102b4c24; }
  :root[data-theme='dark'] body:has(ion-app.passenger-preview) { background: #08111d; }
}
/* Ionic keeps the router outlet alive across routes. Size the outlet itself so
   a page entering from the desktop login screen has a 430px layout immediately. */
ion-app.passenger-preview > ion-router-outlet {
  left: 0;
  right: 0;
  width: min(100%, 430px);
  margin-inline: auto;
  container: passenger / inline-size;
}
ion-app.passenger-preview ion-content::part(scroll) { overflow-anchor: none; }
ion-app.passenger-preview .bottom-nav { left: 50%; right: auto; width: min(100%, 430px); transform: translateX(-50%); }
@media (max-width: 599px) { ion-app.passenger-preview, ion-app.passenger-preview > ion-router-outlet, ion-app.passenger-preview .bottom-nav { width: 100%; } }
</style>
