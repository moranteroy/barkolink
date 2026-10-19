<template>
  <div class="operations-overview" :class="{ 'is-analytics': analytics }" :aria-busy="loading">
    <p v-if="error" class="catalog-error" role="alert">{{ error }}</p>
    <div v-if="loading && !data" class="overview-loading" role="status">Loading operational insights…</div>
    <template v-if="data">
      <div class="overview-context"><span><span class="context-dot"></span>{{ analytics ? 'PERFORMANCE OVERVIEW' : 'DAILY OPERATIONS' }}</span><span>{{ todayLabel }} <span class="context-separator">/</span> {{ loading ? 'Refreshing…' : `Updated ${updatedLabel}` }}</span></div>
      <section v-if="!analytics" class="overview-metrics" aria-label="Today's operational metrics">
        <article v-for="metric in primaryMetrics" :key="metric.key"><div class="metric-top"><span>{{ metric.label }}</span><span class="metric-icon"><AppIcon :icon="metric.icon" aria-hidden="true" /></span></div><strong>{{ number(data.stats[metric.key] ?? 0) }}{{ metric.key === 'utilization' ? '%' : '' }}</strong><p>{{ metric.context }}</p></article>
      </section>
      <section v-else class="overview-metrics" aria-label="Monthly performance summary">
        <article><div class="metric-top"><span>Period bookings</span><span class="metric-icon"><AppIcon :icon="ticketOutline" aria-hidden="true" /></span></div><strong>{{ number(periodBookings) }}</strong><p>{{ rangeLabel }} · bookings created</p></article>
        <article><div class="metric-top"><span>Period passengers</span><span class="metric-icon"><AppIcon :icon="peopleOutline" aria-hidden="true" /></span></div><strong>{{ number(periodPassengers) }}</strong><p>Passengers in period bookings</p></article>
        <article><div class="metric-top"><span>Passengers / booking</span><span class="metric-icon"><AppIcon :icon="trendingUpOutline" aria-hidden="true" /></span></div><strong>{{ periodBookings ? (periodPassengers / periodBookings).toFixed(1) : '—' }}</strong><p>Average across {{ months.length }} months</p></article>
        <article><div class="metric-top"><span>Top-route passengers</span><span class="metric-icon"><AppIcon :icon="boatOutline" aria-hidden="true" /></span></div><strong>{{ number(routeTotal) }}</strong><p>Active reservations · top {{ data.routes.length }} routes</p></article>
      </section>
      <section v-if="!analytics" class="attendance-strip" aria-label="Today's attendance and cancellations"><div v-for="metric in attendanceMetrics" :key="metric.key"><span class="attendance-icon" :class="metric.tone"><AppIcon :icon="metric.icon" aria-hidden="true" /></span><span>{{ metric.label }}</span><strong>{{ number(data.stats[metric.key] ?? 0) }}</strong></div></section>

      <div class="analytics-grid">
        <div class="insight-column">
          <section class="insight-panel trend-panel" aria-labelledby="volume-title">
          <header class="insight-heading"><div><p class="section-kicker">DEMAND TREND</p><h2 id="volume-title">Bookings &amp; passenger volume</h2></div><div class="period-switch" role="group" aria-label="Trend period"><button v-for="period in [3, 6]" :key="period" :aria-pressed="periodMonths === period" @click="periodMonths = period; activeMonth = null">{{ period }} months</button></div></header>
          <div class="trend-summary"><div><strong>{{ number(periodPassengers) }}</strong><span>passengers</span></div><div><strong>{{ number(periodBookings) }}</strong><span>bookings</span></div></div>
          <div class="trend-legend" role="group" aria-label="Visible chart series"><button :aria-pressed="showBookings" @click="showBookings = !showBookings"><i class="booking-dot"></i>Bookings</button><button :aria-pressed="showPassengers" @click="showPassengers = !showPassengers"><i class="passenger-dot"></i>Passengers</button><span>{{ rangeLabel }}</span></div>
          <div v-if="months.length && (showBookings || showPassengers)" class="trend-canvas">
            <svg viewBox="0 0 720 250" role="img" :aria-label="monthlyDescription">
              <defs><linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#34d399" stop-opacity=".22" /><stop offset="100%" stop-color="#34d399" stop-opacity="0" /></linearGradient></defs>
              <g v-for="tick in [0, 1, 2, 3, 4]" :key="tick"><line x1="52" x2="686" :y1="200 - tick * 40" :y2="200 - tick * 40" class="chart-gridline" /><text x="40" :y="204 - tick * 40" text-anchor="end" class="axis-label">{{ number(tick * axisStep) }}</text></g>
              <path v-if="showPassengers" :d="areaPath" :fill="`url(#${gradientId})`" />
              <polyline v-if="showPassengers" :points="points('passengers')" class="trend-line passenger-line" />
              <polyline v-if="showBookings" :points="points('bookings')" class="trend-line booking-line" />
              <g v-for="(month, index) in months" :key="month.month" @mouseenter="activeMonth = index" @mouseleave="activeMonth = null">
                <line v-if="activeMonth === index" :x1="x(index)" :x2="x(index)" y1="32" y2="200" class="chart-guide" />
                <circle v-if="showPassengers" :cx="x(index)" :cy="y(month.passengers)" r="5" class="point passenger-point"><title>{{ month.month }}: {{ month.passengers }} passengers</title></circle>
                <circle v-if="showBookings" :cx="x(index)" :cy="y(month.bookings)" r="4" class="point booking-point"><title>{{ month.month }}: {{ month.bookings }} bookings</title></circle>
                <text :x="x(index)" y="230" text-anchor="middle" class="axis-label month-axis">{{ month.month }}</text>
                <rect :x="x(index) - 40" y="24" width="80" height="180" fill="transparent" tabindex="0" :aria-label="`${month.month}: ${month.bookings} bookings, ${month.passengers} passengers`" @click="activeMonth = index" @focus="activeMonth = index" @blur="activeMonth = null"><title>{{ month.month }} · {{ month.bookings }} bookings · {{ month.passengers }} passengers</title></rect>
              </g>
            </svg>
          </div>
          <p v-else class="chart-empty">{{ months.length ? 'Select a series to display the trend.' : 'Monthly activity will appear here.' }}</p>
          <div class="trend-readout" aria-live="polite"><span>{{ focusedMonth?.month || 'Monthly trend' }}</span><strong v-if="focusedMonth">{{ number(focusedMonth.bookings) }} bookings <span>·</span> {{ number(focusedMonth.passengers) }} passengers</strong><span v-else>Hover or focus a month to inspect its figures</span></div>
          <details class="chart-data"><summary>View monthly figures <span>Current month is in progress</span></summary><div class="data-table-scroll"><table><thead><tr><th scope="col">Month</th><th scope="col">Bookings</th><th scope="col">Passengers</th></tr></thead><tbody><tr v-for="month in months" :key="month.month"><th scope="row">{{ month.month }}</th><td>{{ number(month.bookings) }}</td><td>{{ number(month.passengers) }}</td></tr></tbody><tfoot><tr><th scope="row">Period total</th><td>{{ number(periodBookings) }}</td><td>{{ number(periodPassengers) }}</td></tr></tfoot></table></div></details>
        </section>
          <section class="insight-panel routes-panel" aria-labelledby="routes-title"><header class="insight-heading"><div><p class="section-kicker">ROUTE PERFORMANCE</p><h2 id="routes-title">Passenger demand by route</h2><p>Active reservations · top routes by passenger count</p></div><span class="panel-count">{{ data.routes.length }} routes</span></header><div class="route-ranking"><div v-for="(item, index) in sortedRoutes" :key="item.route" class="ranked-route"><span class="route-rank">{{ String(index + 1).padStart(2, '0') }}</span><div><div class="route-label"><strong>{{ item.route }}</strong><span>{{ number(item.passengers) }} <small>passengers</small></span></div><div class="route-track"><i :style="{ width: `${percent(item.passengers, routeTotal)}%` }"></i></div></div><strong class="route-share">{{ percent(item.passengers, routeTotal) }}%</strong></div></div><p v-if="!data.routes.length" class="chart-empty">Route activity will appear here.</p><p class="panel-footnote">Share of {{ number(routeTotal) }} passengers across the displayed routes. Directional routes are tracked separately.</p></section>
        </div>
        <div class="insight-column">
          <section class="insight-panel booking-panel" aria-labelledby="booking-status-title"><header class="insight-heading"><div><p class="section-kicker">RESERVATION HEALTH</p><h2 id="booking-status-title">Booking status</h2><p>All reservations · all time</p></div></header><div class="booking-breakdown"><div class="booking-donut" :style="{ background: pie(data.bookingStatus) }" role="img" :aria-label="describe(data.bookingStatus)"><div><strong>{{ number(sum(data.bookingStatus)) }}</strong><span>total bookings</span></div></div><ul class="distribution-list"><li v-for="(item, index) in data.bookingStatus" :key="item.name"><span><i :style="{ background: segmentColor(item.name, index) }"></i>{{ label(item.name) }}</span><strong>{{ number(item.value) }}</strong><small>{{ percent(item.value, sum(data.bookingStatus)) }}%</small></li></ul></div><p v-if="!sum(data.bookingStatus)" class="chart-empty">No reservations yet.</p></section>
          <section class="insight-panel categories-panel" aria-labelledby="categories-title"><header class="insight-heading"><div><p class="section-kicker">PASSENGER PROFILE</p><h2 id="categories-title">Passenger categories</h2><p>Paid, confirmed reservations · {{ number(sum(data.categories)) }} passengers</p></div></header><div class="category-list"><div v-for="(item, index) in sortedCategories" :key="item.name" class="category-row"><span>{{ label(item.name) }}</span><div class="category-track"><i :style="{ width: `${percent(item.value, sum(data.categories))}%`, background: segmentColor(item.name, index) }"></i></div><strong>{{ number(item.value) }}</strong><small>{{ percent(item.value, sum(data.categories)) }}%</small></div></div><p v-if="!sum(data.categories)" class="chart-empty">No paid passengers yet.</p><p class="panel-footnote">Counts reflect passenger categories recorded at booking.</p></section>
        </div>
      </div>

      <section v-if="!analytics" class="insight-panel today-trips"><header class="insight-heading"><div><p class="section-kicker">SAILING SCHEDULE</p><h2>Today's departures</h2><p>Philippine time · reserved seats and vessel capacity</p></div><RouterLink to="/admin/trips">View all trips <AppIcon :icon="arrowForwardOutline" aria-hidden="true" /></RouterLink></header><div class="data-table-scroll"><table aria-label="Today's departures"><thead><tr><th scope="col">Trip / Route</th><th scope="col">Vessel</th><th scope="col">Departure</th><th scope="col">Reserved seats</th><th scope="col">Status</th></tr></thead><tbody><tr v-for="trip in data.trips" :key="trip.code"><td><RouterLink :to="`/admin/trip-operations?sailing=${encodeURIComponent(trip.code)}`">{{ trip.code }}</RouterLink><small>{{ trip.origin.name }} → {{ trip.destination.name }}</small></td><td data-label="Vessel">{{ trip.vessel.name }}</td><td data-label="Departure"><time :datetime="trip.departureAt">{{ time(trip.departureAt) }}</time></td><td data-label="Reserved seats"><strong>{{ number(trip.vessel.passengerCapacity - trip.availableSeats) }}</strong><span class="muted"> / {{ number(trip.vessel.passengerCapacity) }}</span></td><td data-label="Status"><Badge :class="['trip-state', trip.status.toLowerCase()]" :variant="trip.status === 'CANCELLED' ? 'destructive' : ['BOARDING', 'DELAYED'].includes(trip.status) ? 'warning' : trip.status === 'COMPLETED' ? 'success' : 'default'">{{ label(trip.status) }}</Badge></td></tr><tr v-if="!data.trips.length"><td colspan="5" class="chart-empty">No departures scheduled today.</td></tr></tbody></table></div></section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { notifyError } from '@/composables/toast';
import { computed, onMounted, ref, useId, watch } from 'vue';
import { RouterLink } from 'vue-router';
import AppIcon from "@/components/ui/icon/AppIcon.vue";
import { Badge } from '@/components/ui/badge';
import { boatOutline, ticketOutline, peopleOutline, scanOutline, checkmarkCircleOutline, personRemoveOutline, closeCircleOutline, trendingUpOutline, arrowForwardOutline } from 'ionicons/icons';
import { overview, type Overview } from '../../services/database/workspaces';
import { staffDatabase } from '../../services/session';
import { databaseRequestError } from '../../data/databaseErrors';
import { auditLabel as humanize } from '../../data/auditPresentation';
const props = withDefaults(defineProps<{ refreshToken?: number; analytics?: boolean }>(), { analytics: false });
const data = ref<Overview | null>(null), loading = ref(false), error = ref(''), updatedAt = ref<Date | null>(null);
const periodMonths = ref(6), activeMonth = ref<number | null>(null), showBookings = ref(true), showPassengers = ref(true);
const gradientId = `volume-gradient-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
const number = (value: number) => value.toLocaleString('en-PH', { maximumFractionDigits: 1 });
const label = (value: string) => value.toUpperCase() === 'PWD' ? 'PWD' : humanize(value);
const todayLabel = computed(() => (updatedAt.value || new Date()).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }));
const time = (value: string | Date) => new Date(value).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' });
const updatedLabel = computed(() => updatedAt.value ? time(updatedAt.value) : '—');
const primaryMetrics = [
  { key: 'todayTrips', label: "Today's sailings", icon: boatOutline, context: 'Scheduled for today' },
  { key: 'todayBookings', label: "Today's bookings", icon: ticketOutline, context: 'Created today' },
  { key: 'todayPassengers', label: "Today's passengers", icon: peopleOutline, context: 'On today’s sailings' },
  { key: 'utilization', label: 'Fleet utilization', icon: trendingUpOutline, context: 'Reserved seats · active sailings' },
];
const attendanceMetrics = [
  { key: 'checkedIn', label: 'Checked in', icon: scanOutline, tone: 'blue' },
  { key: 'boarded', label: 'Boarded', icon: checkmarkCircleOutline, tone: 'green' },
  { key: 'noShow', label: 'No-shows', icon: personRemoveOutline, tone: 'amber' },
  { key: 'cancelled', label: 'Cancelled', icon: closeCircleOutline, tone: 'red' },
];
type Segment = { name: string; value: number };
const colors = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#94a3b8'];
const semanticColors: Record<string, string> = { confirmed: '#60a5fa', pending: '#fbbf24', cancelled: '#fb7185', expired: '#94a3b8', completed: '#34d399', regular: '#60a5fa', student: '#34d399', senior: '#a78bfa', child: '#fbbf24', pwd: '#f472b6', pregnant: '#94a3b8', resident: '#22d3ee' };
const segmentColor = (name: string, index: number) => semanticColors[name.toLowerCase()] || colors[index % colors.length];
const sum = (items: Segment[]) => items.reduce((total, item) => total + item.value, 0);
const percent = (value: number, total: number) => total ? Math.round(1000 * value / total) / 10 : 0;
const describe = (items: Segment[]) => items.map(item => `${label(item.name)}: ${item.value}`).join(', ') || 'No data';
function pie(items: Segment[]) {
  const total = sum(items); if (!total) return 'var(--line)';
  let cursor = 0;
  return `conic-gradient(${items.map((item, index) => { const start = cursor; cursor += 100 * item.value / total; return `${segmentColor(item.name, index)} ${start}% ${cursor}%`; }).join(',')})`;
}
const months = computed(() => (data.value?.monthly || []).slice(-periodMonths.value));
const periodBookings = computed(() => months.value.reduce((total, month) => total + month.bookings, 0));
const periodPassengers = computed(() => months.value.reduce((total, month) => total + month.passengers, 0));
const rangeLabel = computed(() => months.value.length ? `${months.value[0].month} – ${months.value[months.value.length - 1].month}` : 'No monthly data');
const routeTotal = computed(() => (data.value?.routes || []).reduce((total, route) => total + route.passengers, 0));
const sortedRoutes = computed(() => [...(data.value?.routes || [])].sort((a, b) => b.passengers - a.passengers));
const sortedCategories = computed(() => [...(data.value?.categories || [])].sort((a, b) => b.value - a.value));
const axisStep = computed(() => {
  const max = Math.max(1, ...months.value.flatMap(month => [showBookings.value ? month.bookings : 0, showPassengers.value ? month.passengers : 0]));
  const target = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 2.5, 3, 4, 5, 6, 8, 10].find(value => value * magnitude >= target) ?? 10;
  return Math.max(1, step * magnitude);
});
const x = (index: number) => months.value.length > 1 ? 60 + index * 618 / (months.value.length - 1) : 369;
const y = (value: number) => 200 - value / (axisStep.value * 4) * 160;
const points = (key: 'bookings' | 'passengers') => months.value.map((month, index) => `${x(index)},${y(month[key])}`).join(' ');
const areaPath = computed(() => months.value.length ? `M ${x(0)},200 L ${months.value.map((month, index) => `${x(index)},${y(month.passengers)}`).join(' L ')} L ${x(months.value.length - 1)},200 Z` : '');
const focusedMonth = computed(() => activeMonth.value === null ? null : months.value[activeMonth.value]);
const monthlyDescription = computed(() => months.value.map(month => `${month.month}: ${month.bookings} bookings, ${month.passengers} passengers`).join('; ') || 'No data');
let request = 0;
async function load() {
  if (!staffDatabase) return;
  const token = ++request; loading.value = true; error.value = '';
  try { const result = await overview(staffDatabase); if (token === request) { data.value = result.data; updatedAt.value = new Date(); } }
  catch (cause) { if (token === request) error.value = notifyError(databaseRequestError(cause, 'Could not load operational insights.')); }
  finally { if (token === request) loading.value = false; }
}
onMounted(load);
watch(() => props.refreshToken, load);
</script>

<style scoped>
.operations-overview { --chart-blue:#60a5fa; --chart-green:#34d399; display:grid; gap:14px; min-width:0; }
.overview-context { display:flex; flex-wrap:wrap; justify-content:space-between; gap:6px 12px; font-size:11px; color:var(--muted); line-height:1.5; }.overview-context>span:first-child { display:flex; align-items:center; gap:7px; letter-spacing:.06em; font-weight:600; }.context-dot { width:5px; height:5px; border-radius:50%; background:var(--ocean); }.context-separator { margin:0 6px; opacity:.5; }
.overview-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }.overview-metrics article,.insight-panel,.attendance-strip { border:1px solid var(--line); border-radius:12px; background:var(--surface); }.overview-metrics article { padding:14px; min-width:0; }.metric-top { display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:12px; color:var(--muted); }.metric-icon { display:grid; place-items:center; flex:none; width:26px; height:26px; border-radius:7px; background:var(--light-blue); color:var(--ocean); font-size:16px; }.overview-metrics article>strong { display:block; font-size:28px; font-weight:650; line-height:1.15; margin:6px 0; letter-spacing:-.8px; font-variant-numeric:tabular-nums; }.overview-metrics p { margin:0; font-size:11px; line-height:1.5; color:var(--muted); }
.attendance-strip { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); padding:11px 0; }.attendance-strip>div { display:flex; align-items:center; gap:8px; padding:0 14px; border-right:1px solid var(--line); font-size:12px; color:var(--muted); }.attendance-strip>div:last-child { border-right:0; }.attendance-strip strong { margin-left:auto; font-size:18px; color:var(--ink); font-variant-numeric:tabular-nums; }.attendance-icon { font-size:18px; color:var(--ocean); }.attendance-icon.green { color:#34b887; }.attendance-icon.amber { color:#d99c20; }.attendance-icon.red { color:#ed6a7c; }
.analytics-grid { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(340px,1fr); gap:14px; align-items:stretch; }.insight-column { display:flex; flex-direction:column; gap:14px; min-width:0; }.insight-panel { padding:16px; min-width:0; }.insight-heading { display:flex; justify-content:space-between; align-items:start; gap:12px; margin-bottom:12px; }.insight-heading>div { min-width:0; }.section-kicker { margin:0 0 4px; color:var(--ocean); font-size:10px; letter-spacing:.08em; font-weight:650; }.insight-heading h2 { margin:0; font-size:16px; font-weight:650; line-height:1.4; }.insight-heading p:not(.section-kicker) { margin:4px 0 0; color:var(--muted); font-size:11px; line-height:1.5; }
.period-switch { display:flex; flex:none; gap:2px; padding:3px; border:1px solid var(--line); border-radius:8px; background:var(--surface-soft); }.period-switch button { min-height:30px; padding:5px 8px; border:0; border-radius:5px; background:transparent; color:var(--muted); font:inherit; font-size:11px; cursor:pointer; white-space:nowrap; }.period-switch button[aria-pressed="true"] { background:var(--light-blue); color:var(--ocean); font-weight:600; }
.trend-summary { display:flex; flex-wrap:wrap; gap:12px 24px; }.trend-summary>div { display:flex; align-items:baseline; gap:7px; }.trend-summary strong { font-size:23px; line-height:1.3; font-weight:650; letter-spacing:-.5px; font-variant-numeric:tabular-nums; }.trend-summary span { font-size:12px; color:var(--muted); }
.trend-legend { display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin-top:10px; }.trend-legend button { display:inline-flex; align-items:center; gap:6px; padding:5px 0; border:0; background:transparent; color:var(--muted); font:inherit; font-size:11px; cursor:pointer; }.trend-legend button[aria-pressed="false"] { opacity:.5; text-decoration:line-through; }.trend-legend i { width:7px; height:7px; border-radius:50%; }.booking-dot { background:var(--chart-blue); }.passenger-dot { background:var(--chart-green); }.trend-legend>span { margin-left:auto; font-size:11px; color:var(--muted); }
.trend-canvas { margin-top:2px; }.trend-canvas svg { display:block; width:100%; height:180px; max-height:220px; overflow:visible; }.chart-gridline { stroke:var(--line); stroke-width:1; stroke-dasharray:3 5; }.axis-label { fill:var(--muted); font-size:14px; font-family:inherit; }.month-axis { font-weight:500; }.trend-line { fill:none; stroke-width:3; stroke-linecap:round; stroke-linejoin:round; }.booking-line { stroke:var(--chart-blue); }.passenger-line { stroke:var(--chart-green); }.point { stroke:var(--surface); stroke-width:2; }.booking-point { fill:var(--chart-blue); }.passenger-point { fill:var(--chart-green); }.chart-guide { stroke:var(--muted); stroke-dasharray:3 5; opacity:.4; }
.trend-readout { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:4px 8px; min-height:20px; color:var(--muted); font-size:11px; }.trend-readout strong { color:var(--ink); font-weight:500; }.trend-readout strong span { color:var(--muted); margin:0 4px; }.chart-data { margin-top:8px; border-top:1px solid var(--line); font-size:12px; }.chart-data summary { padding-top:10px; color:var(--ocean); cursor:pointer; }.chart-data summary span { float:right; color:var(--muted); font-size:11px; }
.booking-breakdown { display:grid; grid-template-columns:128px minmax(0,1fr); gap:16px; align-items:center; min-height:144px; }.booking-donut { width:128px; aspect-ratio:1; display:grid; place-items:center; border-radius:50%; }.booking-donut>div { display:grid; align-content:center; justify-items:center; gap:3px; width:77%; height:77%; border-radius:50%; background:var(--surface); }.booking-donut strong { font-size:25px; line-height:1.2; font-weight:650; letter-spacing:-.6px; }.booking-donut span { font-size:9px; color:var(--muted); }.distribution-list { list-style:none; padding:0; margin:0; }.distribution-list li { display:grid; grid-template-columns:minmax(0,1fr) auto 39px; gap:6px; align-items:center; padding:8px 0; border-bottom:1px solid var(--line); font-size:11px; }.distribution-list li:last-child { border-bottom:0; }.distribution-list li>span { display:flex; align-items:center; gap:6px; color:var(--muted); }.distribution-list i { width:6px; height:6px; border-radius:2px; flex:none; }.distribution-list strong,.distribution-list small { font-variant-numeric:tabular-nums; }.distribution-list small { color:var(--muted); font-size:10px; text-align:right; }
.routes-panel,.categories-panel { flex:1; display:flex; flex-direction:column; }.panel-count { flex:none; padding:4px 7px; border-radius:6px; background:var(--surface-soft); color:var(--muted); font-size:10px; }.route-ranking { display:grid; gap:16px; margin:4px 0 16px; }.ranked-route { display:grid; grid-template-columns:18px minmax(0,1fr) 40px; align-items:center; gap:10px; }.route-rank { font-size:10px; color:var(--muted); }.route-label { display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px 8px; margin-bottom:7px; font-size:12px; }.route-label strong { font-weight:550; }.route-label span { white-space:nowrap; font-variant-numeric:tabular-nums; }.route-label small { color:var(--muted); font-size:10px; }.route-track,.category-track { height:5px; border-radius:8px; background:var(--surface-soft); overflow:hidden; }.route-track i,.category-track i { display:block; height:100%; border-radius:inherit; }.route-track i { background:var(--chart-blue); }.route-share { font-size:11px; text-align:right; color:var(--muted); font-weight:500; }
.category-list { display:grid; gap:14px; margin:4px 0 16px; }.category-row { display:grid; grid-template-columns:64px minmax(0,1fr) 32px 38px; align-items:center; gap:8px; font-size:11px; }.category-row>span { color:var(--muted); }.category-row strong,.category-row small { text-align:right; font-variant-numeric:tabular-nums; }.category-row small { font-size:10px; color:var(--muted); }.panel-footnote { border-top:1px solid var(--line); padding-top:10px; margin: auto 0 0; color:var(--muted); font-size:10px; line-height:1.5; }
.today-trips .insight-heading>a { display:inline-flex; align-items:center; gap:6px; color:var(--ocean); text-decoration:none; font-size:12px; white-space:nowrap; min-height:32px; }.data-table-scroll { overflow:auto; }table { width:100%; border-collapse:collapse; font-size:12px; }th,td { padding:10px 12px; border-bottom:1px solid var(--line); text-align:left; line-height:1.4; }thead th { color:var(--muted); background:var(--surface-soft); font-size:10px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; white-space:nowrap; }tbody tr:last-child td { border-bottom:0; }tbody tr:hover { background:var(--surface-soft); }td a { color:var(--ocean); font-weight:550; text-decoration:none; }td>small { display:block; margin-top:4px; font-size:11px; color:var(--muted); }.today-trips td:not(:first-child) { white-space:nowrap; }.today-trips .trip-state { font-size:10px; }.muted { color:var(--muted); }tfoot { background:var(--surface-soft); font-weight:600; }.chart-empty,.overview-loading { padding:20px 12px; text-align:center; color:var(--muted); font-size:12px; }button:focus-visible,summary:focus-visible,a:focus-visible { outline:2px solid var(--ocean); outline-offset:3px; }
@media(max-width:1100px) { .analytics-grid { grid-template-columns:minmax(0,1fr); }.insight-column { display:contents; }.trend-panel { order:1; }.booking-panel { order:2; }.routes-panel { order:3; }.categories-panel { order:4; }.booking-breakdown { grid-template-columns:112px minmax(0,1fr); max-width:500px; }.overview-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media(max-width:580px) { .overview-context { font-size:10px; }.overview-metrics { gap:10px; }.overview-metrics article { padding:12px; }.metric-top { font-size:11px; }.metric-icon { width:23px; height:23px; font-size:14px; }.overview-metrics article>strong { font-size:26px; }.attendance-strip { grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px 0; }.attendance-strip>div { padding:0 12px; font-size:11px; }.attendance-strip>div:nth-child(2) { border-right:0; }.insight-heading { flex-wrap:wrap; }.trend-panel .insight-heading { flex-wrap:nowrap; }.period-switch button { padding:5px 6px; font-size:10px; }.trend-summary { gap:16px; }.trend-summary strong { font-size:22px; }.trend-summary span { font-size:11px; }.trend-readout { font-size:10px; }.trend-readout>span:last-child { max-width:100%; }.trend-canvas svg { height:auto; max-height:none; }.axis-label { font-size:23px; }.chart-data summary span { display:none; }.booking-breakdown { gap:12px; grid-template-columns:100px minmax(0,1fr); }.booking-donut { width:100px; }.distribution-list li { gap:4px; grid-template-columns:minmax(0,1fr) auto 36px; }.category-row { grid-template-columns:59px minmax(0,1fr) 28px 34px; gap:6px; }.route-label small { display:none; }.today-trips .data-table-scroll { overflow:visible; }.today-trips table,.today-trips tbody { display:block; }.today-trips thead { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }.today-trips tbody tr { display:grid; grid-template-columns:1fr 1fr; gap:10px 16px; padding:12px 0; border-bottom:1px solid var(--line); }.today-trips tbody tr:last-child { border-bottom:0; }.today-trips tbody td { display:block; border:0; padding:0; white-space:normal; min-width:0; }.today-trips tbody td:first-child,.today-trips td[colspan] { grid-column:1/-1; }.today-trips td[data-label]::before { display:block; content:attr(data-label); color:var(--muted); font-size:10px; margin-bottom:4px; }.today-trips td a { overflow-wrap:anywhere; } }
</style>
