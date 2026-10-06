<template>
  <nav v-if="auth?.currentUser" class="bottom-nav glass-toolbar" aria-label="Passenger navigation">
    <a
      v-for="item in items"
      :key="item.label"
      :href="item.to"
      :class="{
        active:
          item.to === '/profile'
            ? currentPath === '/profile' ||
              currentPath.startsWith('/settings') ||
              currentPath === '/travelers'
            : currentPath === item.to.split('?')[0],
      }"
      :aria-current="
        (
          item.to === '/profile'
            ? currentPath === '/profile' ||
              currentPath.startsWith('/settings') ||
              currentPath === '/travelers'
            : currentPath === item.to.split('?')[0]
        )
          ? 'page'
          : undefined
      "
      @click="navigateTab($event, item.to)"
      ><ion-icon :icon="item.icon" /><span>{{ item.label }}</span></a
    >
  </nav>
</template>
<script setup lang="ts">
import { IonIcon, useIonRouter } from "@ionic/vue";
import { computed } from "vue";
import { useRoute } from "vue-router";
import { auth } from "../../services/session";
import {
  home,
  notificationsOutline,
  ticketOutline,
  boatOutline,
  personOutline,
} from "ionicons/icons";
const route = useRoute();
const ionRouter = useIonRouter();
const currentPath = computed(() => route.path);
const items = [
  { label: "Home", to: "/home", icon: home },
  { label: "Trips", to: "/search?all=1", icon: boatOutline },
  { label: "Bookings", to: "/bookings", icon: ticketOutline },
  { label: "Alerts", to: "/notifications", icon: notificationsOutline },
  { label: "Profile", to: "/profile", icon: personOutline },
];
function navigateTab(event: MouseEvent, path: string) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  if (route.fullPath === path) return;
  ionRouter.navigate(path, "root", "push");
}
</script>
<style scoped>
.bottom-nav {
  position: fixed;
  z-index: 20;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  gap: clamp(6px, 4cqw, 24px);
  padding: 11px 12px calc(11px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.94);
  border-top: 1px solid var(--line);
  backdrop-filter: blur(16px);
}
.bottom-nav a {
  display: grid;
  justify-items: center;
  align-content: center;
  flex: 1;
  max-width: 80px;
  min-width: 0;
  gap: 4px;
  color: #98a2b3;
  text-decoration: none;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.bottom-nav ion-icon {
  font-size: 20px;
}
.bottom-nav a.active {
  color: var(--ocean);
}
.bottom-nav a.active ion-icon {
  background: var(--light-blue);
  padding: 4px;
  border-radius: 8px;
  font-size: 19px;
}
</style>
