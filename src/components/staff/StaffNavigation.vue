<template>
  <nav class="staff-navigation" aria-label="Staff navigation">
    <p>WORKSPACE</p>
    <router-link
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      :class="{ active: route.path === item.to }"
      :aria-current="route.path === item.to ? 'page' : undefined"
      @click="$emit('navigate')"
      ><ion-icon :icon="item.icon" aria-hidden="true" />{{
        item.label
      }}</router-link
    >
  </nav>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { IonIcon } from "@ionic/vue";
import {
  enterOutline,
  personAddOutline,
  gridOutline,
  ticketOutline,
  peopleOutline,
  boatOutline,
  scanOutline,
  listOutline,
  personRemoveOutline,
  pricetagOutline,
} from "ionicons/icons";
const props = defineProps<{ role: "ticketing" | "boarding" }>();
defineEmits<{ navigate: [] }>();
const route = useRoute();
const items = computed(() =>
  props.role === "ticketing"
    ? [
        { label: "Dashboard", to: "/staff/ticketing", icon: gridOutline },
        {
          label: "Bookings",
          to: "/staff/ticketing/bookings",
          icon: ticketOutline,
        },
        {
          label: "Walk-in booking",
          to: "/staff/ticketing/walk-in",
          icon: personAddOutline,
        },
        {
          label: "Passengers",
          to: "/staff/ticketing/passengers",
          icon: peopleOutline,
        },
        { label: "Trips", to: "/staff/ticketing/trips", icon: boatOutline },
        { label: "Fares", to: "/staff/ticketing/fares", icon: pricetagOutline },
      ]
    : [
        { label: "Dashboard", to: "/staff/boarding", icon: gridOutline },
        {
          label: "Active trips",
          to: "/staff/boarding/trips",
          icon: boatOutline,
        },
        {
          label: "Check-in",
          to: "/staff/boarding/check-in",
          icon: scanOutline,
        },
        {
          label: "Boarding",
          to: "/staff/boarding/boarding",
          icon: enterOutline,
        },
        {
          label: "Manifest",
          to: "/staff/boarding/manifest",
          icon: listOutline,
        },
        {
          label: "No-shows",
          to: "/staff/boarding/no-shows",
          icon: personRemoveOutline,
        },
      ],
);
</script>
<style scoped>
.staff-navigation {
  display: grid;
  gap: 5px;
  align-content: start;
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin-top: 26px;
}
.staff-navigation p {
  margin: 16px 12px 6px;
  font-size: 9px;
  letter-spacing: 0.1em;
  color: #8199b0;
  font-weight: 700;
}
.staff-navigation a {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 41px;
  padding: 11px 12px;
  border-radius: 9px;
  color: #b7c9d9;
  text-decoration: none;
  font-size: 12px;
  font-weight: 550;
}
.staff-navigation a ion-icon {
  font-size: 18px;
  flex: none;
}
.staff-navigation a.active {
  background: #2196f3;
  color: white;
}
.staff-navigation a:hover {
  background: #ffffff12;
  color: white;
}
</style>
