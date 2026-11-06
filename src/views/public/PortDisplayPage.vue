<template>
  <IonPage class="port-display-page">
    <IonContent :fullscreen="true">
      <main
        ref="screen"
        class="port-screen"
        :class="{ 'is-kiosk': kiosk }"
        :data-weather="headerWeather?.scene || 'neutral'"
        :data-phase="atmosphere?.phase || 'unknown'"
        :style="atmosphere?.style"
      >
        <header class="display-header">
          <MaritimeHeaderArt
            immersive
            :night="!atmosphere?.isDay"
            :weather="headerWeather?.scene"
            :daylight="atmosphere?.isDay"
            :phase="atmosphere?.phase"
          />
          <div
            v-if="headerWeather"
            class="header-weather-target"
            tabindex="0"
            role="img"
            aria-label="Port weather"
            aria-describedby="header-weather-tooltip"
          >
            <span id="header-weather-tooltip" class="header-weather-tooltip" role="tooltip"
              >{{ headerCondition }} &middot; {{ selectedPort?.name }} &middot;
              {{ atmosphere ? harborPhaseLabel[atmosphere.phase] : '' }} &middot; Updated
              {{ timeLabel(headerWeather.currentAt) }} PH</span
            >
          </div>
          <div class="display-identity">
            <img src="/images/brand/barkolink-mark.svg" alt="BarkoLink" width="44" height="44" />
            <div>
              <p class="display-brand">TERMINAL SAILING BOARD</p>
              <h1>{{ selectedPort?.name || 'Port sailing board' }}</h1>
              <p>{{ dateLabel }} · Philippine time</p>
            </div>
          </div>
          <div class="display-clock">
            <strong>{{ clockLabel }}</strong>
            <div class="clock-meta">
              <span
                class="connection-state"
                :class="{ stale: isStale, connecting: !data }"
                role="status"
                ><i aria-hidden="true"></i
                >{{ isStale ? 'Updates delayed' : data ? 'Live updates' : 'Connecting' }}</span
              ><button
                v-if="!kiosk || settingsOpen"
                type="button"
                @click="settingsOpen = !settingsOpen"
              >
                {{ settingsOpen ? 'Hide controls' : 'Display controls' }}
              </button>
            </div>
          </div>
        </header>
        <section v-if="settingsOpen" class="display-controls" aria-label="Display settings">
          <label for="display-port">Port</label
          ><select
            id="display-port"
            :value="data?.portId || ''"
            :disabled="loading || !data?.ports.length"
            @change="changePort"
          >
            <option v-if="!data?.ports.length" value="">No ports available</option>
            <option v-for="port in data?.ports" :key="port.id" :value="port.id">
              {{ port.name }}
            </option>
          </select>
          <button type="button" @click="copyLink">Copy TV link</button
          ><button type="button" @click="fullscreen">Fullscreen</button
          ><button type="button" :disabled="loading" @click="refresh">Refresh</button
          ><button type="button" @click="enterKiosk">TV mode</button>
          <span role="status">{{
            controlNotice || 'Open the TV link in the terminal screen browser.'
          }}</span>
          <p class="header-weather-status" role="status">
            {{ weatherDateLabel }} ·
            {{
              headerWeather ? headerCondition : weatherLoading ? 'Updating…' : 'Weather unavailable'
            }}
            <WeatherSource />
          </p>
          <div class="display-responsibility">
            <strong>Who updates this board?</strong>
            <p>
              Administrator: update trip schedules, statuses, and published advisories. Boarding
              desk: confirm actual boarding conditions and report corrections to the administrator.
              Connection or screen problems: contact the system administrator.
            </p>
            <p v-if="reviewSailings.length" class="review-note">
              Schedule review needed:
              {{ reviewSailings.map((sailing) => sailing.code).join(', ') }}. The scheduled
              departure has passed; confirm operations before the administrator updates the trip.
            </p>
          </div>
        </section>
        <p v-if="error" class="display-error" role="alert">
          {{ error }}
          {{
            data
              ? 'Showing the last received schedule. Confirm your sailing at the boarding desk.'
              : ''
          }}
        </p>
        <p v-else-if="loading && !data" class="display-message" role="status">
          Connecting to the sailing board…
        </p>
        <p v-else-if="!data?.portId" class="display-message">No active port is available.</p>
        <section
          v-if="boardingSailing"
          class="boarding-banner"
          :class="{ unconfirmed: isStale }"
          aria-label="Boarding announcement"
        >
          <div class="boarding-label">
            <span>{{ isStale ? 'LAST REPORTED' : 'NOW BOARDING' }}</span
            ><strong>{{ timeLabel(boardingSailing.departureAt) }}</strong>
          </div>
          <div class="boarding-destination">
            <span class="boarding-origin"
              >{{ isStale ? 'Last reported at' : 'Boarding at' }}
              {{ boardingSailing.origin.name }}</span
            >
            <h2>{{ boardingSailing.origin.name }} → {{ boardingSailing.destination.name }}</h2>
            <p>{{ boardingSailing.vessel.name }} · {{ boardingSailing.code }}</p>
          </div>
          <div class="boarding-instruction">
            <strong>{{
              isStale || pastScheduled(boardingSailing.departureAt, boardingSailing.status)
                ? 'Check with the boarding desk'
                : 'Have your ticket ready'
            }}</strong
            ><span
              >{{
                isStale
                  ? 'Waiting for a live boarding update'
                  : pastScheduled(boardingSailing.departureAt, boardingSailing.status)
                    ? 'Scheduled departure has passed'
                    : 'Follow the terminal boarding announcement'
              }}<template v-if="boardingSailings.length > 1">
                · {{ boardingSailings.length }} boarding sailings</template
              ></span
            >
          </div>
        </section>
        <div class="display-boards">
          <section
            v-for="board in boards"
            :key="board.direction"
            class="display-board"
            :class="board.direction"
          >
            <div class="board-heading">
              <span class="direction-arrow" aria-hidden="true"><Ship /></span>
              <div class="board-heading-copy">
                <h2>{{ board.direction === 'departures' ? 'Departures' : 'Arrivals' }}</h2>
                <p>
                  {{
                    board.direction === 'departures' ? 'Upcoming trips from' : 'Incoming trips to'
                  }}
                  {{ selectedPort?.name || 'this port' }}
                </p>
              </div>
              <div class="board-count">
                <span
                  ><Ship aria-hidden="true" />{{ board.total }}
                  {{ board.total === 1 ? 'sailing' : 'sailings' }}</span
                ><small v-if="board.pages > 1">Page {{ board.page + 1 }} / {{ board.pages }}</small>
              </div>
            </div>
            <div class="board-columns" aria-hidden="true">
              <span>{{ board.direction === 'departures' ? 'Departure' : 'Arrival' }}</span
              ><span>{{
                board.direction === 'departures' ? 'Destination / Vessel' : 'Origin / Vessel'
              }}</span
              ><span>Status</span>
            </div>
            <ol class="sailing-rows">
              <li
                v-for="sailing in board.rows"
                :key="sailing.code"
                :class="{
                  'is-boarding': sailing.status === 'BOARDING',
                  'is-completed': sailing.status === 'COMPLETED',
                }"
              >
                <time
                  :datetime="
                    board.direction === 'departures' ? sailing.departureAt : sailing.arrivalAt
                  "
                  >{{
                    timeLabel(
                      board.direction === 'departures' ? sailing.departureAt : sailing.arrivalAt,
                    )
                  }}</time
                >
                <div class="sailing-details">
                  <strong>{{
                    board.direction === 'departures'
                      ? sailing.destination.city
                      : sailing.origin.city
                  }}</strong
                  ><span>{{ sailing.vessel.name }}</span
                  ><small
                    :title="`${sailing.code}${sailing.operator ? ' · ' + sailing.operator : ''}`"
                    >{{ sailing.code
                    }}<template v-if="sailing.operator"> · {{ sailing.operator }}</template></small
                  >
                </div>
                <div class="status-cell">
                  <span class="sailing-status" :class="sailing.status.toLowerCase()">{{
                    board.direction === 'arrivals' && sailing.status === 'BOARDING'
                      ? 'Boarding at origin'
                      : statusLabel(sailing.status)
                  }}</span
                  ><small
                    v-if="board.direction === 'arrivals' && sailing.status === 'BOARDING'"
                    class="status-context"
                    >{{ sailing.origin.city }}</small
                  ><small
                    v-if="
                      board.direction === 'departures' &&
                      pastScheduled(sailing.departureAt, sailing.status)
                    "
                    class="past-schedule"
                    >Check with boarding desk</small
                  >
                </div>
              </li>
            </ol>
            <div v-if="!board.rows.length" class="empty-board" role="status">
              <span class="empty-board-icon" aria-hidden="true"><Ship /></span>
              <h3>
                {{
                  data?.date && data.date !== today
                    ? 'Waiting for today’s schedule update.'
                    : loading
                      ? 'Loading schedules…'
                      : error
                        ? 'Schedules unavailable.'
                        : `No ${board.direction} listed for today.`
                }}
              </h3>
              <p v-if="!loading && !error && data?.date === today">
                Once trips are scheduled, they will appear here.
              </p>
            </div>
          </section>
        </div>
        <aside
          class="display-advisory"
          :class="{ urgent: advisory?.priority === 'HIGH' }"
          aria-label="Port advisories"
        >
          <span class="advisory-icon" aria-hidden="true"><Megaphone /></span>
          <div class="advisory-copy">
            <p>{{ advisory ? 'PORT ADVISORY' : 'PASSENGER REMINDER' }}</p>
            <h2>{{ advisory?.title || 'Check your sailing before boarding' }}</h2>
            <div>
              {{
                advisory?.message ||
                'Keep your ticket ready and follow instructions from terminal and vessel staff. Schedules may change; check this board for updates.'
              }}
            </div>
          </div>
        </aside>
      </main>
    </IonContent>
  </IonPage>
</template>

<script setup lang="ts">
import { IonContent, IonPage, onIonViewDidEnter, onIonViewWillLeave } from '@ionic/vue';
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Ship, Megaphone } from '@lucide/vue';
import { currentPortWeather, portAtmosphere, harborPhaseLabel } from '../../data/portAtmosphere';
import MaritimeHeaderArt from '@/components/shared/MaritimeHeaderArt.vue';
import WeatherSource from '@/components/shared/WeatherSource.vue';
import {
  displaySailings,
  loadPortDisplay,
  manilaDate,
  portDisplayKey,
  type PortDisplayData,
} from '../../services/portDisplay';
import { loadDisplayWeather, type DisplayWeather } from '../../services/portDisplayWeather';

const route = useRoute(),
  router = useRouter();
const screen = ref<HTMLElement | null>(null),
  data = ref<PortDisplayData | null>(null);
const now = ref(new Date()),
  error = ref(''),
  loading = ref(false),
  controlNotice = ref('');
const settingsOpen = ref(false),
  rotation = ref(0),
  rowCount = ref(4);
let active = false,
  requestVersion = 0,
  controller: AbortController | undefined;
let sizeObserver: ResizeObserver | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined,
  refreshTimer: ReturnType<typeof setInterval> | undefined,
  rotationTimer: ReturnType<typeof setInterval> | undefined;
const portQuery = computed(() => (typeof route.query.port === 'string' ? route.query.port : null));
const kiosk = computed(() => route.query.screen === '1');
const today = computed(() => manilaDate(now.value));
const selectedPort = computed(() => data.value?.ports.find((p) => p.id === data.value?.portId));
const weather = ref<DisplayWeather | null>(null),
  weatherLoading = ref(false),
  weatherError = ref(false),
  weatherReceivedAt = ref(0);
let weatherController: AbortController | undefined,
  weatherVersion = 0,
  weatherAttemptAt = 0;
const weatherKey = computed(() => `${selectedPort.value?.id || ''}:${today.value}`);
const visibleWeather = computed(() =>
  weather.value?.portId === selectedPort.value?.id && weather.value?.date === today.value
    ? weather.value
    : null,
);
const weatherDateLabel = computed(() => today.value.split('-').reverse().join('/'));
const weatherStale = computed(
  () => weatherError.value || now.value.getTime() - weatherReceivedAt.value > 15 * 60000,
);
const headerWeather = computed(() =>
  !weatherStale.value && currentPortWeather(visibleWeather.value, now.value)
    ? visibleWeather.value
    : null,
);
const atmosphere = computed(() => portAtmosphere(headerWeather.value, now.value));
const headerCondition = computed(() =>
  !atmosphere.value?.isDay && headerWeather.value?.currentCondition === 'Sunny'
    ? 'Clear sky'
    : headerWeather.value?.currentCondition,
);
async function refreshWeather() {
  const port = selectedPort.value;
  const delay = weatherError.value ? 5 * 60000 : 10 * 60000;
  if (
    !active ||
    !port ||
    weatherLoading.value ||
    (weatherAttemptAt && Date.now() - weatherAttemptAt < delay)
  )
    return;
  const version = ++weatherVersion,
    key = weatherKey.value;
  weatherController?.abort();
  const pending = new AbortController();
  weatherController = pending;
  const timeout = setTimeout(() => pending.abort(), 10000);
  weatherLoading.value = true;
  weatherAttemptAt = Date.now();
  try {
    const result = await loadDisplayWeather(port, today.value, pending.signal);
    if (!active || version !== weatherVersion || key !== weatherKey.value) return;
    if (!currentPortWeather(result, new Date())) throw new Error('Weather reading is outdated.');
    weather.value = result;
    weatherError.value = false;
    weatherReceivedAt.value = Date.now();
  } catch {
    if (active && version === weatherVersion && key === weatherKey.value) weatherError.value = true;
  } finally {
    clearTimeout(timeout);
    if (version === weatherVersion) weatherLoading.value = false;
  }
}
watch(weatherKey, () => {
  weatherVersion++;
  weatherController?.abort();
  weather.value = null;
  weatherLoading.value = false;
  weatherError.value = false;
  weatherAttemptAt = 0;
  weatherReceivedAt.value = 0;
  void refreshWeather();
});
const clockLabel = computed(() =>
  new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now.value),
);
const dateLabel = computed(() =>
  new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(now.value),
);
const isStale = computed(() =>
  Boolean(
    error.value ||
    (data.value &&
      (data.value.date !== today.value ||
        now.value.getTime() - Date.parse(data.value.updatedAt) > 90000)),
  ),
);
const boardingSailings = computed(() =>
  displaySailings(data.value, 'departures', today.value).filter((s) => s.status === 'BOARDING'),
);
const boardingSailing = computed(
  () => boardingSailings.value[rotation.value % boardingSailings.value.length],
);
function pastScheduled(departureAt: string, status: string) {
  return (
    ['SCHEDULED', 'BOARDING', 'DELAYED'].includes(status) &&
    now.value.getTime() - Date.parse(departureAt) >= 15 * 60000
  );
}
const reviewSailings = computed(() =>
  displaySailings(data.value, 'departures', today.value).filter((sailing) =>
    pastScheduled(sailing.departureAt, sailing.status),
  ),
);
const boards = computed(() =>
  (['departures', 'arrivals'] as const).map((direction) => {
    const rows = displaySailings(data.value, direction, today.value);
    const pages = Math.max(1, Math.ceil(rows.length / rowCount.value)),
      page = rotation.value % pages;
    return {
      direction,
      page,
      pages,
      total: rows.length,
      rows: rows.slice(page * rowCount.value, (page + 1) * rowCount.value),
    };
  }),
);
const advisory = computed(() => {
  const notices =
    data.value?.advisories.filter((a) => Date.parse(a.endsAt) > now.value.getTime()) || [];
  const urgent = notices.filter((a) => a.priority === 'HIGH');
  const visible = urgent.length ? urgent : notices;
  return visible[rotation.value % visible.length];
});
function timeLabel(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
function statusLabel(value: string) {
  return (
    (
      {
        SCHEDULED: 'Scheduled',
        BOARDING: 'Boarding',
        DELAYED: 'Delayed',
        CANCELLED: 'Cancelled',
        COMPLETED: 'Completed',
      } as Record<string, string>
    )[value] || value
  );
}
async function refresh() {
  const version = ++requestVersion;
  controller?.abort();
  controller = new AbortController();
  const pending = controller;
  const timeout = setTimeout(() => pending.abort(), 15000);
  loading.value = true;
  try {
    const result = await loadPortDisplay(portQuery.value, pending.signal, data.value?.ports);
    if (version !== requestVersion || !active) return;
    data.value = result;
    error.value = '';
    const port = result.ports.find((candidate) => candidate.id === result.portId);
    const key = port ? portDisplayKey(port, result.ports) : null;
    if (key && portQuery.value !== key) {
      await router.replace({ path: '/port-display', query: { ...route.query, port: key } });
    }
  } catch {
    if (version === requestVersion && active)
      error.value = 'Live sailing updates are temporarily unavailable.';
  } finally {
    clearTimeout(timeout);
    if (version === requestVersion) loading.value = false;
  }
}
function changePort(event: Event) {
  const port = data.value?.ports.find(
    (candidate) => candidate.id === (event.target as HTMLSelectElement).value,
  );
  if (port && data.value)
    void router.replace({
      path: '/port-display',
      query: { ...route.query, port: portDisplayKey(port, data.value.ports) },
    });
}
async function copyLink() {
  const url = new URL(window.location.href);
  url.searchParams.set('screen', '1');
  if (selectedPort.value && data.value)
    url.searchParams.set('port', portDisplayKey(selectedPort.value, data.value.ports));
  try {
    await navigator.clipboard.writeText(url.toString());
    controlNotice.value = 'TV link copied.';
  } catch {
    controlNotice.value = `Copy this TV link: ${url.toString()}`;
  }
}
async function fullscreen() {
  try {
    if (!document.fullscreenElement) await screen.value?.requestFullscreen();
    else await document.exitFullscreen();
    settingsOpen.value = false;
  } catch {
    controlNotice.value =
      'Use the browser fullscreen command if this device does not support fullscreen.';
  }
}
function enterKiosk() {
  settingsOpen.value = false;
  void router.replace({ query: { ...route.query, screen: '1' } });
}
function keyboardControls(event: KeyboardEvent) {
  if (event.key === 'Escape') settingsOpen.value = !settingsOpen.value;
}
function resize() {
  if (window.innerWidth <= 800) {
    rowCount.value = 4;
    return;
  }
  const board = screen.value?.querySelector('.display-board');
  if (!board) return;
  const heading = board.querySelector('.board-heading')?.getBoundingClientRect().height || 0;
  const columns = board.querySelector('.board-columns')?.getBoundingClientRect().height || 0;
  const rowHeight =
    parseFloat(getComputedStyle(screen.value!).getPropertyValue('--sailing-row-height')) || 88;
  rowCount.value = Math.max(
    1,
    Math.min(6, Math.floor((board.clientHeight - heading - columns) / rowHeight)),
  );
}
function resume() {
  if (active && document.visibilityState === 'visible') {
    now.value = new Date();
    void refresh();
    void refreshWeather();
  }
}
watch([data, weather, weatherError], () => {
  if (active) void nextTick(resize);
});
function start() {
  if (active) return;
  active = true;
  now.value = new Date();
  resize();
  void refresh();
  void refreshWeather();
  void nextTick(() => {
    if (!active) return;
    sizeObserver = new ResizeObserver(resize);
    const board = screen.value?.querySelector('.display-board');
    if (board) sizeObserver.observe(board);
  });
  clockTimer = setInterval(() => {
    now.value = new Date();
  }, 1000);
  refreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible') {
      void refresh();
      void refreshWeather();
    }
  }, 30000);
  rotationTimer = setInterval(() => {
    rotation.value++;
  }, 12000);
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', keyboardControls);
  document.addEventListener('visibilitychange', resume);
}
function stop() {
  active = false;
  requestVersion++;
  controller?.abort();
  loading.value = false;
  weatherVersion++;
  weatherController?.abort();
  weatherLoading.value = false;
  weatherAttemptAt = 0;
  sizeObserver?.disconnect();
  clearInterval(clockTimer);
  clearInterval(refreshTimer);
  clearInterval(rotationTimer);
  window.removeEventListener('resize', resize);
  window.removeEventListener('keydown', keyboardControls);
  document.removeEventListener('visibilitychange', resume);
}
watch(portQuery, (key) => {
  if (
    selectedPort.value &&
    data.value &&
    (key === selectedPort.value.id || key === portDisplayKey(selectedPort.value, data.value.ports))
  )
    return;
  data.value = null;
  error.value = '';
  rotation.value = 0;
  if (active) void refresh();
});
watch(today, () => {
  if (active) {
    rotation.value = 0;
    void refresh();
  }
});
onIonViewDidEnter(start);
onIonViewWillLeave(stop);
onUnmounted(stop);
</script>

<style scoped>
.port-display-page ion-content {
  --background: #091827;
  --color: #f0f6fc;
  color-scheme: dark;
}
.port-screen {
  --sailing-row-height: 120px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100dvh;
  min-height: 100dvh;
  padding: 24px 28px;
  box-sizing: border-box;
  background:
    radial-gradient(ellipse at 65% 0, var(--harbor-glow, #19395830), transparent 65%),
    linear-gradient(145deg, #061b31, #07182b);
  color: #f0f6fc;
  font-family: var(--ion-font-family, Arial, sans-serif);
}
.port-screen:fullscreen {
  overflow: auto;
}
.display-header {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 112px;
  padding-block: 8px 14px;
  border-bottom: 1px solid #294359;
  flex-shrink: 0;
}
.display-identity {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.display-identity img {
  flex: none;
  width: clamp(48px, 4vw, 76px);
  height: clamp(48px, 4vw, 76px);
  border-radius: 18px;
  box-shadow: 0 0 24px #008cff22;
}
.display-header p {
  margin: 0;
  color: #a8bfd1;
  font-size: clamp(13px, 1vw, 18px);
  line-height: 1.4;
}
.display-header .display-brand {
  color: #38baff;
  font-size: clamp(11px, 0.9vw, 16px);
  font-weight: 600;
  letter-spacing: 0.12em;
}
.display-header h1 {
  margin: 4px 0;
  font-size: clamp(28px, 2.6vw, 48px);
  font-weight: 650;
  letter-spacing: -0.03em;
  line-height: 1.15;
}
.display-header > :not(.maritime-header-art) {
  position: relative;
  z-index: 1;
}
.display-header .header-weather-target {
  position: absolute;
  z-index: 2;
  inset-block: 0;
  right: clamp(180px, 15vw, 300px);
  width: clamp(160px, 30vw, 460px);
  border-radius: 10px;
}
.display-header .display-clock {
  z-index: 3;
}
.header-weather-target:focus-visible {
  outline: 2px solid #80d4ff;
  outline-offset: 2px;
}
.header-weather-tooltip {
  position: absolute;
  top: 8px;
  right: 8px;
  max-width: min(300px, 75vw);
  width: max-content;
  padding: 6px 10px;
  border: 1px solid #3b566c;
  border-radius: 8px;
  background: #061b32f2;
  color: #d7edfc;
  font-size: 12px;
  line-height: 1.4;
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
}
.header-weather-target:hover .header-weather-tooltip,
.header-weather-target:focus .header-weather-tooltip {
  visibility: visible;
  opacity: 1;
}
.header-weather-status {
  flex-basis: 100%;
  margin: 0;
  color: #b8cbd9;
  font-size: 12px;
}
.display-header :deep(.maritime-header-art) {
  inset: -16px 0 0;
}
.display-header :deep(.maritime-header-art.immersive) {
  inset: -16px 0 0;
}
.display-header :deep(.maritime-header-art img) {
  right: clamp(160px, 13vw, 250px);
  width: 930px;
  bottom: -48px;
}
.board-heading-copy {
  min-width: 0;
}
.board-heading-copy p {
  margin: 5px 0 0;
  color: #b3d7e8;
  font-size: clamp(13px, 1.1vw, 20px);
  line-height: 1.4;
}
.display-clock {
  text-align: right;
  flex: none;
}
.display-clock > strong {
  display: block;
  font-size: clamp(24px, 2.3vw, 42px);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.clock-meta {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}
.connection-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #32e4bf;
  font-size: clamp(12px, 1vw, 18px);
  font-weight: 500;
}
.connection-state i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.connection-state.stale {
  color: #ffcf85;
}
.connection-state.connecting {
  color: #a8bfd1;
}
.port-screen button,
.port-screen select {
  min-height: 36px;
  padding: 8px 12px;
  border: 1px solid #3b566c;
  border-radius: 8px;
  background: #132c40;
  color: #f0f6fc;
  font: inherit;
  font-size: 13px;
}
.port-screen button {
  cursor: pointer;
}
.port-screen button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.port-screen button:focus-visible,
.port-screen select:focus-visible {
  outline: 2px solid #60d4dc;
  outline-offset: 3px;
}
.clock-meta button {
  background: #10283e80;
  color: #d7e5f3;
  font-size: clamp(12px, 0.9vw, 16px);
  padding: 8px 12px;
  min-height: 40px;
}
.display-controls {
  position: absolute;
  top: 115px;
  right: 28px;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  width: min(600px, calc(100% - 56px));
  padding: 18px;
  border: 1px solid #3b566c;
  border-radius: 12px;
  background: #10263b;
  box-shadow: 0 16px 48px #0008;
}
.display-controls label {
  font-size: 13px;
}
.display-controls select {
  min-width: 0;
  max-width: 100%;
}
.display-controls > span {
  flex-basis: 100%;
  color: #b8cbd9;
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.display-responsibility {
  flex-basis: 100%;
  padding-top: 12px;
  border-top: 1px solid #294359;
  font-size: 12px;
  line-height: 1.6;
  color: #b8cbd9;
}
.display-responsibility strong {
  color: #f0f6fc;
  font-size: 13px;
  font-weight: 600;
}
.display-responsibility p {
  margin: 6px 0 0;
}
.display-responsibility .review-note {
  color: #ffcf85;
}
.display-error,
.display-message {
  flex-shrink: 0;
  margin: 0;
  padding: 10px 14px;
  border: 1px solid #775731;
  border-radius: 8px;
  background: #33291d;
  color: #ffdfaa;
  font-size: 13px;
  line-height: 1.5;
}
.display-message {
  border-color: #294359;
  background: #10263b;
  color: #b8cbd9;
}
.boarding-banner {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(200px, 0.8fr);
  align-items: center;
  gap: 18px;
  padding: 14px 18px;
  border: 1px solid #287e67;
  border-left: 4px solid #69e4ac;
  border-radius: 12px;
  background: #103b33;
}
.boarding-label {
  padding-right: 18px;
  border-right: 1px solid #3b6959;
}
.boarding-label span {
  display: block;
  color: #9bf2c5;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
}
.boarding-label strong {
  display: block;
  margin-top: 4px;
  font-size: clamp(24px, 2vw, 38px);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.boarding-destination {
  min-width: 0;
}
.boarding-destination h2 {
  margin: 0;
  font-size: clamp(20px, 1.8vw, 32px);
  line-height: 1.2;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.boarding-destination p {
  margin: 4px 0 0;
  color: #b8dbcf;
  font-size: clamp(13px, 1vw, 18px);
}
.boarding-destination .boarding-origin {
  display: block;
  margin-bottom: 4px;
  color: #9bf2c5;
  font-size: clamp(12px, 0.95vw, 17px);
}
.boarding-instruction strong {
  display: block;
  font-size: clamp(14px, 1.1vw, 20px);
  font-weight: 600;
}
.boarding-instruction span {
  display: block;
  margin-top: 4px;
  color: #b8dbcf;
  font-size: clamp(12px, 0.95vw, 17px);
  line-height: 1.4;
}
.boarding-banner.unconfirmed {
  border-color: #a88047;
  border-left-color: #ffcf85;
  background: #33291d;
}
.unconfirmed .boarding-label span {
  color: #ffcf85;
}
.display-boards {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 18px;
  flex: 1;
  min-height: 0;
}
.display-board {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border: 1px solid #2b5270;
  border-radius: 20px;
  overflow: hidden;
  background: linear-gradient(125deg, #102b43, #0b2034);
}
.board-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  background: linear-gradient(110deg, #096b72, #07545e);
  flex-shrink: 0;
}
.arrivals .board-heading {
  background: linear-gradient(110deg, #244e86, #184577);
}
.board-heading h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: clamp(22px, 1.7vw, 32px);
  font-weight: 600;
}
.direction-arrow {
  display: grid;
  place-items: center;
  flex: none;
  width: clamp(44px, 3.6vw, 64px);
  height: clamp(44px, 3.6vw, 64px);
  border-radius: 16px;
  background: #00aaa955;
  color: #eaffff;
}
.direction-arrow svg {
  width: 55%;
  height: 55%;
}
.arrivals .direction-arrow {
  background: #3587dd45;
}
.board-count {
  margin-left: auto;
  text-align: right;
  color: #d2e6f3;
  font-size: clamp(12px, 0.85vw, 16px);
  white-space: nowrap;
}
.board-count > span {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid #20d0cd70;
  border-radius: 22px;
  color: #b8fff6;
  background: #009a9b20;
}
.board-count svg {
  width: 22px;
  height: 22px;
}
.arrivals .board-count > span {
  border-color: #4fafff70;
  color: #a4d8ff;
  background: #2798ed18;
}
.board-count small {
  display: block;
  margin-top: 3px;
  font-size: inherit;
}
.board-columns,
.sailing-rows li {
  display: grid;
  grid-template-columns: 0.85fr 1.7fr 1fr;
  gap: 12px;
  align-items: center;
  padding-inline: 16px;
}
.board-columns {
  flex-shrink: 0;
  padding-block: 14px;
  background: #163248;
  color: #98b4c9;
  font-size: clamp(11px, 0.85vw, 16px);
  font-weight: 500;
}
.sailing-rows {
  list-style: none;
  padding: 0;
  margin: 0;
}
.sailing-rows li {
  height: var(--sailing-row-height);
  box-sizing: border-box;
  padding-block: 8px;
  border-bottom: 1px solid #294359;
  overflow: hidden;
}
.sailing-rows li:last-child {
  border-bottom: 0;
}
.sailing-rows li:nth-child(even) {
  background: #ffffff02;
}
.sailing-rows li.is-boarding {
  background: #163d352e;
  box-shadow: inset 3px 0 #68dfac;
}
.arrivals .sailing-rows li.is-boarding {
  background: #1a3e542e;
  box-shadow: inset 3px 0 #78b4df;
}
.sailing-rows time {
  font-size: clamp(22px, 1.8vw, 34px);
  font-weight: 600;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.sailing-details {
  min-width: 0;
  overflow-wrap: anywhere;
}
.sailing-details strong {
  display: block;
  font-size: clamp(23px, 1.9vw, 34px);
  line-height: 1.15;
  font-weight: 600;
}
.sailing-details span {
  display: block;
  margin: 4px 0 3px;
  color: #d7e5ef;
  font-size: clamp(14px, 1.1vw, 20px);
  line-height: 1.3;
}
.sailing-details small {
  display: block;
  color: #91aec4;
  font-size: clamp(11px, 0.8vw, 15px);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.status-cell {
  min-width: 0;
}
.sailing-status {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 6px;
  border: 1px solid #365d79;
  border-radius: 7px;
  background: #183d56;
  color: #c2e6ff;
  text-align: center;
  font-size: clamp(12px, 1vw, 18px);
  line-height: 1.3;
  font-weight: 600;
  overflow-wrap: anywhere;
}
/* Explicit labels keep statuses readable without relying on color alone. */
.sailing-status.boarding {
  background: #084c4d;
  border-color: #399c99;
  color: #a5f3ee;
}
.arrivals .sailing-status.boarding {
  background: #39305c;
  border-color: #8772bf;
  color: #e3d7ff;
}
.sailing-status.delayed {
  background: #5b3d17;
  border-color: #bd8b3b;
  color: #ffdfaa;
}
.sailing-status.cancelled {
  background: #682734;
  border-color: #c66a7a;
  color: #ffd8df;
}
.sailing-status.completed {
  background: #163f28;
  border-color: #529967;
  color: #c0f5c8;
}

.status-context,
.past-schedule {
  display: block;
  margin-top: 5px;
  text-align: center;
  font-size: clamp(11px, 0.8vw, 15px);
  line-height: 1.3;
  color: #9abbd2;
}
.past-schedule {
  color: #ffcf85;
}
.empty-board {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 14px;
  min-height: 180px;
  margin: 0;
  padding: 24px 20px;
  color: #a8bfd1;
  text-align: center;
}
.empty-board-icon {
  display: grid;
  place-items: center;
  width: 80px;
  height: 80px;
  margin-bottom: 4px;
  border: 1px solid #365e88;
  border-radius: 50%;
  background: #173b5b55;
  color: #81c7ff;
}
.empty-board-icon svg {
  width: 42px;
  height: 42px;
}
.empty-board h3 {
  margin: 0;
  color: #f1f7ff;
  font-size: clamp(18px, 1.5vw, 28px);
}
.empty-board p {
  margin: 0;
  font-size: clamp(14px, 1.15vw, 22px);
  line-height: 1.5;
}
.display-advisory {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 22px 32px;
  border: 1px solid #2b5270;
  border-left: 7px solid #379eff;
  border-radius: 20px;
  background: linear-gradient(115deg, #112c4b, #102d3a);
}
.advisory-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 68px;
  height: 68px;
  border-radius: 16px;
  background: #2464ad66;
  color: #67bfff;
}
.advisory-icon svg {
  width: 36px;
  height: 36px;
}
.advisory-copy {
  min-width: 0;
}
.display-advisory.urgent {
  background: #492330;
  border-color: #884354;
  border-left-color: #ff8c9b;
}
.display-advisory p {
  margin: 0 0 4px;
  color: #49b8ff;
  font-size: clamp(12px, 1vw, 18px);
  font-weight: 600;
  letter-spacing: 0.1em;
}
.display-advisory h2 {
  margin: 0 0 4px;
  font-size: clamp(16px, 1.4vw, 24px);
  font-weight: 600;
}
.display-advisory .advisory-copy > div {
  color: #b0c9df;
  font-size: clamp(13px, 1vw, 18px);
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
@media (min-width: 801px) and (max-height: 800px) {
  .port-screen {
    --sailing-row-height: 84px;
    padding: 16px 20px;
    gap: 10px;
  }
  .display-header {
    padding-bottom: 10px;
  }
  .display-header h1 {
    font-size: 28px;
  }
  .display-header p {
    font-size: 12px;
  }
  .display-header .display-brand {
    font-size: 10px;
  }
  .display-clock > strong {
    font-size: 28px;
  }
  .board-heading {
    padding: 9px 14px;
  }
  .board-heading h2 {
    font-size: 20px;
  }
  .board-columns {
    font-size: 11px;
    padding: 7px 14px;
  }
  .sailing-rows li {
    padding: 6px 14px;
  }
  .sailing-rows time {
    font-size: 22px;
  }
  .sailing-details strong {
    font-size: 23px;
  }
  .sailing-details span {
    font-size: 14px;
    margin: 3px 0;
  }
  .sailing-details small {
    font-size: 11px;
  }
  .sailing-status {
    font-size: 12px;
    padding: 7px 5px;
  }
  .boarding-banner {
    padding: 10px 14px;
    gap: 14px;
  }
  .boarding-label {
    padding-right: 14px;
  }
  .boarding-label strong {
    font-size: 24px;
  }
  .boarding-destination h2 {
    font-size: 24px;
  }
  .boarding-destination p {
    font-size: 12px;
  }
  .boarding-instruction strong {
    font-size: 14px;
  }
  .boarding-instruction span {
    font-size: 12px;
  }
  .display-advisory {
    padding: 10px 14px;
  }
  .display-advisory h2 {
    font-size: 16px;
  }
  .display-advisory div {
    font-size: 12px;
  }
}
@media (min-width: 801px) and (max-height: 650px) {
  .port-screen {
    gap: 8px;
  }
  .display-header {
    min-height: 0;
    padding-block: 4px;
  }
  .display-advisory {
    gap: 16px;
    padding: 6px 14px;
  }
  .advisory-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
  }
  .advisory-icon svg {
    width: 28px;
    height: 28px;
  }
  .boarding-destination h2 {
    font-size: 20px;
  }
}
@media (max-width: 800px) {
  .display-header .header-weather-target {
    right: 110px;
    width: 100px;
  }
  .header-weather-tooltip {
    right: -80px;
    width: 250px;
    max-width: calc(100vw - 40px);
  }
  .display-header {
    min-height: 0;
  }
  .display-clock {
    margin-right: 0;
  }
  .display-header :deep(.maritime-header-art img) {
    right: -20px;
    width: 560px;
    bottom: -12px;
  }
  .port-screen {
    height: auto;
    padding: 16px 14px;
    gap: 12px;
  }
  .display-header {
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
  }
  .display-clock {
    margin-left: auto;
  }
  .display-header :deep(.maritime-header-art) {
    inset: -16px -14px 0;
  }
  .display-advisory {
    gap: 12px;
    padding: 16px;
    border-radius: 14px;
    align-items: flex-start;
  }
  .advisory-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
  }
  .advisory-icon svg {
    width: 26px;
    height: 26px;
  }
  .empty-board-icon {
    width: 60px;
    height: 60px;
  }
  .board-heading {
    padding: 14px 12px;
    gap: 10px;
  }
  .direction-arrow {
    width: 40px;
    height: 40px;
    border-radius: 10px;
  }
  .board-count > span {
    padding: 8px;
    gap: 5px;
    font-size: 11px;
  }
  .board-count svg {
    width: 16px;
    height: 16px;
  }
  .board-heading-copy p {
    font-size: 12px;
  }
  .board-heading h2 {
    font-size: 19px;
  }
  .display-identity {
    gap: 8px;
  }
  .display-identity img {
    width: 32px;
    height: 32px;
  }
  .display-header h1 {
    font-size: 23px;
  }
  .display-header .display-brand {
    font-size: 8px;
    letter-spacing: 0.06em;
  }
  .display-header p {
    font-size: 11px;
  }
  .display-clock > strong {
    font-size: 18px;
  }
  .clock-meta {
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }
  .connection-state {
    font-size: 11px;
  }
  .display-boards {
    grid-template-columns: minmax(0, 1fr);
    flex: none;
    gap: 12px;
  }
  .board-heading h2 {
    font-size: 19px;
  }
  .board-columns,
  .sailing-rows li {
    grid-template-columns: 86px minmax(0, 1fr) 100px;
    gap: 8px;
    padding-inline: 12px;
  }
  .sailing-rows li {
    height: auto;
    min-height: 106px;
    padding-block: 12px;
  }
  .sailing-rows time {
    font-size: 16px;
  }
  .sailing-details strong {
    font-size: 18px;
  }
  .sailing-details span {
    font-size: 13px;
  }
  .sailing-details small {
    font-size: 10px;
  }
  .sailing-status {
    font-size: 11px;
  }
  .status-context,
  .past-schedule {
    font-size: 10px;
  }
  .boarding-banner {
    grid-template-columns: auto minmax(0, 1fr);
    gap: 12px;
    padding: 12px;
  }
  .boarding-label {
    padding-right: 12px;
  }
  .boarding-label span {
    font-size: 10px;
  }
  .boarding-label strong {
    font-size: 20px;
  }
  .boarding-destination h2 {
    font-size: 22px;
  }
  .boarding-instruction {
    grid-column: 1 / -1;
    border-top: 1px solid #3b6959;
    padding-top: 8px;
  }
  .boarding-destination p {
    font-size: 12px;
  }
  .display-controls {
    top: 115px;
    right: 14px;
    width: calc(100% - 28px);
    max-height: calc(100dvh - 130px);
    overflow-y: auto;
    padding: 14px;
  }
  .port-screen button,
  .port-screen select {
    min-height: 44px;
  }
}
@media (max-width: 360px) {
  .display-identity img {
    display: none;
  }
  .display-header h1 {
    font-size: 21px;
  }
  .display-clock > strong {
    font-size: 16px;
  }
  .board-columns,
  .sailing-rows li {
    grid-template-columns: 74px minmax(0, 1fr) 88px;
    padding-inline: 10px;
    gap: 7px;
  }
  .sailing-rows time {
    font-size: 14px;
  }
}
</style>
