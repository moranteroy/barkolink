<template>
  <IonPage class="port-display-page">
    <IonContent :fullscreen="true">
      <main ref="screen" class="port-screen">
        <header class="display-header">
          <div><p class="display-brand">BARKOLINK · TERMINAL INFORMATION</p><h1>{{ selectedPort?.name || 'Port sailing board' }}</h1><p>{{ dateLabel }} · Philippine time</p></div>
          <div class="display-clock"><strong>{{ clockLabel }}</strong><button type="button" @click="settingsOpen = !settingsOpen">{{ settingsOpen ? 'Hide controls' : 'Display controls' }}</button></div>
        </header>
        <section v-if="settingsOpen" class="display-controls" aria-label="Display settings">
          <label for="display-port">Port</label><select id="display-port" :value="data?.portId || ''" :disabled="loading || !data?.ports.length" @change="changePort"><option v-if="!data?.ports.length" value="">No ports available</option><option v-for="port in data?.ports" :key="port.id" :value="port.id">{{ port.name }}</option></select>
          <button type="button" @click="copyLink">Copy TV link</button><button type="button" @click="fullscreen">Fullscreen</button><button type="button" :disabled="loading" @click="refresh">Refresh</button>
          <span role="status">{{ controlNotice || 'Open the TV link in the terminal screen browser.' }}</span>
        </section>
        <p v-if="error" class="display-error" role="alert">{{ error }} {{ data ? 'Showing the last received schedule. Confirm updates with terminal staff.' : '' }}</p>
        <p v-else-if="loading && !data" class="display-message" role="status">Connecting to the sailing board…</p>
        <p v-else-if="!data?.portId" class="display-message">No active port is available.</p>
        <div class="display-boards">
          <section v-for="board in boards" :key="board.direction" class="display-board" :class="board.direction">
            <div class="board-heading"><h2><span class="direction-arrow" aria-hidden="true">{{ board.direction === 'departures' ? '↗' : '↙' }}</span>{{ board.direction === 'departures' ? 'Departures' : 'Arrivals' }}</h2><div class="board-count"><span>{{ board.total }} {{ board.total === 1 ? 'sailing' : 'sailings' }}</span><small v-if="board.pages > 1">Page {{ board.page + 1 }} / {{ board.pages }}</small></div></div>
            <div class="board-columns" aria-hidden="true"><span>Scheduled</span><span>{{ board.direction === 'departures' ? 'Destination / Vessel' : 'Origin / Vessel' }}</span><span>Status</span></div>
            <ol class="sailing-rows">
              <li v-for="sailing in board.rows" :key="sailing.code">
                <time :datetime="board.direction === 'departures' ? sailing.departureAt : sailing.arrivalAt">{{ timeLabel(board.direction === 'departures' ? sailing.departureAt : sailing.arrivalAt) }}</time>
                <div class="sailing-details"><strong>{{ board.direction === 'departures' ? sailing.destination.city : sailing.origin.city }}</strong><span>{{ sailing.operator ? `${sailing.operator} · ` : '' }}{{ sailing.vessel.name }}</span><small>{{ sailing.code }}</small></div>
                <span class="sailing-status" :class="sailing.status.toLowerCase()">{{ statusLabel(sailing.status) }}</span>
              </li>
            </ol>
            <p v-if="!board.rows.length" class="empty-board">{{ data?.date && data.date !== today ? 'Waiting for today’s schedule update.' : loading ? 'Loading schedules…' : `No ${board.direction} listed for today.` }}</p>
          </section>
        </div>
        <aside class="display-advisory" :class="{ urgent: advisory?.priority === 'HIGH' }" aria-label="Port advisories">
          <p>{{ advisory ? 'PORT ADVISORY' : 'PASSENGER REMINDER' }}</p><h2>{{ advisory?.title || 'Check your sailing before boarding' }}</h2>
          <div>{{ advisory?.message || 'Keep your ticket ready and follow instructions from terminal and vessel staff. Schedules may change; check this board for updates.' }}</div>
        </aside>
        <footer><span :class="{ stale: isStale }">{{ isStale ? 'Updates delayed' : data ? 'Auto refresh · every 30 seconds' : 'Connecting' }}<template v-if="data"> · Last received {{ timeLabel(data.updatedAt) }}</template></span><span>Scheduled times · Status provided by port operations</span></footer>
      </main>
    </IonContent>
  </IonPage>
</template>

<script setup lang="ts">
import { IonContent, IonPage, onIonViewDidEnter, onIonViewWillLeave } from '@ionic/vue';
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { displaySailings, loadPortDisplay, manilaDate, type PortDisplayData } from '../../services/portDisplay';

const route = useRoute(), router = useRouter();
const screen = ref<HTMLElement | null>(null), data = ref<PortDisplayData | null>(null);
const now = ref(new Date()), error = ref(''), loading = ref(false), controlNotice = ref('');
const settingsOpen = ref(false), rotation = ref(0), rowCount = ref(4);
let active = false, requestVersion = 0, controller: AbortController | undefined;
let sizeObserver: ResizeObserver | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined, refreshTimer: ReturnType<typeof setInterval> | undefined, rotationTimer: ReturnType<typeof setInterval> | undefined;
const portQuery = computed(() => typeof route.query.port === 'string' ? route.query.port : null);
const today = computed(() => manilaDate(now.value));
const selectedPort = computed(() => data.value?.ports.find(p => p.id === data.value?.portId));
const clockLabel = computed(() => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now.value));
const dateLabel = computed(() => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now.value));
const isStale = computed(() => Boolean(error.value || (data.value && (data.value.date !== today.value || now.value.getTime() - Date.parse(data.value.updatedAt) > 90000))));
const boards = computed(() => (['departures', 'arrivals'] as const).map(direction => {
  const rows = displaySailings(data.value, direction, today.value);
  const pages = Math.max(1, Math.ceil(rows.length / rowCount.value)), page = rotation.value % pages;
  return { direction, page, pages, total: rows.length, rows: rows.slice(page * rowCount.value, (page + 1) * rowCount.value) };
}));
const advisory = computed(() => {
  const notices = data.value?.advisories.filter(a => Date.parse(a.endsAt) > now.value.getTime()) || [];
  return notices[rotation.value % notices.length];
});
function timeLabel(value: string) {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
function statusLabel(value: string) {
  return ({ SCHEDULED: 'Scheduled', BOARDING: 'Boarding', DELAYED: 'Delayed', CANCELLED: 'Cancelled', COMPLETED: 'Completed' } as Record<string, string>)[value] || value;
}
async function refresh() {
  const version = ++requestVersion;
  controller?.abort();
  controller = new AbortController();
  const pending = controller;
  const timeout = setTimeout(() => pending.abort(), 15000);
  loading.value = true;
  try {
    const result = await loadPortDisplay(portQuery.value, pending.signal);
    if (version !== requestVersion || !active) return;
    data.value = result;
    error.value = '';
    if (!portQuery.value && result.portId) {
      await router.replace({ path: '/port-display', query: { ...route.query, port: result.portId } });
    }
  } catch {
    if (version === requestVersion && active) error.value = 'Unable to update the board. Check the connection and the configured port display service.';
  } finally {
    clearTimeout(timeout);
    if (version === requestVersion) loading.value = false;
  }
}
function changePort(event: Event) {
  void router.replace({ path: '/port-display', query: { ...route.query, port: (event.target as HTMLSelectElement).value } });
}
async function copyLink() {
  const url = new URL(window.location.href);
  url.searchParams.set('screen', '1');
  if (data.value?.portId) url.searchParams.set('port', data.value.portId);
  try { await navigator.clipboard.writeText(url.toString()); controlNotice.value = 'TV link copied.'; }
  catch { controlNotice.value = `Copy this TV link: ${url.toString()}`; }
}
async function fullscreen() {
  try {
    if (!document.fullscreenElement) await screen.value?.requestFullscreen();
    else await document.exitFullscreen();
    settingsOpen.value = false;
  } catch { controlNotice.value = 'Use the browser fullscreen command if this device does not support fullscreen.'; }
}
function resize() {
  if (window.innerWidth <= 800) { rowCount.value = 4; return; }
  const board = screen.value?.querySelector('.display-board');
  if (!board) return;
  const heading = board.querySelector('.board-heading')?.getBoundingClientRect().height || 0;
  const columns = board.querySelector('.board-columns')?.getBoundingClientRect().height || 0;
  const rowHeight = parseFloat(getComputedStyle(screen.value!).getPropertyValue('--sailing-row-height')) || 88;
  rowCount.value = Math.max(1, Math.min(6, Math.floor((board.clientHeight - heading - columns) / rowHeight)));
}
function resume() { if (active && document.visibilityState === 'visible') { now.value = new Date(); void refresh(); } }
function start() {
  if (active) return;
  active = true;
  resize(); void refresh();
  void nextTick(() => {
    if (!active) return;
    sizeObserver = new ResizeObserver(resize);
    const board = screen.value?.querySelector('.display-board');
    if (board) sizeObserver.observe(board);
  });
  clockTimer = setInterval(() => { now.value = new Date(); }, 1000);
  refreshTimer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30000);
  rotationTimer = setInterval(() => { rotation.value++; }, 12000);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', resume);
}
function stop() {
  active = false; requestVersion++; controller?.abort(); loading.value = false;
  sizeObserver?.disconnect();
  clearInterval(clockTimer); clearInterval(refreshTimer); clearInterval(rotationTimer);
  window.removeEventListener('resize', resize);
  document.removeEventListener('visibilitychange', resume);
}
watch(portQuery, () => { data.value = null; error.value = ''; rotation.value = 0; if (active) void refresh(); });
watch(today, () => { if (active) { rotation.value = 0; void refresh(); } });
onIonViewDidEnter(start);
onIonViewWillLeave(stop);
onUnmounted(stop);
</script>

<style scoped>
.port-display-page ion-content{--background:#071626;--color:#f4f8ff;color-scheme:dark}
.port-screen{--sailing-row-height:88px;position:relative;height:100vh;min-height:100vh;box-sizing:border-box;padding:clamp(20px,2vw,38px);background:radial-gradient(ellipse at top right,#112d45 0%,#071626 65%);color:#f4f8ff;display:flex;flex-direction:column;gap:18px;font-family:Arial,sans-serif}
.port-screen:fullscreen{overflow:auto}
.display-header{display:flex;align-items:center;justify-content:space-between;gap:24px;border-bottom:2px solid #294158;padding-bottom:18px}
.display-header p{margin:0;color:#b6cadd;font-size:clamp(14px,1.15vw,22px)}
.display-header .display-brand{font-size:clamp(12px,1vw,18px);font-weight:700;letter-spacing:.14em;color:#58d6db}
.display-header h1{margin:6px 0;font-size:clamp(28px,3vw,58px);font-weight:800;line-height:1.1}
.display-clock{text-align:right;flex-shrink:0}.display-clock strong{display:block;font-size:clamp(22px,2.8vw,52px);font-variant-numeric:tabular-nums}
.port-screen button,.port-screen select{border:1px solid #496378;background:#142c40;color:#fff;border-radius:8px;padding:9px 12px;font-size:14px}.port-screen button{cursor:pointer}.port-screen button:disabled{opacity:.5;cursor:wait}.port-screen button:focus-visible,.port-screen select:focus-visible{outline:3px solid #58d6db;outline-offset:3px}
.display-clock button{margin-top:8px;font-size:12px}.display-controls{position:absolute;z-index:10;right:clamp(20px,2vw,38px);top:140px;max-width:min(620px,calc(100% - 40px));display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:20px;border:1px solid #496378;border-radius:14px;background:#10263b;box-shadow:0 16px 48px #0009}.display-controls label{display:flex;gap:8px;align-items:center}.display-controls span{flex-basis:100%;font-size:13px;color:#b6cadd;overflow-wrap:anywhere}
.display-error{margin:0;background:#643616;border:1px solid #e7a452;padding:12px 16px;color:#fff0d7;font-size:16px}.display-message{margin:0;color:#b6cadd}
.display-boards{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;flex:1;min-height:0}
.display-header,.display-controls,.display-advisory,footer,.display-error,.display-message{flex-shrink:0}
.display-board{background:#10263b;border:1px solid #294158;border-radius:16px;overflow:hidden;min-width:0;min-height:0}
.board-heading{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#087880;gap:12px}.arrivals .board-heading{background:#25588f}.board-heading h2{display:flex;align-items:center;gap:12px;margin:0;font-size:clamp(22px,2vw,38px);font-weight:800}.direction-arrow{display:grid;place-items:center;width:32px;height:32px;border-radius:8px;background:#ffffff18;font-size:24px}.board-count{text-align:right;font-size:13px;white-space:nowrap;color:#e4f2fc}.board-count small{display:block;margin-top:4px;font-size:12px;color:#cce5f3}
.board-columns,.sailing-rows li{display:grid;grid-template-columns:1.05fr 2fr 1.1fr;gap:12px;align-items:center;padding:12px 20px}.board-columns{background:#183449;color:#b6cadd;font-size:clamp(12px,1vw,18px);font-weight:700}.sailing-rows{margin:0;padding:0;list-style:none}.sailing-rows li{border-bottom:1px solid #294158;height:var(--sailing-row-height);box-sizing:border-box;padding-top:8px;padding-bottom:8px;overflow:hidden}.sailing-rows li:nth-child(even){background:#ffffff03}.sailing-rows li:last-child{border-bottom:0}
.sailing-rows time{font-size:clamp(19px,1.7vw,33px);font-weight:800;font-variant-numeric:tabular-nums}.sailing-details{min-width:0;overflow-wrap:anywhere}.sailing-details strong{display:block;font-size:clamp(21px,1.8vw,36px);line-height:1.1}.sailing-details span{display:block;font-size:clamp(13px,1.05vw,20px);line-height:1.3;color:#c4d7e6;margin:5px 0}.sailing-details small{color:#a7bed1;font-size:12px}
.sailing-status{text-align:center;font-size:clamp(13px,1.1vw,21px);font-weight:800;padding:10px 4px;border-radius:8px;background:#244960;color:#d7eeff;overflow-wrap:anywhere}.sailing-status.boarding{background:#136844;color:#edfff4}.sailing-status.delayed{background:#774b12;color:#fff4cb}.sailing-status.cancelled{background:#8a2537;color:#fff}.sailing-status.completed{background:#344552;color:#d0dce4}.empty-board{padding:45px 24px;text-align:center;color:#b6cadd;font-size:24px}
.display-advisory{padding:16px 22px;background:#142f42;border-left:6px solid #58d6db;border-radius:8px}.display-advisory.urgent{background:#542330;border-color:#ff8c9b}.display-advisory p{margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:.12em;color:#b6cadd}.display-advisory h2{margin:0 0 7px;font-size:clamp(20px,1.6vw,30px);font-weight:800}.display-advisory div{font-size:clamp(15px,1.15vw,22px);line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere}
footer{display:flex;justify-content:space-between;gap:16px;color:#b6cadd;font-size:clamp(12px,.9vw,17px)}footer .stale{color:#ffcf85}
@media(min-width:1600px){.port-screen{--sailing-row-height:108px}.sailing-details strong{font-size:30px}.sailing-details span{font-size:18px;margin:3px 0}}
@media(min-width:801px) and (max-height:700px){
  .port-screen{--sailing-row-height:72px;padding:20px 26px;gap:14px}
  .display-header{padding-bottom:12px}.display-header h1{font-size:32px}.display-header p{font-size:13px}.display-header .display-brand{font-size:11px}.display-clock strong{font-size:32px}.display-clock button{margin-top:5px;padding:6px 10px;font-size:11px}
  .display-controls{top:110px}.board-heading{padding:10px 16px}.board-heading h2{font-size:22px}.direction-arrow{width:28px;height:28px;font-size:22px}.board-columns{padding:9px 16px;font-size:11px}.sailing-rows li{padding:6px 16px}.sailing-rows time{font-size:22px}.sailing-details strong{font-size:22px}.sailing-details span{font-size:12px;margin:3px 0}.sailing-details small{font-size:10px}.sailing-status{font-size:12px;padding:8px 4px}
  .display-advisory{padding:12px 18px}.display-advisory p{font-size:10px;margin-bottom:4px}.display-advisory h2{font-size:18px;margin-bottom:5px}.display-advisory div{font-size:13px}footer{font-size:11px}
}
@media(max-width:800px){.display-boards{grid-template-columns:1fr;flex:none}.display-header{align-items:flex-start}.display-clock strong{font-size:20px}.display-header h1{font-size:28px}.board-columns,.sailing-rows li{padding:12px;gap:8px}.sailing-rows time{font-size:18px}.sailing-details strong{font-size:22px}.sailing-status{font-size:13px}footer{flex-direction:column}.port-screen{gap:16px;height:auto}}
</style>
