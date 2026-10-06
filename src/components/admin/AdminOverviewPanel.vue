<template>
  <p v-if="error" class="catalog-error" role="alert">{{ error }}</p>
  <p v-if="loading && !data" role="status">Loading operations…</p>
  <template v-if="data">
    <div class="overview-metrics">
      <article v-for="metric in metrics" :key="metric.key">
        <span :class="['overview-icon', metric.tone]"
          ><ion-icon :icon="metric.icon" /></span
        ><small>{{ metric.label }}</small
        ><strong
          >{{ data.stats[metric.key] ?? 0
          }}{{ metric.key === "utilization" ? "%" : "" }}</strong
        >
        <p v-if="metric.key === 'utilization'">Across today's fleet</p>
      </article>
    </div>
    <div class="overview-charts">
      <section class="catalog-panel">
        <h2>Passenger Volume &amp; Bookings</h2>
        <p class="chart-context">Bookings created in the last six months</p>
        <div class="chart-legend volume-legend">
          <span><i></i>Bookings</span>
          <span><i class="green"></i>Passengers</span>
        </div>
        <div class="volume-chart" role="img" :aria-label="monthlyDescription">
          <div
            v-for="month in data.monthly"
            :key="month.month"
            class="month-group"
          >
            <div class="month-bars">
              <i
                :style="{ height: barHeight(month.bookings) }"
                :title="`${month.bookings} bookings`"
              ></i
              ><i
                class="passenger-bar"
                :style="{ height: barHeight(month.passengers) }"
                :title="`${month.passengers} passengers`"
              ></i>
            </div>
            <span class="month-label">{{ month.month }}</span>
            <span class="month-total">{{ month.bookings }} / {{ month.passengers }}</span>
          </div>
        </div>
        <details class="chart-data"><summary>View monthly figures</summary><table><thead><tr><th scope="col">Month</th><th scope="col">Bookings</th><th scope="col">Passengers</th></tr></thead><tbody><tr v-for="month in data.monthly" :key="month.month"><th scope="row">{{ month.month }}</th><td>{{ month.bookings }}</td><td>{{ month.passengers }}</td></tr></tbody></table></details>
      </section>
      <section class="catalog-panel">
        <h2>Booking Status</h2>
        <p class="chart-context">All reservations</p>
        <div class="distribution-chart">
        <div
          class="donut"
          :style="{ background: pie(data.bookingStatus) }"
          role="img"
          :aria-label="describe(data.bookingStatus)"
        >
          <div>
            <strong>{{ sum(data.bookingStatus) }}</strong
            ><small>Bookings</small>
          </div>
        </div>
        <ul class="segment-list">
          <li v-for="(item, i) in data.bookingStatus" :key="item.name"><span><i :style="{ background: segmentColor(item.name, i) }"></i>{{ humanize(item.name) }}</span><strong>{{ item.value }}</strong></li>
        </ul>
        </div>
        <p v-if="!sum(data.bookingStatus)" class="chart-empty">
          No reservations yet.
        </p>
      </section>
      <section class="catalog-panel">
        <h2>Popular Routes</h2>
        <p class="chart-context">Passengers in active reservations</p>
        <div class="route-chart">
          <div v-for="item in data.routes" :key="item.route" class="route-row">
            <div class="route-label"><span>{{ item.route }}</span><strong>{{ item.passengers }} <small>passengers</small></strong></div>
            <div class="route-track"><i :style="{ width: `${(100 * item.passengers) / routeMax}%` }"></i></div>
          </div>
          <p v-if="!data.routes.length" class="chart-empty">
            Route activity will appear here.
          </p>
        </div>
      </section>
      <section class="catalog-panel">
        <h2>Passenger Categories</h2>
        <p class="chart-context">Paid, confirmed reservations</p>
        <div class="distribution-chart">
        <div
          class="donut"
          :style="{ background: pie(data.categories) }"
          role="img"
          :aria-label="describe(data.categories)"
        ><div><strong>{{ sum(data.categories) }}</strong><small>Passengers</small></div></div>
        <ul class="segment-list">
          <li v-for="(item, i) in data.categories" :key="item.name"><span><i :style="{ background: segmentColor(item.name, i) }"></i>{{ item.name.toUpperCase() === 'PWD' ? 'PWD' : humanize(item.name) }}</span><strong>{{ item.value }}</strong></li>
        </ul>
        </div>
        <p v-if="!sum(data.categories)" class="chart-empty">
          No paid passengers yet.
        </p>
      </section>
    </div>
    <div class="overview-trip-heading">
      <h2>Today's Trips</h2>
      <router-link to="/admin/trips">View all →</router-link>
    </div>
    <section class="catalog-panel catalog-table">
      <table>
        <thead>
          <tr>
            <th>Trip</th>
            <th>Route</th>
            <th>Vessel</th>
            <th>Departure</th>
            <th>Booked</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="trip in data.trips" :key="trip.code">
            <td data-label="Trip">
              <router-link
                :to="`/admin/trip-operations?sailing=${encodeURIComponent(trip.code)}`"
                >{{ trip.code }}</router-link
              >
            </td>
            <td data-label="Route">
              {{ trip.origin.name }} → {{ trip.destination.name }}
            </td>
            <td data-label="Vessel">{{ trip.vessel.name }}</td>
            <td data-label="Departure">{{ time(trip.departureAt) }}</td>
            <td data-label="Booked">
              {{ trip.vessel.passengerCapacity - trip.availableSeats }} /
              {{ trip.vessel.passengerCapacity }}
            </td>
            <td data-label="Status">
              <span class="status">{{ humanize(trip.status) }}</span>
            </td>
          </tr>
          <tr v-if="!data.trips.length">
            <td colspan="6">No departures scheduled today.</td>
          </tr>
        </tbody>
      </table>
    </section>
  </template>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { IonIcon } from "@ionic/vue";
import {
  boatOutline,
  ticketOutline,
  peopleOutline,
  scanOutline,
  checkmarkCircleOutline,
  personRemoveOutline,
  closeCircleOutline,
  trendingUpOutline,
} from "ionicons/icons";
import { overview, type Overview } from "../../services/database/workspaces";
import { staffDatabase } from "../../services/session";
import { databaseRequestError } from "../../data/databaseErrors";
import { auditLabel as humanize } from "../../data/auditPresentation";
const props = defineProps<{ refreshToken?: number }>();
const data = ref<Overview | null>(null),
  loading = ref(false),
  error = ref("");
const colors = [
  "#176cc0",
  "#2ca16d",
  "#f5a000",
  "#ae56d8",
  "#ec3986",
  "#8a9db1",
];
const semanticColors: Record<string, string> = {
  confirmed: "#2684d9", pending: "#e5a129", cancelled: "#e56873", expired: "#8a9db1", completed: "#2ca16d",
  regular: "#2684d9", student: "#2ca16d", senior: "#ae77d1", child: "#e5a129", pwd: "#d869a1", pregnant: "#8a9db1",
};
const segmentColor = (name: string, index: number) => semanticColors[name.toLowerCase()] || colors[index % colors.length];
const metrics = [
  {
    key: "todayTrips",
    label: "TODAY'S TRIPS",
    icon: boatOutline,
    tone: "blue",
  },
  {
    key: "todayBookings",
    label: "TODAY'S BOOKINGS",
    icon: ticketOutline,
    tone: "blue",
  },
  {
    key: "todayPassengers",
    label: "TODAY'S PASSENGERS",
    icon: peopleOutline,
    tone: "slate",
  },
  { key: "checkedIn", label: "CHECKED-IN", icon: scanOutline, tone: "green" },
  {
    key: "boarded",
    label: "BOARDED",
    icon: checkmarkCircleOutline,
    tone: "blue",
  },
  { key: "noShow", label: "NO-SHOW", icon: personRemoveOutline, tone: "amber" },
  {
    key: "cancelled",
    label: "CANCELLED",
    icon: closeCircleOutline,
    tone: "red",
  },
  {
    key: "utilization",
    label: "UTILIZATION",
    icon: trendingUpOutline,
    tone: "green",
  },
];
type Segment = { name: string; value: number };
const sum = (items: Segment[]) =>
  items.reduce((total, item) => total + item.value, 0);
const describe = (items: Segment[]) =>
  items.map((item) => `${humanize(item.name)}: ${item.value}`).join(", ") ||
  "No data";
function pie(items: Segment[]) {
  const total = sum(items);
  if (!total) return "var(--line)";
  let cursor = 0;
  return `conic-gradient(${items
    .map((item, i) => {
      const start = cursor;
      cursor += (100 * item.value) / total;
      return `${segmentColor(item.name, i)} ${start}% ${cursor}%`;
    })
    .join(",")})`;
}
const monthMax = computed(() =>
  Math.max(
    1,
    ...(data.value?.monthly.flatMap((m) => [m.bookings, m.passengers]) || []),
  ),
);
const routeMax = computed(() =>
  Math.max(1, ...(data.value?.routes.map((r) => r.passengers) || [])),
);
const barHeight = (count: number) => `${(100 * count) / monthMax.value}%`;
const monthlyDescription = computed(
  () =>
    data.value?.monthly
      .map(
        (m) => `${m.month}: ${m.bookings} bookings, ${m.passengers} passengers`,
      )
      .join("; ") || "No data",
);
const time = (value: string) =>
  new Date(value).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
let request = 0;
async function load() {
  if (!staffDatabase) return;
  const token = ++request;
  loading.value = true;
  error.value = "";
  try {
    const r = await overview(staffDatabase);
    if (token === request) data.value = r.data;
  } catch (e) {
    if (token === request)
      error.value = databaseRequestError(e, "Could not load dashboard.");
  } finally {
    if (token === request) loading.value = false;
  }
}
onMounted(load);
watch(() => props.refreshToken, load);
</script>
<style scoped>
.overview-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}
.overview-metrics article {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 13px;
  padding: 20px 16px;
  min-height: 96px;
  box-shadow: 0 2px 3px #142a4010;
}
.overview-metrics small {
  font-size: 11px;
  color: var(--muted);
  display: block;
  padding-right: 42px;
}
.overview-metrics strong {
  font-size: 25px;
  display: block;
  margin-top: 10px;
  color: var(--ink);
}
.overview-metrics p {
  font-size: 10px;
  color: var(--muted);
  margin: 8px 0 0;
}
.overview-icon {
  position: absolute;
  right: 16px;
  top: 17px;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  font-size: 21px;
  background: #e8f2ff;
  color: #087ad7;
}
.overview-icon.green {
  background: #e6f5ef;
  color: #29a37b;
}
.overview-icon.slate {
  background: #e9ecf0;
  color: #152c47;
}
.overview-icon.red {
  background: #ffebee;
  color: #f03f50;
}
.overview-icon.amber {
  background: #fff5e5;
  color: #f39b00;
}
.overview-charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.overview-charts > .catalog-panel {
  display: block;
  padding: 24px;
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 13px;
  box-shadow: 0 2px 3px #142a4010;
}
.overview-charts h2,
.overview-trip-heading h2 {
  font-size: 16px;
  margin: 0;
  font-weight: 650;
}
.chart-context {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
  margin: 6px 0 20px;
}
.volume-chart {
  position: relative;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  padding: 0;
}
.volume-chart::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 180px;
  border-bottom: 1px solid var(--line);
  background: repeating-linear-gradient(
    to top,
    transparent 0,
    transparent 44px,
    var(--line) 45px
  );
}
.month-group {
  position: relative;
  display: grid;
  grid-template-rows: 180px auto auto;
  gap: 8px;
  min-width: 0;
  text-align: center;
}
.month-bars {
  height: 100%;
  display: flex;
  align-items: end;
  gap: 5px;
}
.month-bars i {
  display: block;
  flex: 1;
  border-radius: 6px 6px 0 0;
  background: #176cc0;
  min-width: 0;
}
.month-bars i.passenger-bar {
  background: #2ca16d;
}
.month-label,
.month-total {
  display: block;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
}
.month-label { font-weight: 600; color: var(--ink); }
.month-total { font-size: 11px; white-space: nowrap; }
.chart-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin: 0 0 20px;
  justify-content: flex-start;
}
.chart-legend span {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--muted);
}
.chart-legend i {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 3px;
  background: #176cc0;
}
.chart-legend i.green {
  background: #2ca16d;
}
.donut {
  width: 156px;
  aspect-ratio: 1;
  border-radius: 50%;
  display: grid;
  place-items: center;
  margin: 0 auto;
}
.donut > div {
  width: 68%;
  height: 68%;
  border-radius: 50%;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.donut strong {
  font-size: 26px;
}
.donut small {
  font-size: 11px;
  color: var(--muted);
  margin-top: 6px;
}
.distribution-chart {
  display: grid;
  grid-template-columns: 156px minmax(0, 1fr);
  align-items: center;
  gap: 24px;
  min-height: 240px;
}
.segment-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; min-width: 0; }
.segment-list li { display: flex; gap: 12px; justify-content: space-between; align-items: center; font-size: 12px; line-height: 1.5; }
.segment-list li > span { display: flex; gap: 8px; align-items: center; color: var(--muted); min-width: 0; overflow-wrap: anywhere; }
.segment-list i { display: block; flex: 0 0 9px; width: 9px; height: 9px; border-radius: 3px; }
.segment-list strong { color: var(--ink); font-size: 13px; font-variant-numeric: tabular-nums; }
.chart-data { margin-top: 18px; border-top: 1px solid var(--line); padding-top: 14px; }
.chart-data summary { font-size: 12px; color: var(--ocean); cursor: pointer; }
.chart-data table { width: 100%; margin-top: 12px; font-size: 12px; border-collapse: collapse; }
.chart-data th, .chart-data td { padding: 8px; text-align: right; border-bottom: 1px solid var(--line); }
.chart-data th:first-child { text-align: left; }
.chart-empty {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}
.route-chart {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 20px;
}
.route-label {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 8px;
}
.route-chart span {
  font-size: 12px;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.route-track {
  height: 10px;
  border-radius: 5px;
  background: var(--line);
  overflow: hidden;
}
.route-chart i {
  height: 100%;
  display: block;
  border-radius: 5px;
  background: #176cc0;
}
.route-chart strong {
  font-size: 13px;
  color: var(--ink);
  white-space: nowrap;
}
.route-chart strong small { font-size: 10px; font-weight: 400; color: var(--muted); }
.overview-trip-heading {
  display: flex;
  justify-content: space-between;
  margin: 28px 0 14px;
}
.overview-trip-heading a {
  font-size: 12px;
  color: #087ad7;
  text-decoration: none;
}
td a {
  color: var(--ocean);
  text-decoration: none;
}
@media (max-width: 1050px) {
  .overview-charts { grid-template-columns: 1fr; }
  .overview-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .overview-charts {
    grid-template-columns: 1fr;
  }
  .overview-metrics article {
    padding: 17px 12px;
  }
  .overview-icon {
    right: 12px;
    width: 30px;
    height: 30px;
    font-size: 17px;
  }
  .overview-metrics small {
    font-size: 9px;
    padding-right: 30px;
  }
  .overview-charts > .catalog-panel {
    padding: 18px;
  }
  .volume-chart {
    gap: 6px;
  }
  .month-bars { gap: 3px; }
  .distribution-chart { grid-template-columns: 132px minmax(0,1fr); gap: 16px; min-height: 210px; }
  .donut { width: 132px; }
  .segment-list { gap: 10px; }
  .route-label strong small { display: none; }
}
@media (max-width: 360px) {
  .distribution-chart { grid-template-columns: 1fr; }
  .month-total { font-size: 10px; }
}
</style>
