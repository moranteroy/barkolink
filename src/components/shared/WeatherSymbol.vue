<template>
  <svg viewBox="0 0 48 48" fill="none" stroke-linecap="round" stroke-linejoin="round" class="weather-art" :data-kind="kind" :class="{ active }" aria-hidden="true">
    <g v-if="kind === 'sun' || kind === 'partly'" class="sun" stroke="#e5a52c" stroke-width="2.4">
      <circle :cx="kind === 'partly' ? 17 : 24" :cy="kind === 'partly' ? 16 : 24" :r="kind === 'partly' ? 7 : 10" fill="#ffd56a" />
      <path v-if="kind === 'sun'" d="M24 3v5m0 32v5M3 24h5m32 0h5M9 9l4 4m22 22 4 4M9 39l4-4m22-22 4-4" />
      <path v-else d="M17 3v3M4 16h3m1-9 2 2m16-2-2 2M8 25l2-2m7 3v3" />
    </g>
    <path v-if="kind === 'clear'" d="M33 6a18 18 0 1 0 9 27A18 18 0 0 1 33 6Z" fill="#d5c6ff" stroke="#9f82df" stroke-width="2.3" />
    <g v-if="['partly','cloud','rain','storm','snow','fog'].includes(kind)" class="cloud">
      <path d="M13 32a8 8 0 0 1-1-16 11 11 0 0 1 21-1 8.5 8.5 0 1 1 3 17H13Z" fill="var(--cloud-fill)" stroke="var(--cloud-stroke)" stroke-width="2.1" />
    </g>
    <g v-if="kind === 'rain'" class="rain-drops" stroke="#42a7eb" stroke-width="2.7"><path d="m16 37-2 5m12-5-2 5m12-5-2 5" /></g>
    <path v-if="kind === 'storm'" class="lightning" d="m25 27-8 12h8l-3 7 12-15h-9l3-4Z" fill="#ffd56a" stroke="#d99a20" stroke-width="1.3" />
    <g v-if="kind === 'snow'" stroke="#57b9ed" stroke-width="1.7"><path d="M15 36v10m-4-7 8 4m-8 0 8-4m14-3v10m-4-7 8 4m-8 0 8-4" /></g>
    <g v-if="kind === 'fog'" class="wind-lines" stroke="#72b9c8" stroke-width="2.2"><path d="M6 37h30M12 42h30" /></g>
    <g v-if="kind === 'wind'" class="wind-lines" stroke="#32b7a5" stroke-width="2.5"><path d="M5 17h25a6 6 0 1 0-6-6M8 25h30a5 5 0 1 0-5-5M5 33h20a5 5 0 1 1-5 5" /></g>
    <g v-if="kind === 'unknown'" stroke="var(--cloud-stroke)" stroke-width="2.3"><circle cx="24" cy="24" r="17" /><path d="M19 18a5 5 0 1 1 8 4c-2 1-3 2-3 5m0 6h.01" /></g>
  </svg>
</template>
<script setup lang="ts">
import type { weatherPresentation } from '../../data/weatherPresentation';
defineProps<{ kind: ReturnType<typeof weatherPresentation>['kind']; active?: boolean }>();
</script>
<style scoped>
.weather-art { --cloud-fill: #e8f3fb; --cloud-stroke: #7198b6; display: block; width: 100%; height: 100%; overflow: visible; }
:global([data-theme="dark"]) .weather-art { --cloud-fill: #c8deed; --cloud-stroke: #8db8d5; }
.active .rain-drops { animation: rain-fall 1.3s ease-in-out 3; }
.active .cloud { animation: cloud-drift 2s ease-in-out 3; }
.active .wind-lines { animation: wind-flow 1.4s ease-in-out 3; }
.active .sun { transform-origin: center; animation: sun-glow 1.8s ease-in-out 3; }
.active .lightning { animation: sun-glow 1.4s ease-in-out 3; }
@keyframes rain-fall { 0%,100% { transform: translateY(-1px); opacity: .65; } 55% { transform: translateY(2px); opacity: 1; } }
@keyframes cloud-drift { 0%,100% { transform: translateX(-1px); } 50% { transform: translateX(1px); } }
@keyframes wind-flow { 0%,100% { transform: translateX(-2px); opacity: .65; } 50% { transform: translateX(2px); opacity: 1; } }
@keyframes sun-glow { 0%,100% { opacity: .75; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .weather-art.active g, .weather-art.active path { animation: none; } }
</style>
