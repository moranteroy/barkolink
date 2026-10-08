<template>
  <section class="port-forecast" aria-labelledby="forecast-heading" :aria-busy="loading">
    <header><h2 id="forecast-heading"><IonIcon :icon="partlySunnyOutline" aria-hidden="true" /> Weather outlook</h2><span>{{ days.length ? `${days.length}-day forecast` : '7-day outlook' }}</span></header>
    <p class="location">{{ port?.city || 'Departure port' }} <span>· Plan your week at sea</span></p>
    <p v-if="loading" class="message" role="status">Checking the forecast…</p>
    <div v-else-if="error || !port?.available || !days.length" class="message" role="status">Weather forecast is currently unavailable.<button v-if="portId" @click="load">Try again</button></div>
    <template v-else>
      <div v-if="port.current" class="current"><strong>{{ format(port.current.temperatureC) }}°<small>C</small></strong><div><b>{{ port.current.condition }}</b><span>Now · Wind {{ format(port.current.windKph) }} km/h</span></div></div>
      <div class="forecast-scroll" tabindex="0" aria-label="Daily forecast. Scroll for more days.">
        <article v-for="day in days" :key="day.date" :aria-label="`${dateLabel(day.date)}, ${day.condition}`">
          <b>{{ day.date === philippineDateKey() ? 'Today' : weekday(day.date) }}</b><small>{{ dateLabel(day.date) }}</small>
          <IonIcon :icon="weatherIcon(day.conditionCode)" :title="day.condition" aria-hidden="true" />
          <strong>{{ format(day.highC) }}° <span>{{ format(day.lowC) }}°</span></strong>
          <span class="rain"><IonIcon :icon="waterOutline" aria-hidden="true" />{{ format(day.rainChance) }}%</span>
        </article>
      </div>
      <p v-if="days.length < 7" class="message">{{ days.length }} forecast days are currently available.</p>
      <p v-if="port.stale" class="message">Saved weather · update delayed.</p>
    </template>
    <footer><a href="https://www.weatherapi.com/" target="_blank" rel="noopener noreferrer">WeatherAPI.com</a><span>Follow official sailing advisories.</span></footer>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onIonViewWillEnter, IonIcon } from '@ionic/vue';
import { partlySunnyOutline, sunnyOutline, cloudyOutline, rainyOutline, thunderstormOutline, snowOutline, waterOutline } from 'ionicons/icons';
import { portForecast, type PortForecastData } from '../../services/weather';
import { philippineDateKey } from '../../data/travelDate';
const props = defineProps<{ portId: string }>();
const data = ref<PortForecastData | null>(null), loading = ref(false), error = ref(false);
const port = computed(() => data.value?.configured ? data.value.ports[0] : undefined);
const days = computed(() => (port.value?.days || []).filter(day => day.date >= philippineDateKey()).slice(0, 7));
let requestId = 0;
async function load() {
  const id = ++requestId;
  data.value = null; error.value = false; loading.value = false;
  if (!props.portId) return;
  loading.value = true;
  try { const result = await portForecast(props.portId); if (id === requestId) data.value = result; }
  catch { if (id === requestId) error.value = true; }
  finally { if (id === requestId) loading.value = false; }
}
watch(() => props.portId, load, { immediate: true });
onIonViewWillEnter(() => { if (props.portId) void load(); });
const format = (value: number | null | undefined) => value == null ? '—' : String(Math.round(value));
const dateLabel = (date: string) => new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });
const weekday = (date: string) => new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'short' });
function weatherIcon(code: number | null) {
  if (code === 1000) return sunnyOutline;
  if (code === 1003) return partlySunnyOutline;
  if ([1087, 1273, 1276, 1279, 1282].includes(code || 0)) return thunderstormOutline;
  if ([1066, 1069, 1072, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1255, 1258, 1261, 1264].includes(code || 0)) return snowOutline;
  return code && code >= 1063 ? rainyOutline : cloudyOutline;
}
</script>
<style scoped>
.port-forecast { margin-top: 24px; padding: 18px; min-width: 0; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); color: var(--ink); }
header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 14px; }
h2 ion-icon { color: var(--ocean); font-size: 20px; }
header > span { color: var(--ocean); background: var(--light-blue); padding: 5px 7px; border-radius: 6px; font-size: 9px; white-space: nowrap; }
.location { margin: 10px 0 0; font-size: 12px; font-weight: 600; }
.location span { color: var(--muted); font-weight: 400; }
.current { display: flex; align-items: center; gap: 14px; margin: 16px 0; }
.current > strong { font-size: 36px; letter-spacing: -1px; }
.current small { font-size: 18px; }
.current b { display: block; font-size: 12px; }
.current div > span { display: block; margin-top: 5px; font-size: 10px; color: var(--muted); }
.forecast-scroll { display: flex; gap: 7px; overflow-x: auto; padding: 3px 0 8px; scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
article { flex: 1 0 65px; display: flex; align-items: center; flex-direction: column; gap: 8px; padding: 12px 5px; background: var(--surface-soft); border: 1px solid var(--line); border-radius: 10px; }
article > b { font-size: 11px; } article > small { color: var(--muted); font-size: 9px; }
article > ion-icon { font-size: 26px; color: var(--ocean); margin: 3px 0; }
article > strong { font-size: 12px; white-space: nowrap; } article > strong span { font-weight: 400; color: var(--muted); }
.rain { display: flex; align-items: center; gap: 3px; color: var(--ocean); font-size: 10px; }
.message { margin: 14px 0; color: var(--muted); font-size: 11px; line-height: 1.6; }
button { margin-left: 8px; min-height: 44px; border: 0; background: transparent; color: var(--ocean); cursor: pointer; }
footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 9px; color: var(--muted); }
footer a { color: var(--ocean); text-decoration: none; }
button:focus-visible, a:focus-visible, .forecast-scroll:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
@container passenger (max-width: 380px) { .port-forecast { padding: 14px 12px; } .location span { display: block; margin-top: 4px; } }
</style>
