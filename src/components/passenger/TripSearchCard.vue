<template>
  <form class="search-card glass-panel" novalidate @submit.prevent="search">
    <div class="card-heading">
      <div>
        <span class="eyebrow">Plan your journey</span>
        <h2>Find your next ferry</h2>
        <p class="card-subtitle">Choose your route, date, and passengers.</p>
      </div>
      <div class="heading-actions">
        <span class="route-badge">One way</span>
        <button class="swap-button" type="button" aria-label="Swap ports" :disabled="loading || !!portError" @click="swap">
          <ArrowLeftRight :size="18" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div class="route-fields">
      <CityPicker v-model="from" label="From" :options="cityOptions" :disabled="loading || !!portError" />
      <CityPicker v-model="to" label="To" :options="cityOptions" :disabled="loading || !!portError" destination />
    </div>
    <p v-if="routeError || portError" class="form-error" role="alert">{{ routeError || portError }}</p>
    <div class="detail-fields">
      <label class="date-field">
        <span class="field-caption"><CalendarDays :size="13" aria-hidden="true" />Departure date</span>
        <input v-model="date" type="date" :min="today" />
      </label>
      <div class="passenger-field">
        <span :id="countLabelId" class="field-caption"><Users :size="13" aria-hidden="true" />Passengers</span>
        <div class="counter" role="group" :aria-labelledby="countLabelId">
          <button type="button" aria-label="Remove passenger" :disabled="count <= 1" @click="count--"><Minus :size="16" aria-hidden="true" /></button>
          <strong aria-live="polite">{{ count }}<small>{{ count === 1 ? 'passenger' : 'passengers' }}</small></strong>
          <button type="button" aria-label="Add passenger" :disabled="count >= 8" @click="count++"><Plus :size="16" aria-hidden="true" /></button>
        </div>
      </div>
      <Button class="search-button" type="submit" :disabled="loading || !!portError || cities.length < 2">
        <Search :size="17" aria-hidden="true" />{{ loading ? 'Loading ports…' : 'Search sailings' }}<ArrowRight :size="16" aria-hidden="true" />
      </Button>
    </div>
    <p class="search-hint"><Ticket :size="12" aria-hidden="true" />Check schedules and available seats before booking.</p>
  </form>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch, useId } from "vue";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, CalendarDays, Users, Minus, Plus, Search, ArrowRight, Ticket } from '@lucide/vue';
import CityPicker from '../shared/CityPicker.vue';
import { browseActivePorts } from "../../services/database/passenger";
import { database } from "../../services/session";
import { philippineDateKey } from "../../data/travelDate";
import { recordRecentSearch } from "../../data/recentSearches";
const emit = defineEmits<{ searched: []; originChanged: [portId: string] }>();
const props = withDefaults(defineProps<{ navigateOnSearch?: boolean }>(), {
  navigateOnSearch: true,
});
const router = useRouter();
const countLabelId = useId();
const localDate = (date: Date) => {
  return philippineDateKey(date);
};
const today = localDate(new Date());
const defaultDate = new Date();
defaultDate.setDate(defaultDate.getDate() + 1);
function readRoute() {
  try {
    return JSON.parse(
      localStorage.getItem("barkolink-search-route") || "{}",
    ) as { from?: string; to?: string };
  } catch {
    return {};
  }
}
const prior = readRoute();
const from = ref(prior.from || ""),
  to = ref(prior.to || "");
const savedDate = localStorage.getItem("barkolink-search-iso-date");
const date = ref(
  savedDate && savedDate >= today ? savedDate : localDate(defaultDate),
);
const count = ref(
  Math.max(
    1,
    Math.min(
      8,
      Number(localStorage.getItem("barkolink-search-passengers")) || 1,
    ),
  ),
);
const ports = ref<{ id: string; city: string; name?: string }[]>([]),
  loading = ref(true),
  portError = ref(""),
  routeError = ref("");
const cities = computed(() => [
  ...new Set(ports.value.map((port) => port.city)),
]);
const cityOptions = computed(() => cities.value.map(city => ({ value: city, description: ports.value.filter(port => port.city === city).map(port => port.name || `${city} port`).join(' · ') })));
watch(() => ports.value.find(port => port.city === from.value)?.id || "", portId => emit("originChanged", portId));
onMounted(async () => {
  try {
    if (!database) throw new Error("Supabase is unavailable.");
    const result = await browseActivePorts(database);
    ports.value = result.data.ports;
    if (!cities.value.includes(from.value)) from.value = cities.value[0] || "";
    if (!cities.value.includes(to.value) || to.value === from.value)
      to.value = cities.value.find((city) => city !== from.value) || "";
    if (cities.value.length < 2)
      portError.value = "At least two active port cities are needed to search.";
  } catch (error) {
    portError.value = (error as Error).message || "Could not load ports.";
  } finally {
    loading.value = false;
  }
});
function swap() {
  const old = from.value;
  from.value = to.value;
  to.value = old;
  routeError.value = "";
}
function search() {
  if (!from.value || !to.value || from.value === to.value) {
    routeError.value = "Choose two different ports.";
    return;
  }
  if (!date.value || date.value < today) {
    routeError.value = "Choose today or a future date.";
    return;
  }
  routeError.value = "";
  localStorage.setItem("barkolink-search-iso-date", date.value);
  localStorage.setItem(
    "barkolink-search-date",
    new Date(`${date.value}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }),
  );
  localStorage.setItem("barkolink-search-passengers", String(count.value));
  localStorage.setItem(
    "barkolink-search-route",
    JSON.stringify({ from: from.value, to: to.value }),
  );
  emit("searched");
  recordRecentSearch({ from: from.value, to: to.value, date: date.value, passengers: count.value });
  if (props.navigateOnSearch) void router.push("/trips");
}
</script>
<style scoped>
.search-card { padding:22px; border:1px solid var(--line); border-radius:21px; background:var(--surface); box-shadow:0 12px 32px #102b4c0a; }
.card-heading { display:flex; align-items:start; justify-content:space-between; gap:12px; margin-bottom:20px; }
.card-heading > div:first-child { min-width:0; }
.eyebrow { color:var(--ocean); font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
h2 { margin:5px 0; font-size:22px; letter-spacing:-.5px; line-height:1.3; }
.card-subtitle { margin:6px 0 0; color:var(--muted); font-size:11px; line-height:1.6; }
.heading-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
.route-badge { padding:6px 8px; border-radius:7px; background:var(--light-blue); color:var(--ocean); font-size:9px; font-weight:700; white-space:nowrap; }
.swap-button { display:grid; place-items:center; width:44px; height:44px; padding:0; border:1px solid var(--line); border-radius:12px; background:var(--surface-soft); color:var(--ocean); cursor:pointer; transition:background .18s; }
.swap-button:hover { background:var(--light-blue); }
.route-fields,.detail-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:end; gap:12px; }
.detail-fields { margin-top:16px; }
.date-field,.passenger-field { display:grid; gap:7px; min-width:0; }
.field-caption { display:flex; align-items:center; gap:5px; color:var(--muted); font-size:10px; font-weight:700; line-height:1.5; }
input { box-sizing:border-box; width:100%; min-width:0; height:54px; padding:0 10px; border:1px solid var(--line); border-radius:12px; background:var(--surface-soft); color:var(--ink); font:inherit; font-size:16px; font-weight:650; }
:global(:root[data-theme="dark"]) input[type="date"] { color-scheme:dark; }
.counter { display:flex; align-items:center; justify-content:space-between; gap:2px; height:54px; padding:4px; border:1px solid var(--line); border-radius:12px; background:var(--surface-soft); color:var(--ink); }
.counter button { display:grid; place-items:center; width:44px; height:44px; flex-shrink:0; padding:0; border:0; border-radius:8px; background:var(--light-blue); color:var(--ocean); cursor:pointer; }
.counter button:disabled,.swap-button:disabled { opacity:.4; cursor:default; }
.counter strong { min-width:0; display:grid; gap:1px; text-align:center; color:var(--ink); font-size:15px; line-height:1.2; }
.counter small { font-size:8px; font-weight:500; color:var(--muted); }
.search-button { grid-column:1/-1; width:100%; display:flex; align-items:center; justify-content:center; gap:9px; height:48px; margin:2px 0 0; border-radius:12px; background:var(--action,var(--ocean)); font-size:13px; font-weight:750; white-space:nowrap; }
.search-button svg { flex-shrink:0; }
.search-hint { display:flex; align-items:center; justify-content:center; gap:5px; margin:12px 0 0; color:var(--muted); font-size:10px; line-height:1.6; }
.search-hint svg { flex-shrink:0; }
.form-error { margin:10px 0 0; color:var(--danger); font-size:11px; font-weight:700; }
.swap-button:focus-visible,.counter button:focus-visible,input:focus-visible { outline:2px solid var(--ocean); outline-offset:3px; }
@container passenger (max-width:620px) {
  .search-card { padding:18px 15px; }
  .route-fields { grid-template-columns:1fr; gap:12px; }
  .heading-actions { flex-direction:column; gap:5px; }
  .card-heading { margin-bottom:16px; }
}
@container passenger (max-width:360px) {
  .detail-fields { grid-template-columns:1fr; }
}
@media(prefers-reduced-motion:reduce) { .swap-button { transition:none; } }
</style>
