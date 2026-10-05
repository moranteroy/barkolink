<template>
  <section
    v-if="ports.length"
    class="port-map"
    aria-label="Port location guide"
  >
    <div class="map-heading">
      <div>
        <p class="map-eyebrow">KNOW YOUR PORT</p>
        <h2>Find your way to the terminal.</h2>
        <p>Check the port location before your journey.</p>
      </div>
      <span class="map-icon"
        ><ion-icon :icon="locationOutline" aria-hidden="true"
      /></span>
    </div>
    <div class="port-tabs" role="group" aria-label="Choose a port">
      <button
        v-for="port in ports"
        :key="port.id"
        type="button"
        :aria-pressed="selected?.id === port.id"
        :class="{ selected: selected?.id === port.id }"
        @click="selectedId = port.id"
      >
        <ion-icon :icon="boatOutline" aria-hidden="true" /><span
          >{{ port.name }}<small v-if="port.city">{{ port.city }}</small></span
        >
      </button>
    </div>
    <div v-if="selected" class="map-window">
      <iframe
        :key="selected.id"
        :src="embedUrl"
        :title="`Google Maps location of ${selected.name}`"
        loading="lazy"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      ></iframe>
    </div>
    <div v-if="selected" class="map-footer">
      <span
        ><ion-icon :icon="locationOutline" aria-hidden="true" />{{
          selected.name
        }}<small v-if="selected.city">{{ selected.city }}</small></span
      ><a :href="directionsUrl" target="_blank" rel="noopener noreferrer"
        >Get directions <ion-icon :icon="openOutline" aria-hidden="true"
      /></a>
    </div>
    <p class="map-note">
      Directions help you reach the port. Your ferry schedule and boarding
      terminal are shown in your booking.
    </p>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { IonIcon } from "@ionic/vue";
import { openOutline, boatOutline, locationOutline } from "ionicons/icons";
import {
  googleMapDirections,
  googleMapEmbed,
  type MapPort,
} from "../../data/portMaps";
const props = defineProps<{ ports: MapPort[] }>();
const selectedId = ref("");
watch(
  () => props.ports,
  (ports) => {
    if (!ports.some((port) => port.id === selectedId.value))
      selectedId.value = ports[0]?.id || "";
  },
  { immediate: true },
);
const selected = computed(() =>
  props.ports.find((port) => port.id === selectedId.value),
);
const embedUrl = computed(() =>
  selected.value
    ? googleMapEmbed(
        selected.value,
        import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
      )
    : "",
);
const directionsUrl = computed(() =>
  selected.value ? googleMapDirections(selected.value) : "",
);
</script>
<style scoped>
.port-map {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--card-shadow);
  text-align: left;
}
.map-heading {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 26px 26px 18px;
}
.map-eyebrow {
  margin: 0 0 9px !important;
  color: var(--ocean) !important;
  font-size: 10px !important;
  font-weight: 800;
  letter-spacing: 0.14em;
}
.map-heading h2 {
  margin: 0 0 8px;
  font-size: clamp(21px, 3vw, 30px);
  letter-spacing: -0.04em;
}
.map-heading p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}
.map-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 24px;
}
.port-tabs {
  display: flex;
  gap: 9px;
  overflow-x: auto;
  padding: 0 26px 20px;
}
.port-tabs button {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-shrink: 0;
  padding: 11px 15px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-soft);
  color: var(--muted);
  font: inherit;
  cursor: pointer;
  text-align: left;
  font-size: 12px;
  font-weight: 700;
}
.port-tabs button.selected {
  border-color: var(--ocean);
  background: var(--light-blue);
  color: var(--ocean);
}
.port-tabs ion-icon {
  font-size: 19px;
}
.port-tabs small {
  display: block;
  margin-top: 3px;
  font-size: 10px;
  font-weight: 500;
}
.map-window {
  height: 330px;
  background: var(--surface-soft);
  border-block: 1px solid var(--line);
}
iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
.map-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  padding: 18px 26px;
}
.map-footer > span {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 800;
}
.map-footer small {
  color: var(--muted);
  font-weight: 500;
}
.map-footer a {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 15px;
  border-radius: 10px;
  background: var(--action);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
}
.map-note {
  margin: 0;
  padding: 0 26px 20px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}
@media (max-width: 600px) {
  .map-heading {
    padding: 20px 18px 16px;
  }
  .port-tabs {
    padding: 0 18px 16px;
  }
  .map-window {
    height: 280px;
  }
  .map-footer {
    padding: 16px 18px;
  }
  .map-note {
    padding: 0 18px 18px;
  }
  .map-footer small {
    display: none;
  }
}
</style>
