<template>
  <div class="reports">
    <section class="card filters" aria-label="Report filters">
      <label
        >Period<select v-model="period" @change="applyPeriod">
          <option value="month">This month</option>
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="custom">Custom dates</option>
        </select></label
      >
      <label
        >From<input v-model="start" type="date" @change="customDates" /></label
      ><label
        >Through<input v-model="end" type="date" @change="customDates"
      /></label>
      <label
        >Route<select v-model="route">
          <option value="ALL">All routes</option>
          <option v-for="g in routes" :key="g.key" :value="g.key">
            {{ g.label }}
          </option>
        </select></label
      >
      <label
        >Vessel<select v-model="vessel">
          <option value="ALL">All vessels</option>
          <option v-for="g in vessels" :key="g.key" :value="g.key">
            {{ g.label }}
          </option>
        </select></label
      >
      <p>
        Reports follow sailing departure dates in Philippine time. Select up to
        366 days.
      </p>
    </section>
    <p v-if="error" class="card error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="card" role="status">
      Loading reports and analytics…
    </p>
    <template v-else-if="ready">
      <div class="metrics">
        <article v-for="m in metrics" :key="m.label" class="card">
          <small>{{ m.label }}</small
          ><strong>{{ m.value }}</strong
          ><span>{{ m.note }}</span>
        </article>
      </div>
      <p v-if="!filtered.length" class="card">
        No sailings match these dates and filters.
      </p>
      <div class="charts">
        <section class="card">
          <div class="card-head">
            <h2>Collection trend</h2>
            <span>{{ trend.mode }}</span>
          </div>
          <p>
            Paid booking amounts grouped by departure date, including paid
            cancellations before refunds.
          </p>
          <div class="chart-scroll">
            <div
              class="bars"
              :style="{
                minWidth: `${Math.max(280, trend.points.length * 24)}px`,
              }"
            >
              <div
                v-for="(point, i) in trend.points"
                :key="point.date"
                class="bar-column"
              >
                <div
                  role="img"
                  :style="{
                    height: `${Math.max(1, (point.revenue / trendMax) * 100)}%`,
                  }"
                  :title="`${point.date}: ${money(point.revenue)}`"
                  :aria-label="`${point.date}: ${money(point.revenue)}`"
                ></div
                ><small>{{
                  i % Math.max(1, Math.ceil(trend.points.length / 6)) === 0
                    ? point.date.slice(5)
                    : ""
                }}</small>
              </div>
            </div>
          </div>
          <div class="chart-foot">
            <details class="collection-data"><summary>View collection data</summary><table><thead><tr><th>Period</th><th>Collected (PHP)</th></tr></thead><tbody><tr v-for="point in trend.points" :key="point.date"><th>{{ point.date }}</th><td>{{ money(point.revenue) }}</td></tr></tbody></table></details>
            <span>Highest period</span
            ><strong>{{
              money(Math.max(...trend.points.map((p) => p.revenue), 0))
            }}</strong>
          </div>
        </section>
        <section class="card">
          <h2>Booking activity</h2>
          <p>
            Payment and cancellation breakdown for
            {{ totals.bookingCount }} reservations.
          </p>
          <div
            v-for="item in bookingMix"
            :key="item.label"
            class="distribution"
          >
            <div>
              <span>{{ item.label }}</span
              ><strong
                >{{ item.count }}
                <small
                  >({{ percent(item.count, totals.bookingCount) }}%)</small
                ></strong
              >
            </div>
            <div class="track">
              <i
                :style="{
                  width: `${percent(item.count, totals.bookingCount)}%`,
                  background: item.color,
                }"
              ></i>
            </div>
          </div>
          <div class="channel">
            <span
              >Online<strong>{{ totals.onlineBookings }}</strong></span
            ><span
              >Walk-in<strong>{{ totals.walkInBookings }}</strong></span
            >
          </div>
        </section>
        <section class="card">
          <p>
            Refunds pending: PHP {{ totals.refundPending.toLocaleString() }} |
            Cash refunded: PHP {{ totals.refundedRevenue.toLocaleString() }} |
            Expired reservations: {{ totals.expiredBookings }}
          </p>
          <h2>Passenger mix</h2>
          <p>Paid, confirmed passengers by fare category.</p>
          <div
            v-for="item in passengerMix"
            :key="item.label"
            class="distribution"
          >
            <div>
              <span>{{ item.label }}</span
              ><strong
                >{{ item.count }}
                <small
                  >({{ percent(item.count, totals.paidPassengers) }}%)</small
                ></strong
              >
            </div>
            <div class="track">
              <i
                :style="{
                  width: `${percent(item.count, totals.paidPassengers)}%`,
                }"
              ></i>
            </div>
          </div>
        </section>
        <section class="card">
          <h2>Sailing performance</h2>
          <p>
            Seat utilization and terminal progress across the selected sailings.
          </p>
          <div
            v-for="item in performance"
            :key="item.label"
            class="distribution"
          >
            <div>
              <span>{{ item.label }}</span
              ><strong>{{ item.value }}%</strong>
            </div>
            <div class="track">
              <i :style="{ width: `${Math.min(100, item.value)}%` }"></i>
            </div>
          </div>
          <div class="statuses">
            <span
              v-for="status in [
                'SCHEDULED',
                'BOARDING',
                'DELAYED',
                'COMPLETED',
                'CANCELLED',
              ]"
              :key="status"
              >{{ status.toLowerCase()
              }}<strong>{{
                filtered.filter((s) => s.status === status).length
              }}</strong></span
            >
          </div>
          <p>
            Check-in totals include boarded passengers. Upcoming trips may have
            no boarding activity yet.
          </p>
        </section>
      </div>
      <AdminManifestExport :sailings="filtered" />
      <section class="card report-table">
        <div class="card-head">
          <div>
            <h2>Detailed reports</h2>
            <p>
              {{ tableRows.length }} records · {{ start }} through {{ end }}
            </p>
          </div>
          <button
            class="export"
            :disabled="!tableRows.length"
            @click="exportReport"
          >
            Export CSV
          </button>
        </div>
        <div class="table-toolbar">
          <div class="tabs" role="group" aria-label="Report type">
            <button
              v-for="(label, key) in tabs"
              :key="key"
              :aria-pressed="tab === key"
              @click="tab = key"
            >
              {{ label }}
            </button>
          </div>
          <input
            v-model="search"
            type="search"
            placeholder="Search this report"
            aria-label="Search report table"
          />
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th v-for="h in headers" :key="h">{{ h }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in tableRows" :key="i">
                <td v-for="(cell, j) in row" :key="j">
                  {{ moneyColumns.includes(j) ? money(Number(cell)) : cell }}
                </td>
              </tr>
              <tr v-if="!tableRows.length">
                <td :colspan="headers.length" class="empty">
                  No matching records.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="table-note">
          CSV includes the selected report, dates, route, vessel, and search
          results. Collection amounts are gross paid bookings; refunds are not
          deducted.
        </p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import AdminManifestExport from "./AdminManifestExport.vue";
import { adminReports } from "../../services/database/staff";
import { staffDatabase } from "../../services/session";
import {
  decodeReports,
  groupedReports,
  manilaDay,
  reportCsv,
  reportPercentage as percent,
  reportRange,
  reportTotals,
  revenueTrend,
  shiftDay,
  type ReportSailing,
} from "../../data/reportAnalytics";
import { ticketRequestError } from "../../data/ticketActions";
const props = defineProps<{ refreshToken: number }>();
const emit = defineEmits<{ loading: [value: boolean] }>();
const today = manilaDay();
const start = ref(today.slice(0, 7) + "-01"),
  end = ref(today),
  period = ref("month");
const route = ref("ALL"),
  vessel = ref("ALL"),
  search = ref(""),
  loading = ref(false),
  ready = ref(false),
  error = ref("");
const records = ref<ReportSailing[]>([]);
const tabs = {
  sailings: "Sailings",
  routes: "Routes",
  vessels: "Vessels",
  collections: "Collections",
};
const tab = ref<keyof typeof tabs>("sailings");
const routes = computed(() => groupedReports(records.value, "route"));
const vessels = computed(() => groupedReports(records.value, "vessel"));
const filtered = computed(() =>
  records.value.filter(
    (s) =>
      (route.value === "ALL" ||
        `${s.originId}:${s.destinationId}` === route.value) &&
      (vessel.value === "ALL" || s.vesselId === vessel.value),
  ),
);
const totals = computed(() => reportTotals(filtered.value));
const money = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);
const metrics = computed(() => {
  const t = totals.value;
  return [
    {
      label: "Collected revenue",
      value: money(t.collectedRevenue),
      note: "Gross paid booking amounts",
    },
    {
      label: "Awaiting payment",
      value: money(t.pendingRevenue),
      note: `${t.pendingBookings} unpaid active bookings`,
    },
    {
      label: "Reservations",
      value: t.bookingCount,
      note: `${t.cancelledBookings} cancelled (${percent(t.cancelledBookings, t.bookingCount)}%)`,
    },
    {
      label: "Reserved seats",
      value: t.reservedSeats,
      note: `${percent(t.reservedSeats, t.capacity)}% of ${t.capacity} sailing seats`,
    },
    {
      label: "Sailings",
      value: filtered.value.length,
      note: `${filtered.value.filter((s) => s.status === "COMPLETED").length} completed`,
    },
    {
      label: "Checked in / boarded",
      value: `${t.checkedIn} / ${t.boarded}`,
      note: `${t.paidPassengers} paid, confirmed passengers`,
    },
  ];
});
const trend = computed(() =>
  revenueTrend(filtered.value, start.value, end.value),
);
const trendMax = computed(() =>
  Math.max(1, ...trend.value.points.map((p) => p.revenue)),
);
const bookingMix = computed(() => [
  { label: "Paid active", count: totals.value.paidBookings, color: "#26b99a" },
  {
    label: "Awaiting payment",
    count: totals.value.pendingBookings,
    color: "#e3ab4c",
  },
  {
    label: "Cancelled",
    count: totals.value.cancelledBookings,
    color: "#e77b88",
  },
]);
const passengerMix = computed(() =>
  (["regular", "student", "senior", "child", "pwd", "pregnant"] as const).map(
    (key) => ({
      label: key === "pwd" ? "PWD" : key.charAt(0).toUpperCase() + key.slice(1),
      count: totals.value[key],
    }),
  ).concat([{ label: "Other discounts", count: Math.max(0, totals.value.paidPassengers - ["regular", "student", "senior", "child", "pwd", "pregnant"].reduce((sum, key) => sum + Number(totals.value[key as keyof typeof totals.value] || 0), 0)) }]),
);
const performance = computed(() => [
  {
    label: "Seat occupancy",
    value: percent(totals.value.reservedSeats, totals.value.capacity),
  },
  {
    label: "Checked in / paid passengers",
    value: percent(totals.value.checkedIn, totals.value.paidPassengers),
  },
  {
    label: "Boarded / paid passengers",
    value: percent(totals.value.boarded, totals.value.paidPassengers),
  },
]);
const headers = computed(() =>
  tab.value === "sailings"
    ? [
        "Sailing",
        "Departure (PH)",
        "Route",
        "Vessel",
        "Seats",
        "Occupancy",
        "Bookings",
        "Collected (PHP)",
        "Checked in",
        "Boarded",
        "Status",
      ]
    : tab.value === "collections"
      ? [
          "Sailing",
          "Route",
          "Vessel",
          "Paid active",
          "Unpaid active",
          "Cancelled",
          "Collected (PHP)",
          "Awaiting (PHP)",
          "Online",
          "Walk-in",
        ]
      : [
          tab.value === "routes" ? "Route" : "Vessel",
          "Sailings",
          "Reserved seats",
          "Capacity",
          "Occupancy",
          "Bookings",
          "Collected (PHP)",
          "Awaiting (PHP)",
          "Checked in",
          "Boarded",
        ],
);
const moneyColumns = computed(() => (tab.value === "sailings" ? [7] : [6, 7]));
const tableRows = computed(() => {
  let rows: (string | number)[][];
  const routeName = (s: ReportSailing) => `${s.origin} → ${s.destination}`;
  if (tab.value === "sailings")
    rows = filtered.value.map((s) => [
      s.code,
      new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(s.departureAt)),
      routeName(s),
      s.vessel,
      `${s.reservedSeats} / ${s.capacity}`,
      `${percent(s.reservedSeats, s.capacity)}%`,
      s.bookingCount,
      s.collectedRevenue,
      s.checkedIn,
      s.boarded,
      s.status,
    ]);
  else if (tab.value === "collections")
    rows = filtered.value.map((s) => [
      s.code,
      routeName(s),
      s.vessel,
      s.paidBookings,
      s.pendingBookings,
      s.cancelledBookings,
      s.collectedRevenue,
      s.pendingRevenue,
      s.onlineBookings,
      s.walkInBookings,
    ]);
  else
    rows = groupedReports(
      filtered.value,
      tab.value === "routes" ? "route" : "vessel",
    ).map((g) => [
      g.label,
      g.rows.length,
      g.totals.reservedSeats,
      g.totals.capacity,
      `${percent(g.totals.reservedSeats, g.totals.capacity)}%`,
      g.totals.bookingCount,
      g.totals.collectedRevenue,
      g.totals.pendingRevenue,
      g.totals.checkedIn,
      g.totals.boarded,
    ]);
  return rows.filter((row) =>
    row.some((cell) =>
      String(cell).toLowerCase().includes(search.value.toLowerCase()),
    ),
  );
});
let request = 0;
async function loadReports() {
  const version = ++request;
  loading.value = true;
  ready.value = false;
  error.value = "";
  emit("loading", true);
  try {
    const range = reportRange(start.value, end.value);
    if (!staffDatabase) throw new Error("Report service is unavailable.");
    const result = await adminReports(staffDatabase, range, {
      fetchPolicy: "SERVER_ONLY",
    });
    if (version !== request) return;
    records.value = decodeReports(result.data.sailings);
    if (!routes.value.some((g) => g.key === route.value)) route.value = "ALL";
    if (!vessels.value.some((g) => g.key === vessel.value))
      vessel.value = "ALL";
    ready.value = true;
  } catch (e) {
    if (version === request)
      error.value = ticketRequestError(
        e,
        "Unable to load reports. Try Refresh.",
      );
  } finally {
    if (version === request) {
      loading.value = false;
      emit("loading", false);
    }
  }
}
function applyPeriod() {
  if (period.value === "custom") return;
  end.value = manilaDay();
  start.value =
    period.value === "month"
      ? end.value.slice(0, 7) + "-01"
      : shiftDay(
          end.value,
          period.value === "week" ? -6 : period.value === "30" ? -29 : 0,
        );
  loadReports();
}
function customDates() {
  period.value = "custom";
  loadReports();
}
function exportReport() {
  const url = URL.createObjectURL(
    new Blob([reportCsv(headers.value, tableRows.value)], {
      type: "text/csv;charset=utf-8;",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${tab.value}-${start.value}-to-${end.value}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
watch(() => props.refreshToken, loadReports, { immediate: true });
onBeforeUnmount(() => {
  request++;
  emit("loading", false);
});
</script>

<style scoped>
.reports {
  display: grid;
  gap: 20px;
}
.card {
  background: var(--surface, #fff);
  border: 1px solid var(--line, #dae5ef);
  border-radius: 16px;
  padding: 22px;
  color: var(--ink, #142f49);
  min-width: 0;
}
.card h2 {
  font-size: 18px;
  margin: 0 0 10px;
}
.card p,
.metrics span,
.metrics small {
  color: var(--muted, #65788b);
  font-size: 12px;
  line-height: 1.6;
}
.card p {
  margin: 0 0 16px;
}
.filters {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}
.filters label {
  display: grid;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
}
.filters p {
  grid-column: 1/-1;
  margin: 0;
}
.reports input,
.reports select {
  width: 100%;
  border: 1px solid var(--line, #dae5ef);
  background: var(--surface, #fff);
  color: inherit;
  border-radius: 8px;
  padding: 10px;
  min-width: 0;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.metrics article {
  display: grid;
  gap: 9px;
}
.metrics strong {
  font-size: 26px;
}
.charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.card-head > span {
  color: #319be8;
  font-size: 12px;
}
.chart-scroll {
  overflow-x: auto;
}
.bars {
  height: 192px;
  display: flex;
  gap: 5px;
  padding-top: 12px;
}
.bar-column {
  flex: 1;
  min-width: 12px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-direction: column;
  position: relative;
  padding: 0 1px;
}
.bar-column > div {
  width: 100%;
  max-width: 38px;
  border: 0;
  background: #3c9de4;
  border-radius: 4px 4px 0 0;
  min-height: 2px;
}
.bar-column small {
  position: absolute;
  top: 166px;
  white-space: nowrap;
  font-size: 10px;
  color: var(--muted, #65788b);
}
.chart-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: space-between;
  font-size: 12px;
  margin-top: 12px;
}
.collection-data { flex-basis: 100%; overflow-x: auto; }
.distribution {
  margin: 17px 0;
}
.distribution > div:first-child {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  margin-bottom: 8px;
}
.distribution small {
  font-weight: 400;
  color: var(--muted, #65788b);
}
.track {
  height: 8px;
  border-radius: 5px;
  background: var(--line, #e8eef4);
  overflow: hidden;
}
.track i {
  height: 100%;
  display: block;
  background: #3c9de4;
  border-radius: 5px;
}
.channel,
.statuses {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  border-top: 1px solid var(--line, #dae5ef);
  padding-top: 16px;
}
.channel span {
  flex: 1;
  font-size: 12px;
}
.channel strong,
.statuses strong {
  display: block;
  font-size: 20px;
  margin-top: 7px;
}
.statuses {
  margin-bottom: 16px;
}
.statuses span {
  flex: 1;
  font-size: 10px;
  text-transform: capitalize;
}
.export {
  border: 0;
  background: #238fe0;
  color: white;
  border-radius: 8px;
  padding: 11px 16px;
  white-space: nowrap;
  font-weight: 600;
  cursor: pointer;
}
.export:disabled {
  opacity: 0.5;
  cursor: default;
}
.table-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin: 12px 0 20px;
  flex-wrap: wrap;
}
.tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.tabs button {
  border: 0;
  background: transparent;
  color: var(--muted, #65788b);
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
}
.tabs button[aria-pressed="true"] {
  background: rgba(60, 157, 228, 0.14);
  color: #319be8;
  font-weight: 700;
}
.table-toolbar input {
  max-width: 260px;
}
.table-scroll {
  overflow: auto;
}
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 12px;
}
th,
td {
  text-align: left;
  padding: 16px 12px;
  border-bottom: 1px solid var(--line, #dae5ef);
  white-space: nowrap;
}
th {
  color: var(--muted, #65788b);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
td:first-child {
  font-weight: 600;
}
.empty {
  text-align: center;
  padding: 32px;
}
.card .table-note {
  margin: 16px 0 0;
}
.error {
  color: #d85563;
}
button:focus-visible {
  outline: 2px solid #3c9de4;
  outline-offset: 3px;
}
@media (max-width: 1100px) {
  .filters {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 700px) {
  .filters,
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .charts {
    grid-template-columns: 1fr;
  }
  .card {
    padding: 16px;
  }
  .metrics strong {
    font-size: 22px;
  }
  .card-head {
    align-items: flex-start;
  }
  .table-toolbar input {
    max-width: none;
  }
}
</style>
