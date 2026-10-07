<template>
  <section v-if="trips.length" class="weather-trip-picker">
    <label>Weather for a trip<select v-model="selected"><option value="">Choose a sailing</option><option v-for="trip in trips" :key="trip.code" :value="trip.code">{{ trip.code }} · {{ trip.origin.name }} to {{ trip.destination.name }}</option></select></label>
    <TripWeather v-if="selected" :sailing-code="selected" />
  </section>
</template>
<script setup lang="ts">
import { ref,watch } from 'vue';
import TripWeather from './TripWeather.vue';
const props=defineProps<{trips:Array<{code:string;origin:{name:string};destination:{name:string}}>}>();
const selected=ref('');
watch(()=>props.trips,()=>{if(selected.value && !props.trips.some(trip=>trip.code===selected.value))selected.value='';});
</script>
<style scoped>
.weather-trip-picker { margin: 16px 0 20px; }
label { display: grid; gap: 8px; color: var(--muted); font-size: 12px; }
select { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface); color: var(--ink); font: inherit; }
select:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
</style>
