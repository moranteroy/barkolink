<template>
  <section v-if="trips.length" class="weather-trip-picker">
    <div class="picker-heading"><span class="weather-icon"><CloudSun :size="21" aria-hidden="true" /></span><div><h2>Port weather</h2></div></div>
    <SelectRoot :model-value="selected || '__none__'" @update:model-value="choose">
      <SelectTrigger class="weather-trigger" aria-label="Choose sailing for weather"><Ship :size="18" aria-hidden="true" /><span><strong>{{ chosen ? `${chosen.origin.name} to ${chosen.destination.name}` : 'Choose a sailing' }}</strong><small>{{ chosen ? details(chosen) : 'Route, departure time and trip code' }}</small></span><ChevronDown :size="17" class="picker-chevron" aria-hidden="true" /></SelectTrigger>
      <SelectPortal><SelectContent class="weather-sailing-menu" position="popper" :side-offset="6" :collision-padding="12">
        <SelectViewport class="weather-options">
          <SelectItem value="__none__" class="weather-option"><SelectItemText>Choose a sailing</SelectItemText><SelectItemIndicator><Check :size="16" /></SelectItemIndicator></SelectItem>
          <SelectItem v-for="trip in trips" :key="trip.code" :value="trip.code" class="weather-option"><span class="option-ship"><Ship :size="17" aria-hidden="true" /></span><SelectItemText class="option-copy"><strong>{{ trip.origin.name }} to {{ trip.destination.name }}</strong><small>{{ details(trip) }}</small></SelectItemText><SelectItemIndicator class="option-check"><Check :size="16" /></SelectItemIndicator></SelectItem>
        </SelectViewport>
      </SelectContent></SelectPortal>
    </SelectRoot>
    <button v-if="selected" type="button" class="clear-weather" aria-label="Clear weather selection" @click="selected = ''"><X :size="14" aria-hidden="true" /><span>Clear</span></button>
    <TripWeather v-if="selected" :sailing-code="selected" compact />
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CloudSun, Ship, ChevronDown, Check, X } from '@lucide/vue';
import { SelectRoot, SelectTrigger, SelectPortal, SelectContent, SelectViewport, SelectItem, SelectItemText, SelectItemIndicator } from 'reka-ui';
import TripWeather from './TripWeather.vue';
type Trip = { code: string; departureAt?: string; origin: {name: string}; destination: {name: string} };
const props = defineProps<{ trips: Trip[] }>();
const selected = ref('');
const chosen = computed(() => props.trips.find(trip => trip.code === selected.value));
function choose(value: unknown) { if (typeof value === 'string') selected.value = value === '__none__' ? '' : value; }
function details(trip: Trip) { return trip.departureAt ? `${new Date(trip.departureAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} | ${trip.code}` : trip.code; }
watch(() => props.trips, () => { if (selected.value && !chosen.value) selected.value = ''; });
</script>
<style scoped>
.weather-trip-picker { margin: 16px 0; padding: 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); min-width: 0; }
.picker-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.weather-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: #f5b64018; color: #d69922; flex: none; }
h2 { margin: 0; font-size: 14px; color: var(--ink); } p { margin: 4px 0 0; font-size: 11px; color: var(--muted); }
.clear-weather { margin-left: auto; min-height: 44px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-soft); color: var(--ocean); font: inherit; font-size: 11px; }
.weather-trigger { width: 100%; display: flex; align-items: center; gap: 10px; min-height: 56px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); color: var(--ocean); text-align: left; cursor: pointer; }
.weather-trigger span { flex: 1; min-width: 0; display: grid; gap: 4px; }
.weather-trigger strong { font-size: 12px; color: var(--ink); line-height: 1.5; overflow-wrap: anywhere; }
.weather-trigger small { font-size: 10px; color: var(--muted); line-height: 1.5; overflow-wrap: anywhere; }
.weather-trigger svg { flex: none; }.weather-trigger[data-state="open"] .picker-chevron { transform: rotate(180deg); }
button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
:global(.weather-sailing-menu) { z-index: 20000; box-sizing: border-box; width: var(--reka-select-trigger-width); max-width: calc(100vw - 24px); max-height: min(320px, var(--reka-select-content-available-height)); overflow: hidden; border: 1px solid var(--line); padding: 6px; border-radius: 12px; background: var(--surface); color: var(--ink); box-shadow: 0 14px 40px #061a3533; }
.weather-options { max-height: 280px !important; overflow-y: auto !important; }
.weather-option { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 9px 10px; border-radius: 8px; cursor: pointer; outline: none; }
.weather-option[data-highlighted], .weather-option[data-state="checked"] { background: var(--light-blue); }
.option-ship { color: var(--ocean); flex: none; }.option-copy { flex: 1; min-width: 0; display: grid; gap: 4px; }.option-copy strong { font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }.option-copy small { font-size: 10px; color: var(--muted); line-height: 1.5; overflow-wrap: anywhere; }.option-check { color: var(--ocean); flex: none; }
@media(max-width:480px) { .picker-heading { align-items: flex-start; } .weather-trip-picker { padding: 12px; } }
</style>
<style scoped>
.weather-trip-picker { display: grid; grid-template-columns: 125px minmax(0, 1fr) auto; gap: 8px; align-items: center; width: 100%; max-width: 660px; box-sizing: border-box; margin: 12px 0 16px; padding: 8px; container-type: inline-size; container-name: staff-weather; }
.picker-heading { grid-column: 1; grid-row: 1; margin: 0; gap: 7px; }.picker-heading h2 { font-size: 12px; }.weather-icon { width: 28px; height: 28px; border-radius: 8px; }
.weather-trigger { grid-column: 2; grid-row: 1; min-height: 44px; padding: 6px 9px; gap: 7px; }.weather-trigger strong { font-size: 11px; }.weather-trigger small { font-size: 9px; }.weather-trigger span { gap: 2px; }
.clear-weather { grid-column: 3; grid-row: 1; margin: 0; padding: 5px 7px; border: 0; background: transparent; font-size: 10px; }
.weather-trip-picker :deep(.trip-weather) { grid-column: 1 / -1; width: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; background: transparent; }
@container staff-weather (min-width: 480px) { .weather-trip-picker :deep(.weather-ports) { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } }
@container staff-weather (max-width: 479px) {
 .weather-trip-picker :deep(.weather-ports) { display: flex; overflow-x: auto; scroll-snap-type: x proximity; padding-bottom: 4px; }
 .weather-trip-picker :deep(.weather-port) { flex: 0 0 min(260px, 88%); scroll-snap-align: start; }
 .weather-trip-picker :deep(.compact-weather-hint) { display: block; }
}
@media(max-width:600px) { .weather-trip-picker { grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }.picker-heading { grid-column: 1; }.clear-weather { grid-column: 2; }.weather-trigger { grid-column: 1 / -1; grid-row: 2; } }
</style>

<style scoped>
.clear-weather { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 44px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--light-blue); color: var(--ocean); font-size: 11px; font-weight: 600; cursor: pointer; }
.clear-weather:hover { border-color: var(--ocean); background: color-mix(in srgb, var(--ocean) 16%, var(--surface)); }
.clear-weather svg { flex: none; }
</style>
