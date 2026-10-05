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
            <small>{{ month.month }}</small>
          </div>
        </div>
        <div class="chart-legend">
          <span><i></i>Bookings</span
          ><span><i class="green"></i>Passengers</span>
        </div>
      </section>
      <section class="catalog-panel">
        <h2>Booking Status</h2>
        <p class="chart-context">All reservations</p>
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
        <div class="chart-legend">
          <span v-for="(item, i) in data.bookingStatus" :key="item.name"
            ><i :style="{ background: colors[i % colors.length] }"></i
            >{{ humanize(item.name) }} ({{ item.value }})</span
          >
        </div>
        <p v-if="!sum(data.bookingStatus)" class="chart-empty">
          No reservations yet.
        </p>
      </section>
      <section class="catalog-panel">
        <h2>Popular Routes</h2>
        <p class="chart-context">Passengers in active reservations</p>
        <div class="route-chart">
          <div v-for="item in data.routes" :key="item.route">
            <span>{{ item.route }}</span>
            <div>
              <i
                :style="{ width: `${(100 * item.passengers) / routeMax}%` }"
              ></i
              ><strong>{{ item.passengers }}</strong>
            </div>
          </div>
          <p v-if="!data.routes.length" class="chart-empty">
            Route activity will appear here.
          </p>
        </div>
      </section>
      <section class="catalog-panel">
        <h2>Passenger Categories</h2>
        <p class="chart-context">Paid, confirmed reservations</p>
        <div
          class="donut category-pie"
          :style="{ background: pie(data.categories) }"
          role="img"
          :aria-label="describe(data.categories)"
        ></div>
        <div class="chart-legend">
          <span v-for="(item, i) in data.categories" :key="item.name"
            ><i :style="{ background: colors[i % colors.length] }"></i
            >{{ humanize(item.name) }} ({{ item.value }})</span
          >
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
      return `${colors[i % colors.length]} ${start}% ${cursor}%`;
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
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.overview-charts > .catalog-panel {
  display: block;
  padding: 22px;
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 13px;
  box-shadow: 0 2px 3px #142a4010;
}
.overview-charts h2,
.overview-trip-heading h2 {
  font-size: 13px;
  margin: 0;
  font-weight: 650;
}
.chart-context {
  font-size: 10px;
  color: var(--muted);
  margin: 8px 0 16px;
}
.volume-chart {
  height: 200px;
  display: flex;
  gap: 12px;
  align-items: end;
  padding: 0 10px;
  border-bottom: 1px solid var(--line);
  background: repeating-linear-gradient(
    to top,
    transparent 0,
    transparent 49px,
    var(--line) 50px
  );
}
.month-group {
  flex: 1;
  min-width: 0;
  text-align: center;
  height: 100%;
}
.month-bars {
  height: calc(100% - 24px);
  display: flex;
  align-items: end;
  gap: 5px;
}
.month-bars i {
  display: block;
  flex: 1;
  border-radius: 6px 6px 0 0;
  background: #176cc0;
}
.month-bars i.passenger-bar {
  background: #2ca16d;
}
.month-group small {
  display: block;
  margin-top: 8px;
  color: var(--muted);
  font-size: 10px;
}
.chart-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}
.chart-legend span {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--muted);
}
.chart-legend i {
  width: 10px;
  height: 10px;
  background: #176cc0;
}
.chart-legend i.green {
  background: #2ca16d;
}
.donut {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  margin: 12px auto 22px;
}
.donut > div {
  width: 115px;
  height: 115px;
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
.category-pie {
  width: 180px;
  height: 180px;
}
.chart-empty {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}
.route-chart {
  min-height: 205px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
}
.route-chart > div {
  display: grid;
  grid-template-columns: 115px 1fr;
  gap: 14px;
  align-items: center;
}
.route-chart span {
  font-size: 10px;
  color: var(--muted);
}
.route-chart > div > div {
  position: relative;
  height: 28px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.route-chart i {
  height: 100%;
  display: block;
  border-radius: 0 5px 5px 0;
  background: #176cc0;
}
.route-chart strong {
  font-size: 10px;
  color: var(--muted);
}
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
    height: 180px;
    gap: 9px;
  }
}
</style>
