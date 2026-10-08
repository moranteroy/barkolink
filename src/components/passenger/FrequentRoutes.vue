<template>
  <section id="frequent-routes" class="frequent-section" aria-labelledby="frequent-heading" :aria-busy="loading">
    <div class="frequent-heading"><h2 id="frequent-heading"><Ship :size="17" aria-hidden="true" />Frequent routes</h2><span v-if="routes.length">Your usual crossings</span></div>
    <p v-if="loading" class="frequent-state" role="status">Finding your usual routes…</p>
    <p v-else-if="historyError && !routes.length" class="frequent-state">Your booking history could not be loaded. Use Retry above to try again.</p>
    <div v-else-if="!routes.length" class="frequent-empty"><span class="route-icon"><Ship :size="20" aria-hidden="true" /></span><div><strong>Make your next crossing</strong><p>Your booked routes will appear here for a quicker return trip.</p></div><RouterLink to="/trips?all=1" aria-label="Browse sailing routes"><ArrowRight :size="18" aria-hidden="true" /></RouterLink></div>
    <div v-else class="frequent-grid">
      <article v-for="route in routes" :key="route.id">
        <div class="route-top"><span class="route-icon"><Ship :size="19" aria-hidden="true" /></span><span class="route-count">Booked {{ route.count }} {{ route.count === 1 ? 'time' : 'times' }}</span></div>
        <h3>{{ route.from }}<ArrowRight :size="13" aria-hidden="true" /><span class="sr-only">to</span>{{ route.to }}</h3>
        <p class="route-fare" v-if="faresLoading">Checking current fares…</p>
        <p class="route-fare" v-else-if="route.fare !== null">From <strong>{{ money.format(route.fare) }}</strong><span v-if="route.duration"> · {{ duration(route.duration) }}</span></p>
        <p class="route-fare" v-else>{{ faresError ? 'Check current fares in search' : 'Check upcoming schedules' }}</p>
        <button type="button" :aria-label="`Book again: ${route.from} to ${route.to}`" @click="emit('select', route)">Book again<ArrowUpRight :size="14" aria-hidden="true" /></button>
      </article>
    </div>
    <p v-if="routes.some(route => route.fare !== null) && !faresLoading" class="fare-note">Regular fare shown. Fees and accommodation charges appear before booking.</p>
    <p v-if="faresError && routes.length" class="fare-note" role="status">Current fare estimates are unavailable. <button class="retry-fares" type="button" @click="emit('retry')">Retry fares</button></p>
  </section>
</template>
<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { Ship, ArrowRight, ArrowUpRight } from '@lucide/vue';
import type { FrequentRoute } from '../../data/frequentRoutes';
defineProps<{ routes: FrequentRoute[]; loading: boolean; historyError: string; faresLoading: boolean; faresError: boolean }>();
const emit = defineEmits<{ select: [route: FrequentRoute]; retry: [] }>();
const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 2 });
function duration(minutes: number) { return `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h ` : ''}${minutes % 60 ? `${minutes % 60}m` : ''}`.trim(); }
</script>
<style scoped>
.frequent-section { margin-top:26px; }.frequent-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:12px; }.frequent-heading h2 { display:flex; align-items:center; gap:8px; margin:0; font-size:14px; font-weight:650; }.frequent-heading svg { color:var(--ocean); flex-shrink:0; }.frequent-heading > span { color:var(--muted); font-size:9px; }
.frequent-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }.frequent-grid article { display:flex; flex-direction:column; min-width:0; padding:14px; border:1px solid var(--line); border-radius:14px; background:var(--surface); }
.route-top { display:flex; align-items:center; justify-content:space-between; gap:6px; }.route-icon { display:grid; place-items:center; flex-shrink:0; width:34px; height:34px; border-radius:10px; color:var(--ocean); background:var(--light-blue); }.route-count { font-size:9px; line-height:1.5; color:var(--muted); }
h3 { display:flex; align-items:center; flex-wrap:wrap; gap:5px; margin:12px 0 6px; font-size:13px; line-height:1.6; overflow-wrap:anywhere; }h3 svg { color:var(--muted); flex-shrink:0; }.route-fare { margin:0 0 14px; color:var(--muted); font-size:10px; line-height:1.6; }.route-fare strong { color:var(--ink); font-weight:650; }
.frequent-grid button { display:flex; align-items:center; justify-content:center; gap:6px; width:100%; min-height:44px; margin-top:auto; border:1px solid transparent; border-radius:9px; background:var(--light-blue); color:var(--ocean); font:inherit; font-size:11px; font-weight:650; cursor:pointer; }.frequent-grid button:hover { border-color:var(--ocean); }
.frequent-empty { display:flex; align-items:center; gap:12px; padding:16px; border:1px dashed var(--line); border-radius:14px; background:var(--surface); }.frequent-empty > div { flex:1; min-width:0; }.frequent-empty strong { font-size:12px; }.frequent-empty p { margin:5px 0 0; color:var(--muted); font-size:11px; line-height:1.7; }.frequent-empty a { display:grid; place-items:center; width:44px; height:44px; color:var(--ocean); border-radius:9px; }
.frequent-state { padding:16px; background:var(--surface); border:1px solid var(--line); border-radius:12px; font-size:12px; color:var(--muted); line-height:1.7; }.fare-note { margin:10px 0 0; color:var(--muted); font-size:9px; line-height:1.7; }.retry-fares { min-height:44px; border:0; padding:0 6px; background:transparent; color:var(--ocean); font:inherit; text-decoration:underline; cursor:pointer; }
button:focus-visible,a:focus-visible { outline:2px solid var(--ocean); outline-offset:3px; }
@container passenger (max-width:360px) { .frequent-grid { grid-template-columns:1fr; }.frequent-grid article { padding:13px; }.frequent-heading > span { display:none; } }
</style>
