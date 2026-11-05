<template>
  <span class="weather-source"><a href="https://open-meteo.com/en/licence" target="_blank" rel="noopener noreferrer" aria-label="Weather data by Open-Meteo, licensed under CC BY 4.0" title="Weather data by Open-Meteo · CC BY 4.0"><Info :size="14" aria-hidden="true" /></a></span>
</template>
<script setup lang="ts">
import { Info } from '@lucide/vue';
</script>
<style scoped>
.weather-source { display:inline-flex; vertical-align:middle; color:var(--muted,#b8cbd9); }
a { display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; color:inherit; border-radius:6px; }
a:hover { background:var(--light-blue,#ffffff10); }
a:focus-visible { outline:2px solid var(--ocean,#61c4ff); outline-offset:2px; }
</style>
