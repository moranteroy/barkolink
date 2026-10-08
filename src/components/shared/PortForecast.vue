<template>
  <section class="port-forecast" aria-labelledby="forecast-heading" :aria-busy="loading">
    <header>
      <h2 id="forecast-heading"><CloudSun :size="20" aria-hidden="true" /> Weather outlook</h2>
      <span class="forecast-badge">{{ days.length ? `${days.length}-day forecast` : '7-day outlook' }}</span>
    </header>
    <div class="location-picker">
      <span id="weather-location-label" class="location-label">Weather location</span>
      <SelectRoot :model-value="effectivePortId" :disabled="!locations.length" @update:model-value="choosePort">
        <SelectTrigger id="weather-port" class="location-trigger" aria-labelledby="weather-location-label weather-location-value">
          <span class="location-icon"><MapPin :size="19" aria-hidden="true" /></span>
          <span id="weather-location-value" class="location-copy"><strong>{{ selectedLocation?.city || port?.city || 'Departure port' }}</strong><small>{{ selectedLocation?.name || 'Checking available ports…' }}</small></span>
          <ChevronDown :size="17" class="location-chevron" aria-hidden="true" />
        </SelectTrigger>
        <SelectPortal><SelectContent class="location-menu barkolink-location-menu" position="popper" :side-offset="8" :collision-padding="12">
          <div class="location-menu-heading">Choose a port</div>
          <SelectViewport class="location-viewport"><SelectItem v-for="location in locations" :key="location.id" :value="location.id" class="location-option">
            <span class="option-icon"><Anchor :size="16" aria-hidden="true" /></span><SelectItemText class="option-copy"><strong>{{ location.city }}</strong><small>{{ location.name }}</small></SelectItemText><SelectItemIndicator class="option-check"><Check :size="17" aria-hidden="true" /></SelectItemIndicator>
          </SelectItem></SelectViewport>
        </SelectContent></SelectPortal>
      </SelectRoot>
    </div>
    <p v-if="locationError" class="message" role="status">{{ locationError }} <button type="button" @click="loadLocations">Retry locations</button></p>
    <p v-if="loading" class="message" role="status">Checking the forecast…</p>
    <div v-else-if="error || !port?.available || !days.length" class="message" role="status">Weather forecast is currently unavailable.<button v-if="effectivePortId" @click="load">Try again</button></div>
    <template v-else>
      <div v-if="port.current" class="current">
        <span class="current-icon weather-symbol" :data-weather="weatherPresentation(port.current.condition).kind">
          <WeatherSymbol :kind="weatherPresentation(port.current.condition).kind" active />
        </span>
        <div class="current-reading"><span class="eyebrow">Right now</span><strong>{{ format(port.current.temperatureC) }}<small>°C</small></strong></div>
        <div class="current-description"><b>{{ port.current.condition }}</b><span><Wind :size="14" aria-hidden="true" /> Wind {{ measurement(port.current.windKph, 'km/h') }}</span></div>
      </div>
      <div class="daily-heading"><h3>Daily forecast</h3><span>Tap a day · Swipe <MoveRight :size="14" aria-hidden="true" /></span></div>
      <div class="forecast-scroll" tabindex="0" aria-label="Daily forecast. Scroll for more days.">
        <button v-for="day in days" :key="day.date" type="button" class="forecast-day" :class="{ 'is-today': day.date === philippineDateKey(), 'is-selected': selectedDate === day.date }" :aria-pressed="selectedDate === day.date" aria-controls="forecast-day-details" :aria-label="`${dateLabel(day.date)}: ${day.condition}. View forecast details`" @click="selectDay(day.date)">
          <div class="day-date"><b>{{ day.date === philippineDateKey() ? 'Today' : weekday(day.date) }}</b><small>{{ dateLabel(day.date) }}</small></div>
          <span class="day-icon weather-symbol" :data-weather="weatherPresentation(day.condition).kind"><WeatherSymbol :kind="weatherPresentation(day.condition).kind" :active="selectedDate === day.date" /></span>
          <b class="condition-label">{{ weatherPresentation(day.condition).label }}</b>
          <span class="tile-temperatures"><strong>{{ format(day.highC) }}°</strong><span>{{ format(day.lowC) }}°</span></span>
          <span class="tile-rain"><Droplets :size="12" aria-hidden="true" />{{ measurement(day.rainChance, '%') }} rain</span>
        </button>
      </div>
      <div id="forecast-day-details" aria-live="polite">
        <div v-if="selectedDay" class="selected-forecast">
          <div class="selected-heading"><div><strong>{{ dateLabel(selectedDay.date) }} · {{ selectedDay.condition }}</strong><span>Daily forecast details</span></div><button type="button" class="close-details" aria-label="Close forecast details" @click="selectedDate = ''"><X :size="16" aria-hidden="true" /></button></div>
          <dl><div><dt>High / Low</dt><dd>{{ format(selectedDay.highC) }}° / {{ format(selectedDay.lowC) }}°C</dd></div><div><dt>Chance of rain</dt><dd><Droplets :size="13" aria-hidden="true" />{{ measurement(selectedDay.rainChance, '%') }}</dd></div><div><dt>Max wind</dt><dd><Wind :size="13" aria-hidden="true" />{{ measurement(selectedDay.windKph, 'km/h') }}</dd></div></dl>
        </div>
      </div>
      <p class="forecast-note">High / low temperatures · Rain % = chance of rain</p>
      <p v-if="days.length < 7" class="message">{{ days.length }} forecast days are currently available.</p>
      <p v-if="port.stale" class="message">Saved weather · update delayed.</p>
    </template>
    <footer><a href="https://www.weatherapi.com/" target="_blank" rel="noopener noreferrer">WeatherAPI.com <ExternalLink :size="11" aria-hidden="true" /></a><span>Check official sailing advisories before travel.</span></footer>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import { CloudSun, Wind, Droplets, MoveRight, ExternalLink, X, MapPin, ChevronDown, Anchor, Check } from '@lucide/vue';
import { SelectRoot, SelectTrigger, SelectPortal, SelectContent, SelectViewport, SelectItem, SelectItemText, SelectItemIndicator } from 'reka-ui';
import WeatherSymbol from './WeatherSymbol.vue';
import { portForecast, type PortForecastData } from '../../services/weather';
import { philippineDateKey } from '../../data/travelDate';
import { weatherPresentation } from '../../data/weatherPresentation';
import { browseActivePorts } from '../../services/database/passenger';
import { database } from '../../services/session';
const props = defineProps<{ portId: string }>();
const locations = ref<Array<{ id: string; name: string; city: string }>>([]);
const chosenPortId = ref(''), locationError = ref('');
const effectivePortId = computed(() => chosenPortId.value || props.portId || locations.value[0]?.id || '');
const selectedLocation = computed(() => locations.value.find(location => location.id === effectivePortId.value));
async function loadLocations() {
  locationError.value = '';
  try {
    if (!database) throw new Error('Unavailable');
    locations.value = (await browseActivePorts(database)).data.ports;
  } catch { locationError.value = 'Could not load other weather locations.'; }
}
function choosePort(id: unknown) {
  if (typeof id === 'string' && locations.value.some(location => location.id === id)) chosenPortId.value = id;
}
onMounted(loadLocations);
watch(() => props.portId, () => { chosenPortId.value = ''; });
const data = ref<PortForecastData | null>(null), loading = ref(false), error = ref(false);
const port = computed(() => data.value?.configured ? data.value.ports[0] : undefined);
const days = computed(() => (port.value?.days || []).filter(day => day.date >= philippineDateKey()).slice(0, 7));
const selectedDate = ref('');
const selectedDay = computed(() => days.value.find(day => day.date === selectedDate.value));
function selectDay(date: string) { selectedDate.value = selectedDate.value === date ? '' : date; }
let requestId = 0;
async function load() {
  const id = ++requestId;
  data.value = null; error.value = false; loading.value = false; selectedDate.value = '';
  if (!effectivePortId.value) return;
  loading.value = true;
  try { const result = await portForecast(effectivePortId.value); if (id === requestId) data.value = result; }
  catch { if (id === requestId) error.value = true; }
  finally { if (id === requestId) loading.value = false; }
}
watch(effectivePortId, load, { immediate: true });
onIonViewWillEnter(() => { if (effectivePortId.value) void load(); });
const format = (value: number | null | undefined) => value == null ? '—' : String(Math.round(value));
const measurement = (value: number | null | undefined, unit: string) => value == null ? '—' : `${format(value)}${unit === '%' ? '' : ' '}${unit}`;
const dateLabel = (date: string) => new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });
const weekday = (date: string) => new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'short' });
</script>
<style scoped>
.port-forecast { margin-top: 24px; padding: 20px; min-width: 0; border: 1px solid var(--line); border-radius: 18px; background: var(--surface); color: var(--ink); }
header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 14px; }
h2 svg { color: var(--ocean); flex-shrink: 0; }
.forecast-badge { color: var(--ocean); background: var(--light-blue); padding: 6px 8px; border-radius: 8px; font-size: 10px; white-space: nowrap; }
.location-picker { display: grid; gap: 6px; margin: 16px 0 14px; }
.location-label { font-size: 10px; font-weight: 600; color: var(--muted); }
.location-trigger { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; min-height: 60px; margin: 0; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--ocean) 28%, var(--line)); border-radius: 12px; background: linear-gradient(115deg, var(--light-blue), var(--surface-soft)); color: var(--ink); font: inherit; text-align: left; cursor: pointer; transition: border-color .18s, box-shadow .18s; }
.location-trigger:hover, .location-trigger[data-state="open"] { border-color: var(--ocean); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ocean) 9%, transparent); }
.location-trigger:disabled { opacity: .65; cursor: default; }
.location-icon, .option-icon { display: grid; place-items: center; flex-shrink: 0; width: 34px; height: 34px; border-radius: 10px; background: color-mix(in srgb, var(--ocean) 14%, transparent); color: var(--ocean); }
.location-copy { display: grid; flex: 1; min-width: 0; gap: 3px; }
.location-copy strong { font-size: 13px; line-height: 1.4; }
.location-copy small { font-size: 10px; color: var(--muted); line-height: 1.5; }
.location-chevron { flex-shrink: 0; color: var(--ocean); transition: transform .18s; }
.location-trigger[data-state="open"] .location-chevron { transform: rotate(180deg); }
:global(.barkolink-location-menu) { z-index: 20000; box-sizing: border-box; width: var(--reka-select-trigger-width); max-width: calc(100vw - 24px); max-height: var(--reka-select-content-available-height); padding: 6px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); color: var(--ink); box-shadow: 0 14px 40px #061a3533; animation: location-open .15s ease-out; }
.location-menu-heading { padding: 8px 10px; color: var(--muted); font-size: 10px; font-weight: 600; }
.location-viewport { max-height: 250px; overflow-y: auto; }
.location-option { display: flex; align-items: center; gap: 9px; min-height: 56px; padding: 8px 10px; border-radius: 9px; cursor: pointer; outline: none; }
.location-option[data-highlighted], .location-option[data-state="checked"] { background: var(--light-blue); }
.option-icon { width: 30px; height: 30px; }
.option-copy { display: grid; flex: 1; min-width: 0; gap: 3px; }
.option-copy strong { font-size: 12px; line-height: 1.4; } .option-copy small { color: var(--muted); font-size: 10px; line-height: 1.5; }
.option-check { flex-shrink: 0; color: var(--ocean); }
@keyframes location-open { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
.current { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: 12px 0 18px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); }
.weather-symbol { --weather-color: var(--ocean); color: var(--weather-color); background: color-mix(in srgb, var(--weather-color) 12%, transparent); display: flex; justify-content: center; align-items: center; flex-shrink: 0; border-radius: 14px; }
.weather-symbol[data-weather="sun"], .weather-symbol[data-weather="partly"] { --weather-color: #c28a13; }
.weather-symbol[data-weather="clear"], .weather-symbol[data-weather="storm"] { --weather-color: #9577dc; }
.weather-symbol[data-weather="cloud"], .weather-symbol[data-weather="fog"], .weather-symbol[data-weather="unknown"] { --weather-color: var(--muted); }
.weather-symbol[data-weather="wind"] { --weather-color: #329b92; }
:global([data-theme="dark"]) .weather-symbol[data-weather="sun"], :global([data-theme="dark"]) .weather-symbol[data-weather="partly"] { --weather-color: #f7c65c; }
.current-icon { width: 46px; height: 46px; padding: 6px; box-sizing: border-box; }
.current-reading { flex-shrink: 0; }
.eyebrow { display: block; font-size: 10px; color: var(--muted); margin-bottom: 2px; }
.current-reading > strong { font-size: 32px; line-height: 1.1; letter-spacing: -1px; }
.current-reading small { font-size: 17px; letter-spacing: 0; }
.current-description { flex: 1; min-width: 110px; }
.current-description b { display: block; font-size: 13px; line-height: 1.5; }
.current-description > span { display: flex; align-items: center; gap: 5px; margin-top: 6px; font-size: 11px; color: var(--muted); }
.daily-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
h3 { margin: 0; font-size: 12px; }
.daily-heading > span { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--muted); }
.forecast-scroll { display: flex; align-items: flex-start; gap: 8px; overflow-x: auto; padding: 3px 2px 10px; scrollbar-width: thin; scrollbar-color: var(--line) transparent; scroll-snap-type: x proximity; }
.forecast-day { box-sizing: border-box; flex: 0 0 98px; height: 174px; display: flex; align-items: center; flex-direction: column; gap: 0; margin: 0; padding: 10px 6px; background: var(--surface-soft); color: var(--ink); border: 1px solid var(--line); border-radius: 12px; scroll-snap-align: start; font: inherit; cursor: pointer; transition: border-color .18s ease, background .18s ease, transform .18s ease; }
.forecast-day.is-today .day-date b { color: var(--ocean); }
.forecast-day:hover, .forecast-day.is-selected { border-color: var(--ocean); background: color-mix(in srgb, var(--ocean) 8%, var(--surface-soft)); }
.forecast-day:hover .day-icon { transform: translateY(-2px); }
.forecast-day:active { transform: scale(.97); }
.day-date { display: flex; align-items: center; flex-direction: column; gap: 4px; }
.day-date b { font-size: 12px; } .day-date small { color: var(--muted); font-size: 10px; }
.is-today .day-date b { color: var(--ocean); }
.day-icon { width: 40px; height: 40px; padding: 4px; box-sizing: border-box; margin: 8px 0 5px; transition: transform .18s ease; }
.condition-label { font-size: 11px; text-align: center; line-height: 1.3; min-height: 28px; display: grid; place-items: center; }
.tile-temperatures { display: flex; align-items: baseline; justify-content: center; gap: 8px; margin-top: 5px; font-size: 13px; }
.tile-temperatures > span { color: var(--muted); font-size: 11px; }
.tile-rain { display: flex; align-items: center; justify-content: center; gap: 3px; margin-top: 6px; font-size: 10px; color: var(--muted); white-space: nowrap; }
.tile-rain svg { color: #42a7eb; }
.selected-forecast { margin: 4px 0 10px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); animation: detail-arrive .2s ease-out; }
.selected-heading { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
.selected-heading strong { display: block; font-size: 12px; line-height: 1.5; }
.selected-heading span { display: block; font-size: 10px; margin-top: 2px; color: var(--muted); }
.close-details { display: grid; place-items: center; flex-shrink: 0; width: 44px; height: 44px; min-height: 44px; margin: -6px; color: var(--muted); }
.selected-forecast dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0 0; }
.selected-forecast dt { font-size: 9px; color: var(--muted); line-height: 1.5; }
.selected-forecast dd { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin: 4px 0 0; font-size: 11px; font-weight: 600; }
.selected-forecast dd svg { color: var(--ocean); }
@keyframes detail-arrive { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.forecast-note { margin: 2px 0 0; color: var(--muted); font-size: 10px; line-height: 1.6; }
.message { margin: 14px 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
button { margin-left: 8px; min-height: 44px; border: 0; background: transparent; color: var(--ocean); cursor: pointer; }
footer { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 6px 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 10px; line-height: 1.6; color: var(--muted); }
footer a { display: inline-flex; align-items: center; gap: 4px; min-height: 28px; color: var(--ocean); text-decoration: none; }
button:focus-visible, a:focus-visible, select:focus-visible, .forecast-scroll:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
@container passenger (max-width: 380px) { .port-forecast { padding: 16px 12px; } .current { gap: 8px; } .current-description { min-width: 0; } .current-description b { font-size: 11px; } .current-reading > strong { font-size: 28px; } .current-reading small { font-size: 14px; } .forecast-badge { font-size: 9px; } .location-picker { grid-template-columns: 1fr; gap: 5px; } }
@media (prefers-reduced-motion: reduce) { .forecast-day, .day-icon, .location-trigger, .location-chevron { transition: none; } .selected-forecast, :global(.barkolink-location-menu) { animation: none; } .forecast-day:hover .day-icon, .forecast-day:active { transform: none; } }
</style>
