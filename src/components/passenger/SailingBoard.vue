<template>
  <section class="sailing-board" aria-labelledby="sailing-board-heading">
    <header><h2 id="sailing-board-heading"><IonIcon :icon="boatOutline" aria-hidden="true" /> Departures & arrivals</h2><button :disabled="loading" @click="load">{{ loading ? 'Updating…' : 'Refresh' }}</button></header>
    <p class="board-date">Today · {{ todayLabel }} · Philippine time</p>
    <label class="port-label">Port<select v-model="selectedPort"><option v-for="port in ports" :key="port.id" :value="port.id">{{ port.name }}</option></select></label>
    <div class="board-tabs" role="group" aria-label="Sailing direction"><button v-for="item in directions" :key="item" :aria-pressed="direction === item" @click="direction = item; expanded = false">{{ item }} <span>{{ entries(item).length }}</span></button></div>
    <p v-if="error" class="board-message" role="alert">{{ error }}</p>
    <p v-if="loading && !data" class="board-message" role="status">Loading today's sailings…</p>
    <p v-else-if="!error && !visibleRows.length" class="board-message">No {{ direction.toLowerCase() }} scheduled at this port today.</p>
    <div v-if="visibleRows.length" class="board-list">
      <article v-for="trip in visibleRows" :key="trip.code">
        <div class="row-heading"><strong>{{ clock(direction === 'Departures' ? trip.departureAt : trip.arrivalAt) }}</strong><span class="status" :class="trip.status.toLowerCase()">{{ statusLabel(trip.status) }}</span></div>
        <p class="board-route"><span>{{ direction === 'Departures' ? 'To' : 'From' }}</span> {{ direction === 'Departures' ? trip.destination.name : trip.origin.name }}</p>
        <p class="vessel">{{ trip.vessel.name }} · {{ trip.code }}</p>
        <dl><div><dt>Departure</dt><dd>{{ clock(trip.departureAt) }} <small v-if="dayKey(trip.departureAt) !== data?.date">{{ shortDate(trip.departureAt) }}</small></dd></div><div><dt>Arrival</dt><dd>{{ clock(trip.arrivalAt) }} <small v-if="dayKey(trip.arrivalAt) !== data?.date">{{ shortDate(trip.arrivalAt) }}</small></dd></div></dl>
      </article>
    </div>
    <button v-if="rows.length > 4" class="show-more" @click="expanded = !expanded">{{ expanded ? 'Show fewer' : `Show all ${rows.length} ${direction.toLowerCase()}` }}</button>
    <footer><span v-if="data">Updated {{ clock(data.updatedAt) }} · Refreshes every 30 seconds</span><p>Times are scheduled. Status updates come from the ferry operator.</p></footer>
  </section>
</template>
<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { boatOutline } from 'ionicons/icons';
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
    if (!ports.value.some(port => port.id === selectedPort.value)) selectedPort.value = props.initialPortId || ports.value[0]?.id || '';
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
.sailing-board { margin-top: 24px; padding: 18px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); color: var(--ink); }
header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 14px; } h2 ion-icon { color: var(--ocean); font-size: 18px; }
button { border: 0; background: transparent; color: var(--ocean); font-size: 11px; cursor: pointer; min-height: 44px; } button:disabled { opacity: .6; }
.board-date { margin: 0 0 16px; color: var(--muted); font-size: 10px; }
.port-label { display: grid; gap: 6px; color: var(--muted); font-size: 10px; }
select { width: 100%; min-height: 44px; padding: 0 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); color: var(--ink); font-size: 12px; }
.board-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 14px 0; padding: 4px; border-radius: 10px; background: var(--surface-soft); }
.board-tabs button { border-radius: 7px; color: var(--muted); font-weight: 600; }
.board-tabs button[aria-pressed="true"] { color: #fff; background: var(--action); }
.board-tabs span { margin-left: 5px; opacity: .8; }
.board-list { display: grid; gap: 10px; } article { padding: 14px; border: 1px solid var(--line); border-radius: 11px; min-width: 0; }
.row-heading { display: flex; justify-content: space-between; align-items: center; gap: 10px; } .row-heading strong { font-size: 18px; }
.status { border-radius: 6px; padding: 5px 8px; color: var(--ocean); background: var(--light-blue); font-size: 10px; }
.status.cancelled { color: var(--danger); background: var(--surface-soft); } .status.delayed { color: #92620c; background: #fff0cd; }
.board-route { margin: 10px 0 5px; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; } .board-route span { color: var(--muted); font-size: 11px; font-weight: 400; }
.vessel { margin: 0; color: var(--muted); font-size: 10px; line-height: 1.6; overflow-wrap: anywhere; }
dl { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0 0; padding-top: 10px; border-top: 1px solid var(--line); } dt { color: var(--muted); font-size: 10px; } dd { margin: 4px 0 0; font-size: 12px; font-weight: 600; } dd small { display: block; margin-top: 3px; font-size: 9px; color: var(--muted); }
.board-message { font-size: 12px; line-height: 1.7; color: var(--muted); } .show-more { width: 100%; margin-top: 8px; }
footer { margin-top: 14px; color: var(--muted); font-size: 9px; line-height: 1.6; } footer p { margin: 4px 0 0; }
button:focus-visible, select:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
@container passenger (max-width: 380px) { .sailing-board { padding: 14px 12px; } }
</style>
