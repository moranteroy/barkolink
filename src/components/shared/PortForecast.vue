<template>
  <section class="port-forecast" aria-labelledby="forecast-heading" :aria-busy="loading">
    <header>
      <h2 id="forecast-heading"><CloudSun :size="20" aria-hidden="true" /> Weather outlook</h2>
      <span v-if="!loading && !error && port?.available && days.length" class="forecast-badge">{{ days.length }} days</span>
      <WeatherSource />
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
      <SmartWeatherCard v-if="port.current" :reading="port.current" label="Current weather" />
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
      <p v-if="port.stale" class="message">Saved weather · update delayed.</p>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import { CloudSun, Wind, Droplets, MoveRight, X, MapPin, ChevronDown, Anchor, Check } from '@lucide/vue';
import { SelectRoot, SelectTrigger, SelectPortal, SelectContent, SelectViewport, SelectItem, SelectItemText, SelectItemIndicator } from 'reka-ui';
import WeatherSymbol from './WeatherSymbol.vue';
import SmartWeatherCard from './SmartWeatherCard.vue';
import WeatherSource from './WeatherSource.vue';
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
.forecast-badge { color: var(--ocean); background: var(--light-blue); padding: 6px 8px; border-radius: 8px; font-size: var(--text-caption); white-space: nowrap; }
.location-picker { display: grid; gap: 6px; margin: 16px 0 14px; }
.location-label { font-size: var(--text-caption); font-weight: 600; color: var(--muted); }
.location-trigger { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; min-height: 60px; margin: 0; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--ocean) 28%, var(--line)); border-radius: 12px; background: linear-gradient(115deg, var(--light-blue), var(--surface-soft)); color: var(--ink); font: inherit; text-align: left; cursor: pointer; transition: border-color .18s, box-shadow .18s; }
.location-trigger:hover, .location-trigger[data-state="open"] { border-color: var(--ocean); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ocean) 9%, transparent); }
.location-trigger:disabled { opacity: .65; cursor: default; }
.location-icon, .option-icon { display: grid; place-items: center; flex-shrink: 0; width: 34px; height: 34px; border-radius: 10px; background: color-mix(in srgb, var(--ocean) 14%, transparent); color: var(--ocean); }
.location-copy { display: grid; flex: 1; min-width: 0; gap: 3px; }
.location-copy strong { font-size: 13px; line-height: 1.4; }
.location-copy small { font-size: var(--text-caption); color: var(--muted); line-height: 1.5; }
.location-chevron { flex-shrink: 0; color: var(--ocean); transition: transform .18s; }
.location-trigger[data-state="open"] .location-chevron { transform: rotate(180deg); }
:global(.barkolink-location-menu) { z-index: 20000; box-sizing: border-box; width: var(--reka-select-trigger-width); max-width: calc(100vw - 24px); max-height: var(--reka-select-content-available-height); padding: 6px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); color: var(--ink); box-shadow: 0 14px 40px #061a3533; animation: location-open .15s ease-out; }
.location-menu-heading { padding: 8px 10px; color: var(--muted); font-size: var(--text-caption); font-weight: 600; }
.location-viewport { max-height: 250px; overflow-y: auto; }
.location-option { display: flex; align-items: center; gap: 9px; min-height: 56px; padding: 8px 10px; border-radius: 9px; cursor: pointer; outline: none; }
.location-option[data-highlighted], .location-option[data-state="checked"] { background: var(--light-blue); }
.option-icon { width: 30px; height: 30px; }
.option-copy { display: grid; flex: 1; min-width: 0; gap: 3px; }
.option-copy strong { font-size: var(--text-label); line-height: 1.4; } .option-copy small { color: var(--muted); font-size: var(--text-caption); line-height: 1.5; }
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
.eyebrow { display: block; font-size: var(--text-caption); color: var(--muted); margin-bottom: 2px; }
.current-reading > strong { font-size: 32px; line-height: 1.1; letter-spacing: -1px; }
.current-reading small { font-size: 17px; letter-spacing: 0; }
.current-description { flex: 1; min-width: 110px; }
.current-description b { display: block; font-size: 13px; line-height: 1.5; }
.current-description > span { display: flex; align-items: center; gap: 5px; margin-top: 6px; font-size: var(--text-caption); color: var(--muted); }
.daily-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 22px 0 12px; }
h3 { margin: 0; font-size: var(--text-label); }
.daily-heading > span { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--muted); }
.forecast-scroll { display: flex; align-items: stretch; gap: 10px; overflow-x: auto; padding: 4px 3px 16px; scrollbar-width: none; scroll-padding-inline: 3px; overscroll-behavior-x: contain; scroll-snap-type: x proximity; }
.forecast-day { box-sizing: border-box; flex: 0 0 120px; min-width: 0; height: 220px; display: flex; align-items: center; flex-direction: column; gap: 0; margin: 0; padding: 14px 10px 12px; background: var(--surface-soft); color: var(--ink); border: 1px solid var(--line); border-radius: 14px; scroll-snap-align: start; font: inherit; cursor: pointer; transition: border-color .18s ease, background .18s ease, transform .18s ease; }
.forecast-day.is-today .day-date b { color: var(--ocean); }
.forecast-scroll::-webkit-scrollbar { display: none; }
.forecast-day.is-selected { border-color: var(--ocean); background: color-mix(in srgb, var(--ocean) 16%, var(--surface-soft)); box-shadow: inset 0 0 0 1px var(--ocean), 0 3px 12px color-mix(in srgb, var(--ocean) 12%, transparent); }
.forecast-day.is-selected .day-date b { color: var(--ocean); }
.forecast-day:hover:not(.is-selected) { border-color: var(--ocean); background: color-mix(in srgb, var(--ocean) 8%, var(--surface-soft)); }
.forecast-day:hover .day-icon { transform: translateY(-2px); }
.forecast-day:active { transform: scale(.97); }
.day-date { display: flex; align-items: center; flex-direction: column; gap: 4px; }
.day-date b { font-size: 14px; line-height: 1.4; } .day-date small { color: var(--muted); font-size: 13px; line-height: 1.4; }
.is-today .day-date b { color: var(--ocean); }
.day-icon { width: 46px; height: 46px; padding: 5px; box-sizing: border-box; margin: 10px 0 8px; transition: transform .18s ease; }
.condition-label { width: 100%; min-width: 0; font-size: 13px; font-weight: 650; text-align: center; line-height: 1.4; height: 37px; flex-shrink: 0; display: grid; place-items: center; white-space: normal; overflow-wrap: anywhere; }
.tile-temperatures { display: flex; align-items: baseline; justify-content: center; gap: 9px; margin-top: 6px; font-size: 16px; line-height: 1.4; }
.tile-temperatures > span { color: var(--muted); font-size: 14px; }
.tile-rain { display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: auto; font-size: 12px; line-height: 1.5; color: var(--muted); white-space: nowrap; }
.tile-rain svg { color: #42a7eb; }
.selected-forecast { margin: 4px 0 10px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); animation: detail-arrive .2s ease-out; }
.selected-heading { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
.selected-heading strong { display: block; font-size: var(--text-label); line-height: 1.5; }
.selected-heading span { display: block; font-size: var(--text-caption); margin-top: 2px; color: var(--muted); }
.close-details { display: grid; place-items: center; flex-shrink: 0; width: 44px; height: 44px; min-height: 44px; margin: -6px; color: var(--muted); }
.selected-forecast dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0 0; }
.selected-forecast dt { font-size: var(--text-caption); color: var(--muted); line-height: 1.5; }
.selected-forecast dd { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin: 4px 0 0; font-size: var(--text-caption); font-weight: 600; }
.selected-forecast dd svg { color: var(--ocean); }
@keyframes detail-arrive { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.message { margin: 14px 0; color: var(--muted); font-size: var(--text-label); line-height: 1.6; }
button { margin-left: 8px; min-height: 44px; border: 0; background: transparent; color: var(--ocean); cursor: pointer; }
button:focus-visible, a:focus-visible, select:focus-visible, .forecast-scroll:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
@container passenger (max-width: 380px) { .port-forecast { padding: 16px 12px; } .current { gap: 8px; } .current-description { min-width: 0; } .current-description b { font-size: var(--text-caption); } .current-reading > strong { font-size: 28px; } .current-reading small { font-size: 14px; } .forecast-badge { font-size: var(--text-caption); } .location-picker { grid-template-columns: 1fr; gap: 5px; } }
@media (prefers-reduced-motion: reduce) { .forecast-day, .day-icon, .location-trigger, .location-chevron { transition: none; } .selected-forecast, :global(.barkolink-location-menu) { animation: none; } .forecast-day:hover .day-icon, .forecast-day:active { transform: none; } }
@media (max-width:600px) {
  .port-forecast { margin-top:18px; padding:14px; border-radius:14px; }
  .daily-heading { margin-top:16px; }
  .forecast-scroll { gap:8px; padding-bottom:10px; }
  .forecast-day { flex-basis:104px; height:auto; min-height:178px; padding:10px 8px; }
  .day-icon { width:38px; height:38px; margin-block:7px; }
  .condition-label { height:auto; min-height:34px; font-size:12px; }
  .day-date { gap:2px; }
  .day-date small { font-size:12px; }
  .tile-rain { padding-top:6px; }
}
</style>
