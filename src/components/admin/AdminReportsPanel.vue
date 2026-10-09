<template>
  <div class="reports">
    <section class="card filters" aria-label="Report filters">
      <div class="filter-heading"><div><p class="eyebrow">REPORT SCOPE</p><h2>Filter analytics</h2></div><Button variant="ghost" :disabled="loading" @click="resetFilters"><IonIcon :icon="refreshOutline" aria-hidden="true" />Reset filters</Button></div>
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
        >To<input v-model="end" type="date" @change="customDates"
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
      <p class="filter-note"><IonIcon :icon="informationCircleOutline" aria-hidden="true" />Reports use sailing departure dates in Philippine time. Select up to 366 days.</p>
    </section>
    <div v-if="error" class="card report-state error" role="alert"><IonIcon :icon="alertCircleOutline" aria-hidden="true" /><div><h3>Reports unavailable</h3><p>{{ error }}</p></div><Button variant="outline" @click="loadReports">Try again</Button></div>
    <p v-else-if="loading" class="card" role="status">
      Loading reports and analytics…
    </p>
    <template v-else-if="ready">
      <div class="report-metrics">
        <article v-for="m in metrics" :key="m.label" class="card">
          <div class="metric-top"><small>{{ m.label }}</small><span class="metric-icon" :class="m.tone"><IonIcon :icon="m.icon" aria-hidden="true" /></span></div
          ><strong>{{ m.value }}</strong
          ><span>{{ m.note }}</span>
        </article>
      </div>
      <div v-if="!filtered.length" class="card report-state"><IonIcon :icon="barChartOutline" aria-hidden="true" /><div><h3>No sailings in this report</h3><p>Try another date range, route, or vessel.</p></div></div>
      <div class="charts">
        <section class="card">
          <div class="card-head">
            <h2><IonIcon :icon="trendingUpOutline" aria-hidden="true" />Collection trend</h2>
            <Badge>{{ trend.mode }}</Badge>
          </div>
          <p>
            Paid booking amounts grouped by departure date, including paid
            cancellations before refunds.
          </p>
          <div class="trend-scale"><span>{{ money(Math.max(...trend.points.map(point => point.revenue), 0)) }}</span><span>Peak collection</span></div><div class="chart-scroll">
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
          <h2><IonIcon :icon="ticketOutline" aria-hidden="true" />Booking activity</h2>
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
          <div class="refund-summary"><span>Refunds pending<strong>{{ money(totals.refundPending) }}</strong></span><span>Cash refunded<strong>{{ money(totals.refundedRevenue) }}</strong></span><span>Expired reservations<strong>{{ totals.expiredBookings }}</strong></span></div>
        </section>
        <section class="card">
          <h2><IonIcon :icon="peopleOutline" aria-hidden="true" />Passenger mix</h2>
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
          <h2><IonIcon :icon="boatOutline" aria-hidden="true" />Sailing performance</h2>
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
              :class="status.toLowerCase()">{{ status.toLowerCase()
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
            <p class="eyebrow">REPORT EXPLORER</p><h2>Detailed reports</h2>
            <p>
              {{ tableRows.length }} records · {{ start }} through {{ end }}
            </p>
          </div>
          <Button
            class="export"
            :disabled="!tableRows.length"
            @click="exportReport"
          >
            <IonIcon :icon="downloadOutline" aria-hidden="true" />Export CSV
          </Button>
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
          <label class="report-search"><IonIcon :icon="searchOutline" aria-hidden="true" /><input
            v-model="search"
            type="search"
            placeholder="Search this report"
            aria-label="Search report table"
          /></label>
        </div>
        <RecordsGrid :key="tab" :title="tabs[tab] + ' report details'" :columns="headers" :rows="gridRows" density="compact" :column-min-widths="columnWidths" :max-grid-height="360">
          <template #cell="{ index, value }">
            <Badge v-if="tab === 'sailings' && index === 10" :variant="value === 'COMPLETED' ? 'success' : value === 'CANCELLED' ? 'destructive' : value === 'DELAYED' ? 'warning' : 'default'">{{ String(value).charAt(0) + String(value).slice(1).toLowerCase() }}</Badge>
            <strong v-else-if="index === 0">{{ value }}</strong>
            <span v-else :class="{ numeric: moneyColumns.includes(index) }">{{ moneyColumns.includes(index) ? money(Number(value)) : value }}</span>
          </template>
        </RecordsGrid>
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
import { IonIcon } from '@ionic/vue';
import { alertCircleOutline, barChartOutline, boatOutline, cashOutline, downloadOutline, informationCircleOutline, peopleOutline, refreshOutline, scanOutline, searchOutline, ticketOutline, timeOutline, trendingUpOutline } from 'ionicons/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import RecordsGrid from "../shared/RecordsGrid.vue";
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
      label: "Collected revenue", icon: cashOutline, tone: "green",
      value: money(t.collectedRevenue),
      note: "Gross paid booking amounts",
    },
    {
      label: "Awaiting payment", icon: timeOutline, tone: "amber",
      value: money(t.pendingRevenue),
      note: `${t.pendingBookings} unpaid active bookings`,
    },
    {
      label: "Reservations", icon: ticketOutline, tone: "blue",
      value: t.bookingCount,
      note: `${t.cancelledBookings} cancelled (${percent(t.cancelledBookings, t.bookingCount)}%)`,
    },
    {
      label: "Reserved seats", icon: peopleOutline, tone: "purple",
      value: t.reservedSeats,
      note: `${percent(t.reservedSeats, t.capacity)}% of ${t.capacity} sailing seats`,
    },
    {
      label: "Sailings", icon: boatOutline, tone: "blue",
      value: filtered.value.length,
      note: `${filtered.value.filter((s) => s.status === "COMPLETED").length} completed`,
    },
    {
      label: "Checked in / boarded", icon: scanOutline, tone: "green",
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
const columnWidths = computed(() => tab.value === 'sailings'
  ? [155, 165, 195, 145, 100, 115, 100, 145, 110, 100, 120]
  : tab.value === 'collections'
    ? [155, 195, 145, 115, 130, 110, 145, 145, 100, 100]
    : [195, 100, 135, 100, 115, 100, 145, 145, 110, 100]);
const gridRows = computed(() => tableRows.value.map((cells, index) => ({
  key: `${tab.value}-${cells[0]}-${index}`,
  cells,
  source: cells,
  sortValues: cells.map((value, column) => tab.value === 'sailings' && column === 1
    ? Date.parse(filtered.value.find(sailing => sailing.code === cells[0])?.departureAt || '')
    : typeof value === 'string' && value.endsWith('%') ? Number.parseFloat(value) : value),
})));
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
function resetFilters() {
  route.value = 'ALL'; vessel.value = 'ALL'; search.value = ''; period.value = 'month'; applyPeriod();
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
.reports { display:grid; gap:14px; min-width:0; font-family:var(--ion-font-family); }
.card { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:14px 16px; color:var(--ink); min-width:0; }
.card h2 { display:flex; align-items:center; gap:10px; font-size:16px; margin:0 0 8px; }
.card h2 ion-icon { color:var(--ocean); font-size:21px; flex:none; }
.card p,.report-metrics span,.report-metrics small { color:var(--muted); font-size:12px; line-height:1.6; }
.card p { margin:0 0 12px; }
.card .eyebrow { margin:0 0 6px; color:var(--ocean); font-size:10px; font-weight:800; letter-spacing:.1em; }
.filters { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px 12px; }
.filter-heading { grid-column:1/-1; display:flex; align-items:center; justify-content:space-between; gap:16px; padding-bottom:10px; border-bottom:1px solid var(--line); }
.filter-heading h2 { margin:0; }
.filters label { display:grid; gap:8px; min-width:0; font-size:12px; font-weight:600; color:var(--muted); }
.filters .filter-note { display:flex; align-items:center; gap:8px; grid-column:1/-1; margin:0; }
.filter-note ion-icon { flex:none; font-size:17px; color:var(--ocean); }
.reports input,.reports select { width:100%; min-height:40px; border:1px solid var(--line); background:var(--surface-soft); color:var(--ink); border-radius:9px; padding:8px 12px; min-width:0; font:inherit; font-size:12px; }
.report-metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
.reports .report-metrics article.card { display:flex; flex-direction:column; gap:4px; padding:12px 14px; }
.metric-top { display:flex; align-items:center; justify-content:space-between; gap:14px; }
.metric-top small { font-weight:600; }
.report-metrics .metric-icon { display:grid; place-items:center; width:28px; height:28px; flex:none; border-radius:11px; background:var(--light-blue); color:var(--ocean); }
.metric-icon ion-icon { font-size:18px; }
.report-metrics .metric-icon.green { background:rgba(38,185,154,.12); color:#26b99a; }
.report-metrics .metric-icon.amber { background:rgba(227,171,76,.12); color:#e3ab4c; }
.report-metrics .metric-icon.purple { background:rgba(160,138,226,.12); color:#a08ae2; }
.reports .report-metrics strong { font-size:24px; line-height:1.2; letter-spacing:-.03em; font-variant-numeric:tabular-nums; }
.charts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; align-items:start; }
.card-head { display:flex; align-items:center; justify-content:space-between; gap:16px; }
.trend-scale { display:flex; justify-content:space-between; gap:12px; padding-top:14px; border-top:1px solid var(--line); color:var(--muted); font-size:11px; }
.trend-scale span:first-child { color:var(--ink); font-weight:600; }
.chart-scroll { overflow-x:auto; }
.bars { height:164px; display:flex; gap:8px; padding:12px 8px 0; }
.bar-column { flex:1; min-width:12px; height:124px; display:flex; align-items:center; justify-content:flex-end; flex-direction:column; position:relative; padding:0 1px; border-bottom:1px solid var(--line); }
.bar-column > div { width:100%; max-width:38px; background:var(--ocean); border-radius:5px 5px 0 0; min-height:2px; }
.bar-column small { position:absolute; top:132px; white-space:nowrap; font-size:10px; color:var(--muted); }
.chart-foot { display:flex; flex-wrap:wrap; gap:12px; justify-content:space-between; font-size:12px; margin-top:12px; border-top:1px solid var(--line); padding-top:14px; }
.collection-data { flex-basis:100%; overflow-x:auto; }
.collection-data summary { cursor:pointer; color:var(--ocean); padding-bottom:6px; }
.distribution { margin:12px 0; }
.distribution > div:first-child { display:flex; justify-content:space-between; gap:12px; font-size:12px; margin-bottom:5px; }
.distribution small { font-weight:400; color:var(--muted); }
.track { height:6px; border-radius:6px; background:var(--line); overflow:hidden; }
.track i { height:100%; display:block; background:var(--ocean); border-radius:6px; }
.channel,.statuses,.refund-summary { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; border-top:1px solid var(--line); padding-top:10px; }
.channel span,.refund-summary span { color:var(--muted); font-size:11px; }
.channel strong,.statuses strong,.refund-summary strong { display:block; color:var(--ink); font-size:18px; margin-top:4px; font-variant-numeric:tabular-nums; }
.refund-summary { margin-top:10px; grid-template-columns:repeat(3,minmax(0,1fr)); }
.refund-summary strong { font-size:15px; }
.statuses { grid-template-columns:repeat(3,minmax(0,1fr)); margin-bottom:16px; border:0; }
.statuses span { background:var(--surface-soft); border:1px solid var(--line); border-radius:8px; padding:8px 10px; font-size:10px; color:var(--muted); text-transform:capitalize; }
.statuses .completed strong { color:#26b99a; }
.statuses .delayed strong { color:#e3ab4c; }
.statuses .cancelled strong { color:#e77b88; }
.export { white-space:nowrap; }
.report-table { padding:0; overflow:hidden; }
.report-table > .card-head { padding:14px 16px; border-bottom:1px solid var(--line); }
.report-table .card-head h2 { margin:0; }
.report-table .card-head p:not(.eyebrow) { margin:7px 0 0; }
.table-toolbar { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:12px 16px; flex-wrap:wrap; }
.tabs { display:flex; gap:4px; flex-wrap:wrap; padding:4px; background:var(--surface-soft); border:1px solid var(--line); border-radius:11px; }
.tabs button { border:0; background:transparent; color:var(--muted); padding:7px 10px; border-radius:8px; font:inherit; font-size:12px; cursor:pointer; }
.tabs button[aria-pressed="true"] { background:var(--light-blue); color:var(--ocean); font-weight:700; }
.report-search { display:flex; align-items:center; position:relative; flex:1; max-width:280px; }
.report-search ion-icon { position:absolute; left:12px; color:var(--muted); font-size:17px; pointer-events:none; }
.report-search input { padding-left:38px; }
.report-table :deep(.grid-tools) { padding:8px 16px; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.report-table :deep(.grid-tools button) { min-height:34px; padding:6px 8px; }
.report-table :deep(.desktop-grid) { padding:8px; }
.report-table :deep(.grid-cell-content) { font-size:12px; line-height:1.5; padding:7px 0; }
.numeric { font-variant-numeric:tabular-nums; font-weight:600; }
.collection-data table { width:100%; border-collapse:collapse; font-size:12px; }
.collection-data th, .collection-data td { text-align:left; padding:8px; border-bottom:1px solid var(--line); }
.collection-data td { text-align:right; }
.reports :deep(.manifest-export) { padding:14px 16px; border-radius:14px; }
.reports :deep(.manifest-export) { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); gap:16px; align-items:center; }
.reports :deep(.manifest-export > p) { grid-column:1 / -1; margin:0; }
.reports :deep(.export-heading) { margin:0; }
.reports :deep(.export-heading h2) { font-size:16px; }
.reports :deep(.export-heading p:last-child) { font-size:12px; }
.reports :deep(.export-controls) { min-width:0; }
.reports :deep(.export-controls label) { min-width:0; }
.reports :deep(.export-controls select) { min-width:0; width:100%; }
.card .table-note { margin:0; padding:12px 16px; font-size:11px; }
.report-state { display:flex; align-items:center; gap:16px; }
.report-state > ion-icon { font-size:30px; color:var(--ocean); flex:none; }
.report-state h3 { margin:0 0 5px; font-size:16px; }
.report-state p { margin:0; }
.report-state > div { flex:1; }
.error,.error > ion-icon { color:var(--danger); }
button:focus-visible,.table-scroll:focus-visible { outline:2px solid var(--ocean); outline-offset:3px; }
@media(max-width:1000px) { .filters { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media(max-width:700px) { .reports :deep(.manifest-export) { grid-template-columns:1fr; } .report-table :deep(.grid-tools) { flex-wrap:wrap; } .reports input,.reports select { min-height:44px; font-size:16px; } .tabs button { min-height:44px; }  .filters,.report-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } .charts { grid-template-columns:1fr; } .card { padding:16px; } .report-table { padding:0; } .report-metrics strong { font-size:22px; } .card-head { align-items:flex-start; flex-wrap:wrap; } .report-search { max-width:none; min-width:180px; } .table-toolbar,.report-table > .card-head { padding:16px; } .filter-heading { align-items:flex-start; } .report-state { flex-wrap:wrap; } }
@media(max-width:420px) { .filters { grid-template-columns:1fr; } .report-metrics { gap:10px; } .report-metrics article { padding:12px; } .metric-top { align-items:flex-start; } .report-metrics .metric-icon { width:28px; height:28px; } .report-metrics strong { font-size:21px; } .refund-summary { grid-template-columns:1fr; } .tabs { width:100%; } .tabs button { flex:1; padding:10px; } }
</style>
