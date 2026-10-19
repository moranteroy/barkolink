<template>
  <div class="smart-weather" :data-weather="weatherPresentation(reading.condition).kind">
    <div class="sky-glow" aria-hidden="true"></div>
    <div class="weather-topline"><span>{{ label }}</span><span class="weather-time">{{ timestamp }}</span></div>
    <div class="weather-hero">
      <div><strong class="temperature">{{ format(reading.temperatureC) }}<span>°C</span></strong><p>{{ reading.condition }}</p></div>
      <span class="hero-symbol" aria-hidden="true"><WeatherSymbol :kind="weatherPresentation(reading.condition).kind" active /></span>
    </div>
    <div class="weather-metrics">
      <div><span><Droplets :size="16" aria-hidden="true" /> Chance of rain</span><strong>{{ measurement(reading.rainChance, '%') }}</strong><small>During this hour</small></div>
      <div><span><Wind :size="16" aria-hidden="true" /> Wind speed</span><strong>{{ measurement(reading.windKph, 'km/h') }}</strong><small>At the port</small></div>
    </div>
    <div class="weather-secondary"><span><Cloud :size="14" aria-hidden="true" /> Cloud cover {{ measurement(reading.cloudCover, '%') }}</span><span v-if="reading.visibilityKm != null">Visibility {{ measurement(reading.visibilityKm, 'km') }}</span></div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { Cloud, Droplets, Wind } from '@lucide/vue';
import type { WeatherReading } from '../../services/weather';
import { weatherPresentation } from '../../data/weatherPresentation';
import WeatherSymbol from './WeatherSymbol.vue';
const props = defineProps<{ reading: WeatherReading; label: string }>();
const format = (value: number | null | undefined) => value == null ? '—' : String(Math.round(value));
const measurement = (value: number | null | undefined, unit: string) => value == null ? '—' : `${format(value)}${unit === '%' ? '' : ' '}${unit}`;
const timestamp = computed(() => props.reading.at ? new Date(props.reading.at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
</script>
<style scoped>
.smart-weather { position: relative; isolation: isolate; overflow: hidden; border-radius: 20px; padding: 20px; background: linear-gradient(145deg, #075d93, #1889b7 65%, #2694bc); color: #fff; }
.smart-weather[data-weather="rain"], .smart-weather[data-weather="storm"] { background: linear-gradient(145deg, #273d5c, #325d7b 65%, #47728b); }
.smart-weather[data-weather="cloud"], .smart-weather[data-weather="fog"] { background: linear-gradient(145deg, #345870, #527f99 65%, #4c6f88); }
:global([data-theme="dark"]) .smart-weather { background: linear-gradient(145deg, #103e59, #176383 65%, #23718b); }
:global([data-theme="dark"]) .smart-weather[data-weather="rain"], :global([data-theme="dark"]) .smart-weather[data-weather="storm"] { background: linear-gradient(145deg, #192e49, #284d6b 65%, #345f78); }
:global([data-theme="dark"]) .smart-weather[data-weather="cloud"], :global([data-theme="dark"]) .smart-weather[data-weather="fog"] { background: linear-gradient(145deg, #243d51, #3b6178 65%, #456f84); }
.sky-glow { position: absolute; z-index: -1; width: 180px; height: 180px; border-radius: 50%; right: -35px; top: 20px; background: #bdeeff28; filter: blur(22px); }
.smart-weather[data-weather="sun"] .sky-glow, .smart-weather[data-weather="partly"] .sky-glow { background: #ffdf7159; }
.weather-topline { display: flex; justify-content: space-between; align-items: start; gap: 12px; font-size: 13px; line-height: 1.5; font-weight: 700; }
.weather-time { text-align: right; font-size: 12px; font-weight: 500; }
.weather-hero { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 26px 0 28px; }
.temperature { display: block; font-size: clamp(44px, 12vw, 64px); line-height: 1; font-weight: 500; letter-spacing: -.06em; }
.temperature span { font-size: 22px; vertical-align: top; letter-spacing: 0; }
.weather-hero p { font-size: 15px; margin: 12px 0 0; line-height: 1.5; color: #f1f7fc; }
.hero-symbol { display: grid; place-items: center; width: 84px; height: 84px; flex-shrink: 0; color: #ffe69a; filter: drop-shadow(0 4px 12px #193b5533); }
.hero-symbol :deep(svg) { width: 100%; height: 100%; }
.weather-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.weather-metrics > div { display: grid; gap: 8px; padding: 15px 12px; border-radius: 14px; background: var(--surface); color: var(--ink); border: 1px solid var(--line); }
.weather-metrics span { display: flex; align-items: center; gap: 5px; font-size: 13px; line-height: 1.5; }
.weather-metrics svg { color: var(--ocean); flex-shrink: 0; }
.weather-metrics strong { font-size: 22px; line-height: 1.3; }
.weather-metrics small { color: var(--muted); font-size: 13px; }
.weather-secondary { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 14px; padding: 11px 12px; border-radius: 10px; color: var(--ink); background: var(--surface); font-size: 13px; line-height: 1.5; }
.weather-secondary span { display: inline-flex; align-items: center; gap: 5px; }
@media (max-width: 360px) { .smart-weather { padding: 14px; } .weather-topline { flex-wrap: wrap; } .weather-time { text-align: left; } .hero-symbol { width: 64px; height: 64px; } .weather-metrics > div { padding: 12px 9px; } .weather-metrics span { flex-wrap: wrap; } .weather-metrics strong { font-size: 20px; } }
</style>
