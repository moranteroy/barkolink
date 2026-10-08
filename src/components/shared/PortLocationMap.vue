<template>
  <section v-if="ports.length" class="port-map" aria-label="Port location guide">
    <div class="map-heading">
      <p class="map-eyebrow">{{ journey ? 'YOUR JOURNEY ON THE MAP' : 'KNOW YOUR PORT' }}</p>
      <h2>{{ journey ? 'Know your departure and arrival ports.' : 'Find your way to the terminal.' }}</h2>
      <p>Explore the port areas before you travel.</p>
    </div>
    <div class="port-tabs" role="group" aria-label="Choose a port">
      <button v-for="(port, index) in ports" :key="port.id" type="button"
        :aria-pressed="selected?.id === port.id" :class="{ selected: selected?.id === port.id }" @click="choosePort(port)">
        <span class="port-letter" :class="{ arrival: journey && index > 0 }">{{ portLetter(index) }}</span>
        <span><small>{{ portRole(index) }}</small>{{ port.name }}</span>
      </button>
    </div>
    <div class="map-window">
      <div ref="mapElement" class="leaflet-map" aria-label="Interactive port map"></div>
      <button v-if="locatedPorts.length > 1 && ready" class="show-ports" type="button" @click="showAll">{{ journey ? 'View both ports' : 'View all ports' }}</button>
      <p v-if="!locatedPorts.length || mapError" class="map-empty" role="status">{{ mapError || 'Map location is not yet available for these ports. You can still open directions below.' }}</p>
    </div>
    <p v-if="tileError" class="map-status" role="status">Map tiles could not load. Check your connection. <button type="button" @click="retryTiles">Retry map</button></p>
    <p v-if="selected && !portCoordinates(selected) && locatedPorts.length" class="map-status" role="status">{{ selected.name }} has no verified map location yet. Use Get directions to search for this port.</p>
    <div v-if="selected" class="map-footer">
      <span><strong>{{ selected.name }}</strong><small>{{ [selected.city, selected.region].filter(Boolean).join(', ') }}</small></span>
      <a :href="directionsUrl" target="_blank" rel="noopener noreferrer">Get directions <ion-icon :icon="openOutline" aria-hidden="true" /></a>
    </div>
    <p class="map-note">Markers show port areas. Confirm your exact boarding terminal in your booking.<template v-if="journey"> The dashed line connects ports for reference; it is not the vessel’s sailing path.</template></p>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { IonIcon } from '@ionic/vue';
import { openOutline } from 'ionicons/icons';
import type { Map, LayerGroup, Marker, TileLayer } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { googleMapDirections, portCoordinates, type MapPort } from '../../data/portMaps';
const props = defineProps<{ ports: MapPort[]; journey?: boolean }>();
const portLetter = (index: number) => props.journey ? (index === 0 ? 'A' : 'B') : String(index + 1);
const portRole = (index: number) => props.journey ? (index === 0 ? 'Departure' : 'Arrival') : 'Port location';
const selectedId = ref(''), mapElement = ref<HTMLElement>(), ready = ref(false), tileError = ref(false), mapError = ref('');
const selected = computed(() => props.ports.find(p => p.id === selectedId.value));
const directionsUrl = computed(() => selected.value ? googleMapDirections(selected.value) : '');
const locatedPorts = computed(() => props.ports.flatMap((port, index) => {
  const point = portCoordinates(port); return point ? [{ port, point, index }] : [];
}));
let map: Map | undefined, layers: LayerGroup | undefined, tiles: TileLayer | undefined;
let observer: ResizeObserver | undefined, generation = 0;
const markers = new globalThis.Map<string, Marker>();
function destroyMap() {
  observer?.disconnect(); observer = undefined;
  map?.remove(); map = undefined; layers = undefined; tiles = undefined;
  markers.clear(); ready.value = false;
}
function showAll() {
  if (!map || !locatedPorts.value.length) return;
  map.invalidateSize();
  if (locatedPorts.value.length === 1) map.setView(locatedPorts.value[0].point, 14);
  else map.fitBounds(locatedPorts.value.map(p => p.point), { padding: [48, 48], maxZoom: 14 });
}
function choosePort(port: MapPort) {
  selectedId.value = port.id;
  const point = portCoordinates(port);
  if (map && point) { map.setView(point, 14); markers.get(port.id)?.openPopup(); }
}
function retryTiles() { tileError.value = false; tiles?.redraw(); }
watch(() => props.ports, ports => {
  if (!ports.some(p => p.id === selectedId.value)) selectedId.value = ports[0]?.id || '';
}, { immediate: true, deep: true });
watch([mapElement, locatedPorts], async () => {
  const current = ++generation;
  mapError.value = ''; tileError.value = false;
  if (!mapElement.value || !locatedPorts.value.length) { destroyMap(); return; }
  try {
    const L = await import('leaflet');
    if (current !== generation || !mapElement.value) return;
    if (!map) {
      map = L.map(mapElement.value, { scrollWheelZoom: false });
      tiles = L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      tiles.on('tileerror', () => { tileError.value = true; });
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => { if (mapElement.value?.clientWidth) showAll(); });
        observer.observe(mapElement.value);
      }
    }
    layers?.remove(); markers.clear(); layers = L.layerGroup().addTo(map);
    for (const { port, point, index } of locatedPorts.value) {
      const letter = portLetter(index);
      const popup = document.createElement('div');
      const label = document.createElement('strong'); label.textContent = `${portRole(index)} · ${port.name}`;
      const city = document.createElement('p'); city.textContent = [port.city, port.region].filter(Boolean).join(', ');
      popup.append(label, city);
      const marker = L.marker(point, { title: `${letter}: ${port.name}`, alt: `${portRole(index)}: ${port.name}`,
        icon: L.divIcon({ className: `port-pin ${props.journey && index > 0 ? 'arrival' : ''}`, html: `<span>${letter}</span>`, iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -38] }),
      }).bindPopup(popup).addTo(layers);
      marker.on('click', () => { selectedId.value = port.id; }); markers.set(port.id, marker);
    }
    if (props.journey && locatedPorts.value.length > 1) L.polyline(locatedPorts.value.map(p => p.point), { color: '#297bc1', weight: 3, dashArray: '7 9', interactive: false }).addTo(layers);
    ready.value = true; showAll();
  } catch { if (current === generation) { destroyMap(); mapError.value = 'The map could not open. Use Get directions below.'; } }
}, { flush: 'post' });
onBeforeUnmount(() => { generation++; destroyMap(); });
</script>
<style scoped>
.port-map { overflow: hidden; border: 1px solid var(--line); border-radius: 24px; background: var(--surface); color: var(--ink); box-shadow: var(--card-shadow); text-align: left; }
.map-heading { padding: 24px 24px 18px; }
.map-eyebrow { color: var(--ocean); font-size: 10px; font-weight: 800; letter-spacing: .14em; }
.map-heading h2 { margin: 0 0 8px; font-size: clamp(21px,3vw,28px); letter-spacing: -.04em; }
.map-heading p:not(.map-eyebrow) { margin: 0; color: var(--muted); font-size: 13px; }
.port-tabs { display: flex; gap: 9px; overflow-x: auto; padding: 0 24px 18px; }
.port-tabs button { display: flex; align-items: center; gap: 10px; flex-shrink: 0; min-height: 48px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); color: var(--ink); font: inherit; font-size: 12px; font-weight: 700; text-align: left; cursor: pointer; }
.port-tabs button.selected { border-color: var(--ocean); background: var(--light-blue); }
.port-tabs small,.map-footer small { display: block; color: var(--muted); font-size: 11px; font-weight: 500; margin: 2px 0; }
.port-letter { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 9px; background: #216cb0; color: white; }
.port-letter.arrival { background: #15796c; }
.map-window { height: 330px; position: relative; isolation: isolate; z-index: 0; background: var(--surface-soft); border-block: 1px solid var(--line); }
.leaflet-map { width: 100%; height: 100%; }
.show-ports { position: absolute; z-index: 1000; top: 12px; right: 12px; min-height: 44px; padding: 10px 14px; border: 1px solid #c8d6e3; border-radius: 10px; background: white; color: #164168; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 10px #162b4520; }
.map-empty { position: absolute; inset: 0; display: grid; place-content: center; margin: 0; padding: 28px; text-align: center; color: var(--muted); font-size: 13px; line-height: 1.6; }
.map-footer { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; padding: 18px 24px; font-size: 12px; }
.map-footer a { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 10px 14px; border-radius: 10px; background: var(--action); color: white; font-weight: 800; text-decoration: none; }
.map-note,.map-status { margin: 0; padding: 0 24px 20px; color: var(--muted); font-size: 11px; line-height: 1.6; }
.map-status { padding-top: 14px; }
.map-status button { min-height: 44px; border: 0; background: transparent; color: var(--ocean); font: inherit; text-decoration: underline; cursor: pointer; }
:deep(.port-pin) { background: transparent; border: 0; }
:deep(.port-pin span) { display: grid; place-items: center; width: 36px; height: 36px; border: 3px solid white; border-radius: 50% 50% 50% 5px; background: #216cb0; color: white; font-weight: 800; font-size: 14px; box-shadow: 0 3px 10px #12283e50; }
:deep(.port-pin.arrival span) { background: #15796c; }
:deep(.leaflet-control-zoom a) { width: 44px; height: 44px; line-height: 44px; }
:deep(.leaflet-popup-content) { line-height: 1.6; }
@media(max-width:600px) { .map-heading { padding: 20px 18px 16px; } .port-tabs { padding: 0 18px 16px; } .map-window { height: 300px; } .map-footer { padding: 16px 18px; } .map-note,.map-status { padding-inline: 18px; } }
</style>
