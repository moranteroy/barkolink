<template>
  <header class="passenger-header glass-toolbar">
    <a
      href="/home"
      class="brand-link"
      aria-label="BarkoLink home"
      @click="navigateHome"
      ><BrandMark
    /></a>
    <nav class="desktop-passenger-nav" aria-label="Passenger shortcuts">
      <a
        v-for="item in desktopLinks"
        :key="item.to"
        :href="item.to"
        :class="{
          selected: router.currentRoute.value.path === item.to.split('?')[0],
        }"
        :aria-current="
          router.currentRoute.value.path === item.to.split('?')[0]
            ? 'page'
            : undefined
        "
        @click="navigate($event, item.to)"
        >{{ item.label }}</a
      >
    </nav>
    <div class="header-actions">
      <a
        href="/notifications"
        class="notification-link"
        aria-label="Notifications"
        @click="navigateNotifications"
        ><ion-icon :icon="notificationsOutline"
      /></a>
      <a
        href="/profile"
        class="passenger-profile-chip"
        :aria-label="`Open profile for ${profileName}`"
        :title="`${profileName} · Passenger`"
        @click="navigateProfile"
      >
        <span class="passenger-profile-icon"
          ><ion-icon :icon="personOutline" aria-hidden="true"
        /></span>
        <span class="passenger-profile-copy"
          ><strong>{{ profileName }}</strong
          ><small>Passenger</small></span
        >
      </a>
      <button
        class="logout-button"
        type="button"
        aria-label="Log out"
        title="Log out"
        @click="logout"
      >
        <ion-icon :icon="logOutOutline" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { IonIcon, useIonRouter } from "@ionic/vue";
import { signOut } from "../../services/auth";
import {
  logOutOutline,
  notificationsOutline,
  personOutline,
} from "ionicons/icons";
import { auth } from "../../services/session";
import { clearSessionViews } from "../../composables/sessionViews";
import BrandMark from "../shared/BrandMark.vue";

const props = defineProps<{ name?: string }>();
const router = useRouter();
const ionRouter = useIonRouter();
const desktopLinks = [
  { label: "Home", to: "/home" },
  { label: "Find a ferry", to: "/search?all=1" },
  { label: "My bookings", to: "/bookings" },
];
const profileName = computed(
  () =>
    props.name?.trim() ||
    auth?.currentUser?.displayName?.trim() ||
    auth?.currentUser?.email?.split("@")[0] ||
    "Passenger User",
);

function navigate(event: MouseEvent, path: string) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  if (router.currentRoute.value.path !== path)
    ionRouter.navigate(path, "root", "push");
}
function navigateHome(event: MouseEvent) {
  navigate(event, "/home");
}
function navigateNotifications(event: MouseEvent) {
  navigate(event, "/notifications");
}
function navigateProfile(event: MouseEvent) {
  navigate(event, "/profile");
}
async function logout() {
  if (auth) await signOut(auth);
  await router.replace("/login");
  clearSessionViews();
}
</script>

<style scoped>
.passenger-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  min-height: 40px;
}
.brand-link {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  text-decoration: none;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
}
.notification-link {
  display: grid;
  place-items: center;
  width: 30px;
  height: 38px;
  color: var(--ink);
  font-size: 22px;
  text-decoration: none;
}
.passenger-profile-chip {
  display: flex;
  align-items: center;
  gap: 9px;
  flex: none;
  padding: 4px 12px 4px 4px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--ink);
  text-decoration: none;
}
.passenger-profile-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--light-blue);
  color: var(--ocean);
}
.passenger-profile-icon ion-icon {
  font-size: 17px;
}
.passenger-profile-copy {
  display: grid;
  gap: 2px;
}
.passenger-profile-copy strong {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}
.passenger-profile-copy small {
  color: var(--muted);
  font-size: 9px;
}
.passenger-profile-chip:focus-visible {
  outline: 2px solid var(--ocean);
  outline-offset: 3px;
}
.logout-button {
  display: grid;
  place-items: center;
  flex: none;
  width: 38px;
  height: 38px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: var(--surface);
  color: var(--ocean);
  font-size: 19px;
  cursor: pointer;
}
@media (max-width: 560px) {
  .passenger-profile-copy {
    display: none;
  }
  .passenger-profile-chip {
    padding: 3px;
    border: 0;
    background: transparent;
  }
}
@container passenger (max-width:480px) {
  .passenger-profile-copy {
    display: none;
  }
  .passenger-profile-chip {
    padding: 3px;
    border: 0;
    background: transparent;
  }
}
@container passenger (max-width:380px) {
  .header-actions {
    gap: 7px;
  }
  .brand-link :deep(.brand-symbol) {
    width: 34px;
    height: 34px;
  }
  .brand-link :deep(.brand-copy strong),
  .brand-link :deep(.brand-copy b) {
    font-size: 16px;
  }
  .brand-link :deep(.brand-copy small) {
    display: none;
  }
}
.desktop-passenger-nav {
  display: flex;
  gap: 6px;
  align-items: center;
}
.desktop-passenger-nav a {
  padding: 10px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
}
.desktop-passenger-nav a.selected {
  color: var(--ocean);
  background: var(--light-blue);
}
.desktop-passenger-nav a:hover {
  color: var(--ocean);
}
@media (max-width: 1000px) {
  .desktop-passenger-nav {
    display: none;
  }
}
@container passenger (max-width:900px) {
  .desktop-passenger-nav {
    display: none;
  }
}
</style>
