<template>
  <section class="sailing-board" aria-labelledby="sailing-board-heading">
    <header>
      <div class="board-heading"><span class="board-icon"><Ship :size="21" aria-hidden="true" /></span><div><h2 id="sailing-board-heading">Departures &amp; arrivals</h2><p class="board-date">Today · {{ todayLabel }} · Philippine time</p></div></div>
      <button class="refresh-button" :disabled="loading" @click="load"><RefreshCw :size="14" :class="{ spinning: loading }" aria-hidden="true" /><span>{{ loading ? 'Updating…' : 'Refresh' }}</span></button>
    </header>
    <label class="port-label"><span>View a port's schedule</span><span class="port-control"><MapPin :size="18" aria-hidden="true" /><select v-model="selectedPort" :disabled="!ports.length" aria-label="Schedule port"><option v-if="!ports.length" value="">{{ loading ? 'Loading ports…' : 'No ports available' }}</option><option v-for="port in ports" :key="port.id" :value="port.id">{{ port.name }}</option></select></span></label>
    <div class="board-tabs" role="group" aria-label="Sailing direction">
      <button v-for="item in directions" :key="item" :aria-pressed="direction === item" @click="direction = item; expanded = false"><component :is="item === 'Departures' ? ArrowUpRight : ArrowDownLeft" :size="15" aria-hidden="true" />{{ item }}<span>{{ entries(item).length }}</span></button>
    </div>
    <p v-if="error" class="board-message error" role="alert">{{ error }}</p>
    <p v-if="loading && !data" class="board-message" role="status">Loading today's sailings…</p>
    <div v-else-if="!error && !visibleRows.length" class="board-empty"><Ship :size="25" aria-hidden="true" /><strong>No {{ direction.toLowerCase() }} today</strong><p>No scheduled {{ direction.toLowerCase() }} at this port. Try another port or check upcoming trips.</p></div>
    <div v-if="visibleRows.length" class="board-list">
      <article v-for="trip in visibleRows" :key="trip.code">
        <div class="row-heading"><div><span class="time-caption">{{ direction === 'Departures' ? 'Departs at' : 'Arrives at' }}</span><strong>{{ clock(direction === 'Departures' ? trip.departureAt : trip.arrivalAt) }}</strong></div><span class="status" :class="trip.status.toLowerCase()"><span aria-hidden="true"></span>{{ statusLabel(trip.status) }}</span></div>
        <p class="board-route"><component :is="direction === 'Departures' ? ArrowUpRight : ArrowDownLeft" :size="16" aria-hidden="true" /><span>{{ direction === 'Departures' ? 'To' : 'From' }}</span>{{ direction === 'Departures' ? trip.destination.name : trip.origin.name }}</p>
        <p class="vessel"><Ship :size="12" aria-hidden="true" />{{ trip.vessel.name }}<span>· {{ trip.code }}</span></p>
        <dl><div><dt><span class="timeline-dot"></span>Departure</dt><dd>{{ clock(trip.departureAt) }}<small v-if="dayKey(trip.departureAt) !== data?.date">{{ shortDate(trip.departureAt) }}</small></dd></div><div><dt><span class="timeline-dot arrival-dot"></span>Arrival</dt><dd>{{ clock(trip.arrivalAt) }}<small v-if="dayKey(trip.arrivalAt) !== data?.date">{{ shortDate(trip.arrivalAt) }}</small></dd></div></dl>
      </article>
    </div>
    <button v-if="rows.length > 4" class="show-more" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? 'Show fewer' : `Show all ${rows.length} ${direction.toLowerCase()}` }}<ChevronDown :size="14" :class="{ flipped: expanded }" aria-hidden="true" /></button>
    <footer><span v-if="data" class="updated"><Clock3 :size="11" aria-hidden="true" />Updated {{ clock(data.updatedAt) }} · Refreshes every 30 seconds</span><p>Scheduled times · Check operator updates before travelling.</p></footer>
  </section>
</template>
<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { Ship, MapPin, RefreshCw, ArrowUpRight, ArrowDownLeft, ChevronDown, Clock3 } from '@lucide/vue';
import { browseActivePorts } from '../../services/database/passenger';
import { database } from '../../services/session';
import { passengerSailingBoard, type SailingBoardData } from '../../services/sailingBoard';
import { philippineDateKey } from '../../data/travelDate';
const props = withDefaults(defineProps<{ initialPortId: string; active?: boolean }>(), { active: true });
const ports = ref<{ id: string; name: string }[]>([]), selectedPort = ref('');
const directions = ['Departures', 'Arrivals'] as const;
type Direction = typeof directions[number];
const direction = ref<Direction>('Departures'), expanded = ref(false);
const data = ref<SailingBoardData | null>(null), loading = ref(false), error = ref('');
const today = ref(philippineDateKey());
const todayLabel = computed(() => new Date(`${today.value}T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' }));
const dayKey = (at: string) => philippineDateKey(new Date(at));
const clock = (at: string) => new Date(at).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true });
const shortDate = (at: string) => new Date(at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });
const statusLabel = (status: string) => status.toLowerCase().replaceAll('_', ' ').replace(/^./, s => s.toUpperCase());
function entries(mode: Direction) {
  return (data.value?.sailings || []).filter(trip => mode === 'Departures'
    ? trip.origin.id === selectedPort.value && dayKey(trip.departureAt) === today.value
    : trip.destination.id === selectedPort.value && dayKey(trip.arrivalAt) === today.value)
    .sort((a, b) => Date.parse(mode === 'Departures' ? a.departureAt : a.arrivalAt) - Date.parse(mode === 'Departures' ? b.departureAt : b.arrivalAt));
}
const rows = computed(() => entries(direction.value));
const visibleRows = computed(() => expanded.value ? rows.value : rows.value.slice(0, 4));
watch(() => props.initialPortId, id => { if (id) { selectedPort.value = id; expanded.value = false; } });
watch(selectedPort, () => { expanded.value = false; });
async function load() {
  if (loading.value) return;
  loading.value = true; error.value = '';
  today.value = philippineDateKey();
  try {
    if (!database) throw new Error('Database unavailable.');
    const [result, portResult] = await Promise.all([passengerSailingBoard(database), ports.value.length ? Promise.resolve(null) : browseActivePorts(database)]);
    data.value = result.data;
    if (portResult) ports.value = portResult.data.ports;
    if (!ports.value.some(port => port.id === selectedPort.value)) selectedPort.value = ports.value.find(port => port.id === props.initialPortId)?.id || ports.value[0]?.id || '';
  } catch { error.value = data.value ? 'Update delayed. Showing the last loaded schedule.' : 'Could not load today’s sailings. Tap Refresh to try again.'; }
  finally { loading.value = false; }
}
let timer: ReturnType<typeof setInterval> | undefined;
function stop() { if (timer) clearInterval(timer); timer = undefined; }
watch(() => props.active, active => {
  stop();
  if (active) { void load(); timer = setInterval(() => { if (!document.hidden) void load(); }, 30000); }
}, { immediate: true });
onUnmounted(stop);
</script>
<style scoped>
.sailing-board { margin-top:24px; padding:18px; border:1px solid var(--line); border-radius:18px; background:var(--surface); color:var(--ink); }
header { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:16px; }
.board-heading { display:flex; align-items:center; gap:10px; min-width:0; }.board-heading > div { min-width:0; }
.board-icon { display:grid; place-items:center; width:40px; height:40px; flex-shrink:0; background:var(--light-blue); color:var(--ocean); border-radius:12px; }
h2 { margin:0; font-size:14px; line-height:1.5; }.board-date { margin:3px 0 0; color:var(--muted); font-size:10px; line-height:1.6; }
button { display:flex; align-items:center; justify-content:center; gap:6px; border:0; background:transparent; color:var(--ocean); font:inherit; font-size:11px; cursor:pointer; min-height:44px; }button:disabled { opacity:.6; cursor:default; }
.refresh-button { flex-shrink:0; padding:0 9px; border:1px solid var(--line); border-radius:10px; background:var(--surface-soft); }
.port-label { display:grid; gap:7px; color:var(--muted); font-size:10px; }.port-control { position:relative; display:block; }.port-control > svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--ocean); pointer-events:none; z-index:1; }
.sailing-board .port-label .port-control select { width:100%; min-height:50px; padding-left:39px; border-radius:12px; }
.board-tabs { display:grid; grid-template-columns:1fr 1fr; gap:5px; margin:14px 0; padding:5px; border:1px solid var(--line); border-radius:12px; background:var(--surface-soft); }
.board-tabs button { border-radius:8px; color:var(--muted); font-weight:650; gap:6px; font-size:11px; }.board-tabs button[aria-pressed="true"] { color:#fff; background:var(--action); box-shadow:0 2px 6px #102b4c10; }
.board-tabs span { display:grid; place-items:center; min-width:19px; height:19px; padding:0 4px; border-radius:6px; background:color-mix(in srgb,var(--muted) 10%,transparent); font-size:10px; }.board-tabs button[aria-pressed="true"] span { background:#ffffff25; }
.board-list { display:grid; gap:10px; }article { padding:15px; border:1px solid var(--line); border-radius:13px; background:var(--surface-soft); min-width:0; }
.row-heading { display:flex; justify-content:space-between; align-items:center; gap:8px; }.row-heading > div { display:grid; gap:4px; }.time-caption { color:var(--muted); font-size:9px; }.row-heading strong { font-size:21px; line-height:1.2; letter-spacing:-.4px; }
.status { display:flex; align-items:center; gap:5px; border-radius:7px; padding:6px 8px; color:var(--ocean); background:var(--light-blue); font-size:10px; line-height:1.4; }.status > span { width:5px; height:5px; flex-shrink:0; border-radius:50%; background:currentColor; }
.status.cancelled { color:var(--danger); background:color-mix(in srgb,var(--danger) 10%,var(--surface)); }.status.delayed { color:#9c6d15; background:color-mix(in srgb,#c88e24 14%,var(--surface)); }.status.boarding,.status.arrived,.status.completed { color:#299e91; background:color-mix(in srgb,#299e91 12%,var(--surface)); }
.board-route { display:flex; align-items:center; flex-wrap:wrap; gap:5px; margin:12px 0 6px; font-size:13px; font-weight:650; overflow-wrap:anywhere; }.board-route svg { color:var(--ocean); flex-shrink:0; }.board-route > span { color:var(--muted); font-size:11px; font-weight:400; }
.vessel { display:flex; align-items:center; flex-wrap:wrap; gap:5px; margin:0; color:var(--muted); font-size:10px; line-height:1.6; overflow-wrap:anywhere; }.vessel svg { flex-shrink:0; }
dl { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:14px 0 0; padding-top:12px; border-top:1px solid var(--line); }dt { display:flex; align-items:center; gap:5px; color:var(--muted); font-size:10px; }.timeline-dot { width:5px; height:5px; background:var(--ocean); border-radius:50%; }.arrival-dot { background:#299e91; }dd { margin:5px 0 0; font-size:12px; font-weight:650; }dd small { display:block; margin-top:3px; font-size:9px; color:var(--muted); }
.board-message { padding:10px; font-size:12px; line-height:1.7; color:var(--muted); }.board-message.error { color:var(--danger); }
.board-empty { display:grid; justify-items:center; text-align:center; padding:20px 14px; border:1px dashed var(--line); border-radius:12px; background:var(--surface-soft); }.board-empty svg { color:var(--ocean); margin-bottom:10px; }.board-empty strong { font-size:12px; }.board-empty p { max-width:270px; margin:6px 0 0; font-size:11px; line-height:1.7; color:var(--muted); }
.show-more { width:100%; margin-top:10px; border:1px solid var(--line); border-radius:9px; }.flipped { transform:rotate(180deg); }
footer { margin-top:14px; color:var(--muted); font-size:9px; line-height:1.7; }.updated { display:flex; align-items:center; gap:5px; }footer p { margin:4px 0 0; }
button:focus-visible { outline:2px solid var(--ocean); outline-offset:3px; }
.spinning { animation:board-refresh 1s linear infinite; }@keyframes board-refresh { to { transform:rotate(360deg); } }
@container passenger (max-width:380px) { .sailing-board { padding:14px 12px; }.board-icon { display:none; }.board-tabs button { gap:4px; } }
@media(prefers-reduced-motion:reduce) { .spinning { animation:none; } }
</style>
