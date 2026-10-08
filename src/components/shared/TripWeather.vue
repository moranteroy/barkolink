<template>
  <section class="trip-weather" aria-label="Trip weather">
    <div class="weather-heading"><div><small>PLAN YOUR JOURNEY</small><h2><ion-icon :icon="partlySunnyOutline" aria-hidden="true" /> Port weather</h2></div><button v-if="error" :disabled="loading" @click="load">Try again</button></div>
    <p v-if="loading" role="status" class="weather-message">Checking the latest port weather…</p>
    <p v-else-if="error || !data?.configured" role="status" class="weather-message">Weather updates are currently unavailable. Check your trip advisories for sailing updates.</p>
    <div v-else class="weather-ports">
      <article v-for="port in data.ports" :key="port.id" class="weather-port">
        <small>{{ port.role }}</small><h3>{{ port.name }}</h3>
        <p v-if="!port.available" class="weather-message">Weather unavailable for this port.</p>
        <template v-else>
          <div class="weather-conditions"><strong>{{ format((port.forecast || port.current)?.temperatureC) }}<span>°C</span></strong><div><b>{{ (port.forecast || port.current)?.condition }}</b><small>{{ port.forecast ? 'Forecast at departure' : 'Current weather' }}</small></div></div>
          <dl><div><dt>Wind</dt><dd>{{ format((port.forecast || port.current)?.windKph) }} km/h</dd></div><div><dt>Visibility</dt><dd>{{ format((port.forecast || port.current)?.visibilityKm) }} km</dd></div><div v-if="port.forecast"><dt>Chance of rain</dt><dd>{{ format(port.forecast.rainChance) }}%</dd></div></dl>
          <p v-if="!port.forecast" class="forecast-notice">Departure forecast is not available yet. Check again closer to your trip.</p>
          <p class="weather-updated">{{ port.stale ? 'Saved weather · update delayed' : 'Last updated' }} · {{ timestamp(port.current?.at) }}</p>
        </template>
      </article>
    </div>
    <div class="weather-footer"><a href="https://www.weatherapi.com/" target="_blank" rel="noopener noreferrer">Powered by WeatherAPI.com</a><p>Weather estimates are for travel planning and may change. They do not confirm sailing safety. Follow official advisories and your operator’s trip status.</p></div>
  </section>
</template>
<script setup lang="ts">
import { ref,watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { partlySunnyOutline } from 'ionicons/icons';
import { tripWeather,type TripWeatherData } from '../../services/weather';
const props=defineProps<{sailingCode:string}>();
const data=ref<TripWeatherData|null>(null),loading=ref(false),error=ref(false);
let requestId=0;
async function load(){
  const id=++requestId;data.value=null;error.value=false;
  if(!props.sailingCode){loading.value=false;return;}
  loading.value=true;
  try{const result=await tripWeather(props.sailingCode);if(id===requestId)data.value=result;}
  catch{if(id===requestId)error.value=true;}
  finally{if(id===requestId)loading.value=false;}
}
watch(()=>props.sailingCode,load,{immediate:true});
const format=(value:number|null|undefined)=>value==null?'—':Math.round(value).toString();
const timestamp=(at?:string)=>at?new Date(at).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Unavailable';
</script>
<style scoped>
.trip-weather { margin: 20px 0; padding: 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); color: var(--ink); min-width: 0; }
.weather-heading { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 16px; }
.weather-heading small { font-size: 9px; letter-spacing: .1em; color: var(--ocean); font-weight: 700; }
.weather-heading h2 { display: flex; gap: 8px; align-items: center; font-size: 19px; margin: 6px 0 0; }
.weather-heading ion-icon { color: var(--ocean); }
.weather-heading button { border: 1px solid var(--line); border-radius: 8px; padding: 10px; color: var(--ocean); background: var(--surface-soft); font: inherit; font-size: 12px; cursor: pointer; }
.weather-ports { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
.weather-port { min-width: 0; padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); }
.weather-port > small { color: var(--muted); font-size: 10px; }
.weather-port h3 { font-size: 14px; line-height: 1.5; margin: 5px 0 16px; overflow-wrap: anywhere; }
.weather-conditions { display: flex; align-items: center; gap: 12px; }
.weather-conditions strong { font-size: 32px; white-space: nowrap; }
.weather-conditions strong span { font-size: 16px; font-weight: 500; }
.weather-conditions b { display: block; font-size: 12px; line-height: 1.5; }
.weather-conditions small { display: block; color: var(--muted); font-size: 10px; margin-top: 4px; }
dl { display: flex; flex-wrap: wrap; gap: 16px; border-top: 1px solid var(--line); padding-top: 14px; margin: 16px 0 0; }
dt { font-size: 10px; color: var(--muted); } dd { margin: 5px 0 0; font-size: 12px; font-weight: 600; }
.forecast-notice,.weather-updated,.weather-message,.weather-footer p { color: var(--muted); font-size: 11px; line-height: 1.7; margin: 12px 0 0; }
.forecast-notice { padding: 9px; border-radius: 7px; background: var(--surface); }
.weather-footer { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); }
.weather-footer a { font-size: 10px; color: var(--ocean); text-decoration: none; }
.weather-footer p { margin-top: 6px; }
@media(max-width:600px){.weather-ports{grid-template-columns:minmax(0,1fr)}.trip-weather{padding:16px}}
</style>
