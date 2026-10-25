<template>
  <div class="reports">
    <section class="card filters" aria-label="Report filters">
      <div class="filter-heading"><div><p class="eyebrow">REPORT SCOPE</p><h2>Filter analytics</h2></div><Button variant="ghost" :disabled="loading" @click="resetFilters"><AppIcon :icon="refreshOutline" aria-hidden="true" />Reset filters</Button></div>
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
      <p class="filter-note"><AppIcon :icon="informationCircleOutline" aria-hidden="true" />Reports use sailing departure dates in Philippine time. Select up to 366 days.</p>
    </section>
    <div v-if="error" class="card report-state error" role="alert"><AppIcon :icon="alertCircleOutline" aria-hidden="true" /><div><h3>Reports unavailable</h3><p>{{ error }}</p></div><Button variant="outline" @click="loadReports">Try again</Button></div>
    <p v-else-if="loading" class="card" role="status">
      Loading reports and analytics…
    </p>
    <template v-else-if="ready">
      <div class="report-metrics">
        <article v-for="m in metrics" :key="m.label" class="card">
          <div class="metric-top"><small>{{ m.label }}</small><span class="metric-icon" :class="m.tone"><AppIcon :icon="m.icon" aria-hidden="true" /></span></div
          ><strong>{{ m.value }}</strong
          ><span>{{ m.note }}</span>
        </article>
      </div>
      <div v-if="!filtered.length" class="card report-state"><AppIcon :icon="barChartOutline" aria-hidden="true" /><div><h3>No sailings in this report</h3><p>Try another date range, route, or vessel.</p></div></div>
      <div class="charts">
        <section class="card collection-trend" aria-label="Collection trend">
          <div class="card-head">
            <h2><AppIcon :icon="trendingUpOutline" aria-hidden="true" />Collection trend</h2>
            <Badge>{{ trend.mode }}</Badge>
          </div>
          <p>
            Paid booking amounts grouped by departure date, including paid
            cancellations before refunds.
          </p>
          <div class="trend-summary"><div><small>Collected in this period</small><strong>{{ money(totals.collectedRevenue) }}</strong></div><div><small>Peak collection</small><strong>{{ money(chart.max) }}</strong></div></div>
          <div class="collection-chart" aria-label="Collections by sailing departure date">
            <div class="chart-y-axis" aria-hidden="true"><span v-for="tick in chart.ticks" :key="tick">{{ compactMoney(tick) }}</span></div>
            <div class="chart-plot">
              <svg viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden="true">
                <line v-for="y in [20,100,180]" :key="y" x1="0" :y1="y" x2="600" :y2="y" class="chart-gridline" />
                <polygon v-if="chart.max > 0" :points="chart.area" class="chart-area" />
                <polyline v-if="chart.max > 0" :points="chart.line" class="chart-line" vector-effect="non-scaling-stroke" />
              </svg>
              <button v-for="point in chart.plotted" :key="point.date" type="button" class="chart-point" :class="{ 'zero-point': !point.revenue }" :style="{left: `${point.x / 6}%`, top: `${point.y / 2}%`}" :aria-label="`${collectionDateLabel(point.date)}: ${money(point.revenue)}`" :title="`${collectionDateLabel(point.date)}: ${money(point.revenue)}`" @focus="activePoint = point.date" @mouseenter="activePoint = point.date" @click="activePoint = point.date"></button>
              <span v-if="!chart.max" class="chart-empty">No collections in this period</span>
            </div>
            <div class="chart-x-axis" aria-hidden="true"><span v-for="label in chart.labels" :key="label">{{ collectionDateLabel(label) }}</span></div>
          </div>
          <div class="trend-selection" role="status">{{ selectedPoint ? collectionDateLabel(selectedPoint.date) : 'Select a chart point' }}<strong>{{ money(selectedPoint?.revenue || 0) }}</strong></div>
          <details class="collection-data"><summary>View collection data</summary><div class="collection-data-scroll"><table><thead><tr><th>Period</th><th>Collected (PHP)</th></tr></thead><tbody><tr v-for="point in trend.points" :key="point.date"><th>{{ collectionDateLabel(point.date) }}</th><td>{{ money(point.revenue) }}</td></tr></tbody></table></div></details>
        </section>
        <section class="card booking-card">
          <div class="card-head"><h2><AppIcon :icon="ticketOutline" aria-hidden="true" />Booking activity</h2><Badge>{{ totals.bookingCount }} reservations</Badge></div>
          <p>
            Payment and cancellation breakdown for
            {{ totals.bookingCount }} reservations.
          </p>
          <div class="distribution-list">
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
          </div>
          <div class="booking-summary"><div class="channel">
            <span
              >Online<strong>{{ totals.onlineBookings }}</strong></span
            ><span
              >Walk-in<strong>{{ totals.walkInBookings }}</strong></span
            >
          </div>
          <div class="refund-summary"><span>Refunds pending<strong>{{ money(totals.refundPending) }}</strong></span><span>Cash refunded<strong>{{ money(totals.refundedRevenue) }}</strong></span><span>Expired reservations<strong>{{ totals.expiredBookings }}</strong></span></div>
          </div>
        </section>
        <section class="card passenger-card">
          <div class="card-head"><h2><AppIcon :icon="peopleOutline" aria-hidden="true" />Passenger mix</h2><Badge>{{ totals.paidPassengers }} passengers</Badge></div>
          <p>Paid, confirmed passengers by fare category.</p>
          <div class="distribution-list">
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
          </div>
          <p class="card-note"><strong>{{ totals.paidPassengers }}</strong> paid passengers across {{ passengerMix.filter(item => item.count > 0).length }} fare categories.</p>
        </section>
        <section class="card performance-card">
          <div class="card-head"><h2><AppIcon :icon="boatOutline" aria-hidden="true" />Sailing performance</h2><Badge>{{ filtered.length }} sailings</Badge></div>
          <p>
            Seat utilization and terminal progress across the selected sailings.
          </p>
          <div class="distribution-list">
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
          <p class="card-note">
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
            :disabled="!tableRows.length || exporting"
            @click="exportReport"
          >
            <AppIcon :icon="downloadOutline" aria-hidden="true" />{{ exporting ? 'Creating PDF...' : 'Download report PDF' }}
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
          <label class="report-search"><AppIcon :icon="searchOutline" aria-hidden="true" /><input
            v-model="search"
            type="search"
            placeholder="Search this report"
            aria-label="Search report table"
          /></label>
        </div>
        <RecordsGrid :key="tab" :title="tabs[tab] + ' report details'" :columns="gridHeaders" :column-types="gridColumnTypes" :rows="gridRows" density="compact" :column-min-widths="columnWidths" :max-grid-height="360">
          <template #cell="{ row, index, value }">
            <Badge v-if="tab === 'sailings' && index === 6" :variant="value === 'COMPLETED' ? 'success' : value === 'CANCELLED' ? 'destructive' : value === 'DELAYED' ? 'warning' : 'default'">{{ String(value).charAt(0) + String(value).slice(1).toLowerCase() }}</Badge>
            <div v-else-if="index === 0" class="report-identity"><strong>{{ value }}</strong><small v-if="tab === 'sailings'">{{ row.source[1] }}</small><small v-else-if="tab === 'collections'">{{ row.source[8] }} online &middot; {{ row.source[9] }} walk-in</small></div>
            <div v-else-if="index === 1 && ['sailings','collections'].includes(tab)" class="report-identity"><span>{{ row.source[tab === 'sailings' ? 2 : 1] }}</span><small>{{ row.source[tab === 'sailings' ? 3 : 2] }}</small></div>
            <div v-else-if="index === 4 && tab !== 'collections'" class="report-identity"><strong>{{ value }}</strong><small>{{ row.source[8] }} checked in &middot; {{ row.source[9] }} boarded</small></div>
            <span v-else :class="{ numeric: index === 5 || (index === 6 && tab !== 'sailings') }">{{ index === 5 || (index === 6 && tab !== 'sailings') ? money(Number(value)) : value }}</span>
          </template>
        </RecordsGrid>
        <p class="table-note">
          PDF includes the selected report, dates, route, vessel, and search
          results, before table column filters or sorting. Collection amounts are gross paid bookings; refunds are not
          deducted.
        </p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { notifyError, notifySuccess } from '@/composables/toast';
import { computed, onBeforeUnmount, ref, watch } from "vue";
import AppIcon from "@/components/ui/icon/AppIcon.vue";
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
  reportPercentage as percent,
  reportRange,
  reportTotals,
  revenueTrend,
  shiftDay,
  type ReportSailing,
} from "../../data/reportAnalytics";
import { ticketRequestError } from "../../data/ticketActions";
import { collectionChart, collectionDateLabel } from '../../data/collectionChart';
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
const chart = computed(() => collectionChart(trend.value.points));
const activePoint = ref('');
const selectedPoint = computed(() => chart.value.plotted.find(point => point.date === activePoint.value) || chart.value.plotted.find(point => point.revenue === chart.value.max));
const compactMoney = (value: number) => 'PHP ' + new Intl.NumberFormat('en-PH', { notation:'compact', maximumFractionDigits:1 }).format(value);
const exporting = ref(false);
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
  { label: "Expired", count: totals.value.expiredBookings, color: "#91a5ba" },
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
const gridHeaders = computed(() => tab.value === 'sailings'
  ? ['Sailing','Route / vessel','Reserved / seats','Occupancy','Bookings','Collected','Status']
  : tab.value === 'collections' ? ['Sailing / channel','Route / vessel','Paid active','Unpaid active','Cancelled','Collected','Awaiting']
  : [tab.value === 'routes' ? 'Route' : 'Vessel','Sailings','Reserved / seats','Occupancy','Bookings','Collected','Awaiting']);
const gridColumnTypes = computed<('text'|'number'|'date')[]>(() => tab.value === 'sailings'
  ? ['date','text','text','number','number','number','text']
  : tab.value === 'collections' ? ['text','text','number','number','number','number','number'] : ['text','number','text','number','number','number','number']);
const columnWidths = computed(() => ['sailings','collections'].includes(tab.value) ? [160,210,100,95,100,125,110] : [210,90,110,95,100,125,110]);
const gridRows = computed(() => tableRows.value.map((source,index) => {
  const cells = tab.value === 'sailings' ? [source[0],`${source[2]} ${source[3]}`,source[4],source[5],source[6],source[7],source[10]]
    : tab.value === 'collections' ? [source[0],`${source[1]} ${source[2]}`,source[3],source[4],source[5],source[6],source[7]]
    : [source[0],source[1],`${source[2]} / ${source[3]}`,source[4],source[5],source[6],source[7]];
  return {key:`${tab.value}-${source[0]}-${index}`,cells,source,sortValues:cells.map((value,column) => tab.value === 'sailings' && column === 0
    ? Date.parse(filtered.value.find(sailing => sailing.code === source[0])?.departureAt || '')
    : typeof value === 'string' && value.endsWith('%') ? Number.parseFloat(value) : value)};
}));
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
      error.value = notifyError(ticketRequestError(
        e,
        "Unable to load reports. Try Refresh.",
      ));
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
async function exportReport() {
  if (exporting.value || !tableRows.value.length) return;
  exporting.value = true;
  const input = {
    title: `${tabs[tab.value]} report`,
    scope: [`${start.value} to ${end.value} (Philippine departure dates)`, route.value === 'ALL' ? 'All routes' : routes.value.find(item => item.key === route.value)?.label || route.value, vessel.value === 'ALL' ? 'All vessels' : vessels.value.find(item => item.key === vessel.value)?.label || vessel.value, ...(search.value ? [`Search: ${search.value}`] : [])],
    headers: [...headers.value], rows: tableRows.value.map(row => row.map((value,index) => moneyColumns.value.includes(index) ? `PHP ${Number(value).toLocaleString('en-PH')}` : value)),
    summary: metrics.value.map(metric => ({label:metric.label,value:String(metric.value).replace(/₱/g,'PHP ')})),
    note: 'Summary uses date, route and vessel filters. Table also applies report search, before column filters/sorting. Collections are gross paid bookings before refunds.',
  };
  const filename = `BarkoLink-${tab.value}-${start.value}-to-${end.value}.pdf`;
  try { const {downloadReportPdf} = await import('../../data/reportPdf');await downloadReportPdf(input,filename);notifySuccess('Report PDF downloaded.'); }
  catch(e) { notifyError(ticketRequestError(e,'Could not create the report PDF. Try again.')); }
  finally { exporting.value = false; }
}
watch(() => props.refreshToken, loadReports, { immediate: true });
onBeforeUnmount(() => {
  request++;
  emit("loading", false);
});
</script>

<style scoped>
.reports { container-type:inline-size; display:grid; gap:14px; min-width:0; font-family:var(--ion-font-family); }
.card { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:14px 16px; color:var(--ink); min-width:0; }
.card h2 { display:flex; align-items:center; gap:10px; font-size:16px; margin:0 0 8px; }
.card h2 .app-icon { color:var(--ocean); font-size:21px; flex:none; }
.card p,.report-metrics span,.report-metrics small { color:var(--muted); font-size: var(--text-label); line-height:1.6; }
.card p { margin:0 0 12px; }
.card .eyebrow { margin:0 0 6px; color:var(--ocean); font-size: var(--text-caption); font-weight:800; letter-spacing:.1em; }
.filters { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px 12px; }
.filter-heading { grid-column:1/-1; display:flex; align-items:center; justify-content:space-between; gap:16px; padding-bottom:10px; border-bottom:1px solid var(--line); }
.filter-heading h2 { margin:0; }
.filters label { display:grid; gap:8px; min-width:0; font-size: var(--text-label); font-weight:600; color:var(--muted); }
.filters .filter-note { display:flex; align-items:center; gap:8px; grid-column:1/-1; margin:0; }
.filter-note .app-icon { flex:none; font-size:17px; color:var(--ocean); }
.reports input,.reports select { width:100%; min-height:40px; border:1px solid var(--line); background:var(--surface-soft); color:var(--ink); border-radius:9px; padding:8px 12px; min-width:0; font:inherit; font-size: var(--text-label); }
.report-metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
.reports .report-metrics article.card { display:flex; flex-direction:column; gap:4px; padding:12px 14px; }
.metric-top { display:flex; align-items:center; justify-content:space-between; gap:14px; }
.metric-top small { font-weight:600; }
.report-metrics .metric-icon { display:grid; place-items:center; width:28px; height:28px; flex:none; border-radius:11px; background:var(--light-blue); color:var(--ocean); }
.metric-icon .app-icon { font-size:18px; }
.report-metrics .metric-icon.green { background:rgba(38,185,154,.12); color:#26b99a; }
.report-metrics .metric-icon.amber { background:rgba(227,171,76,.12); color:#e3ab4c; }
.report-metrics .metric-icon.purple { background:rgba(160,138,226,.12); color:#a08ae2; }
.reports .report-metrics strong { font-size:24px; line-height:1.2; letter-spacing:-.03em; font-variant-numeric:tabular-nums; }
.charts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; align-items:stretch; }
.charts > .card { display:flex; flex-direction:column; padding:20px; }
.charts .card-head { margin-bottom:8px; min-height:28px; }.charts .card-head h2 { margin:0; }.charts .card-head :deep([data-slot="badge"]) { flex:none; }
.charts > .card > p:first-of-type { min-height:42px; margin:0 0 16px; line-height:1.5; }
.distribution-list { display:grid; gap:14px; align-content:start; }.passenger-card .distribution-list { flex:1; }
.booking-summary { margin-top:auto; padding-top:18px; }
.charts .card-note { margin:16px 0 0; padding-top:14px; border-top:1px solid var(--line); font-size:var(--text-caption); line-height:1.6; }
.performance-card .card-note { margin-top:auto; }
.collection-trend .collection-data { margin-top:auto; }
@container(max-width:760px) { .charts { grid-template-columns:1fr; }.charts > .card > p:first-of-type { min-height:0; }.booking-summary { padding-top:16px; } }
.card-head { display:flex; align-items:center; justify-content:space-between; gap:16px; }
 .trend-summary { display:flex; justify-content:space-between; gap:16px; padding:14px 0; border-top:1px solid var(--line); }
.trend-summary > div { display:grid; gap:5px; }.trend-summary > div:last-child { text-align:right; }.trend-summary small { color:var(--muted); font-size:var(--text-caption); }.trend-summary strong { font-size:19px; font-variant-numeric:tabular-nums; }
.collection-chart { display:grid; grid-template-columns:60px minmax(0,1fr); min-width:0; }
.chart-y-axis { display:flex; flex-direction:column; justify-content:space-between; padding:14px 6px 14px 0; font-size:11px; color:var(--muted); font-variant-numeric:tabular-nums; }
.chart-plot { position:relative; height:200px; min-width:0; }.chart-plot svg { display:block; width:100%; height:100%; overflow:visible; }
.chart-gridline { stroke:var(--line); stroke-dasharray:4 5; vector-effect:non-scaling-stroke; }.chart-area { fill:var(--ocean); opacity:.12; }.chart-line { fill:none; stroke:var(--ocean); stroke-width:2.5; stroke-linejoin:round; }
.chart-point { position:absolute; transform:translate(-50%,-50%); width:10px; height:10px; border-radius:50%; border:2px solid var(--surface); background:var(--ocean); padding:0; cursor:pointer; }.chart-point.zero-point { width:7px; height:7px; }.chart-point:focus-visible { outline:3px solid var(--ocean); outline-offset:4px; }.chart-point:hover { box-shadow:0 0 0 4px var(--light-blue); }
.chart-x-axis { grid-column:2; display:flex; justify-content:space-between; gap:4px; color:var(--muted); font-size:11px; padding-top:5px; }.chart-empty { position:absolute; left:0; right:0; top:42%; text-align:center; color:var(--muted); font-size:var(--text-label); }
.trend-selection { display:flex; justify-content:space-between; gap:12px; margin:14px 0; padding:10px 12px; border-radius:9px; background:var(--surface-soft); color:var(--muted); font-size:var(--text-label); }.trend-selection strong { color:var(--ink); font-variant-numeric:tabular-nums; }.collection-data { border-top:1px solid var(--line); padding-top:10px; font-size:var(--text-label); }.collection-data summary { color:var(--ocean); cursor:pointer; padding:4px 0; }.collection-data-scroll { max-height:220px; overflow:auto; }
.report-identity { display:grid; gap:4px; overflow-wrap:anywhere; }.report-identity small { font-size:var(--text-caption); color:var(--muted); font-weight:400; }
.distribution { margin:0; min-width:0; }
.distribution > div:first-child { display:flex; justify-content:space-between; gap:12px; font-size: var(--text-label); margin-bottom:5px; }
.distribution small { font-weight:400; color:var(--muted); }
.track { height:7px; border-radius:6px; background:var(--line); overflow:hidden; }
.track i { height:100%; display:block; background:var(--ocean); border-radius:6px; }
.channel,.statuses,.refund-summary { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; border-top:1px solid var(--line); padding-top:10px; }
.channel span,.refund-summary span { color:var(--muted); font-size: var(--text-caption); }
.channel strong,.statuses strong,.refund-summary strong { display:block; color:var(--ink); font-size:18px; margin-top:4px; font-variant-numeric:tabular-nums; }
.refund-summary { margin-top:10px; grid-template-columns:repeat(3,minmax(0,1fr)); }
.refund-summary strong { font-size:15px; }
.statuses { grid-template-columns:repeat(3,minmax(0,1fr)); margin:18px 0 16px; border:0; padding:0; gap:10px; }
.statuses span { background:var(--surface-soft); border:1px solid var(--line); border-radius:8px; padding:8px 10px; font-size: var(--text-caption); color:var(--muted); text-transform:capitalize; }
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
.tabs button { border:0; background:transparent; color:var(--muted); padding:7px 10px; border-radius:8px; font:inherit; font-size: var(--text-label); cursor:pointer; }
.tabs button[aria-pressed="true"] { background:var(--light-blue); color:var(--ocean); font-weight:700; }
.report-search { display:flex; align-items:center; position:relative; flex:1; max-width:280px; }
.report-search .app-icon { position:absolute; left:12px; color:var(--muted); font-size:17px; pointer-events:none; }
.report-search input { padding-left:38px; }
.report-table :deep(.grid-tools) { padding:8px 16px; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.report-table :deep(.grid-tools button) { min-height:34px; padding:6px 8px; }
.report-table :deep(.desktop-grid) { padding:8px; }
.report-table :deep(.grid-cell-content) { font-size: var(--text-label); line-height:1.5; padding:7px 0; }
.numeric { font-variant-numeric:tabular-nums; font-weight:600; }
.collection-data table { width:100%; border-collapse:collapse; font-size: var(--text-label); }
.collection-data th, .collection-data td { text-align:left; padding:8px; border-bottom:1px solid var(--line); }
.collection-data td { text-align:right; }
.reports :deep(.manifest-export) { padding:14px 16px; border-radius:14px; }
.reports :deep(.manifest-export) { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); gap:16px; align-items:center; }
.reports :deep(.manifest-export > p) { grid-column:1 / -1; margin:0; }
.reports :deep(.export-heading) { margin:0; }
.reports :deep(.export-heading h2) { font-size:16px; }
.reports :deep(.export-heading p:last-child) { font-size: var(--text-label); }
.reports :deep(.export-controls) { min-width:0; }
.reports :deep(.export-controls label) { min-width:0; }
.reports :deep(.export-controls select) { min-width:0; width:100%; }
.card .table-note { margin:0; padding:12px 16px; font-size: var(--text-caption); }
.report-state { display:flex; align-items:center; gap:16px; }
.report-state > .app-icon { font-size:30px; color:var(--ocean); flex:none; }
.report-state h3 { margin:0 0 5px; font-size:16px; }
.report-state p { margin:0; }
.report-state > div { flex:1; }
.error,.error > .app-icon { color:var(--danger); }
button:focus-visible,.table-scroll:focus-visible { outline:2px solid var(--ocean); outline-offset:3px; }
@media(max-width:1000px) { .filters { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media(max-width:700px) { .reports :deep(.manifest-export) { grid-template-columns:1fr; } .report-table :deep(.grid-tools) { flex-wrap:wrap; } .reports input,.reports select { min-height:44px; font-size:16px; } .tabs button { min-height:44px; }  .filters,.report-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } .charts { grid-template-columns:1fr; } .card { padding:16px; } .report-table { padding:0; } .report-metrics strong { font-size:22px; } .card-head { align-items:flex-start; flex-wrap:wrap; } .report-search { max-width:none; min-width:180px; } .table-toolbar,.report-table > .card-head { padding:16px; } .filter-heading { align-items:flex-start; } .report-state { flex-wrap:wrap; } }
@media(max-width:420px) { .filters { grid-template-columns:1fr; } .report-metrics { gap:10px; } .report-metrics article { padding:12px; } .metric-top { align-items:flex-start; } .report-metrics .metric-icon { width:28px; height:28px; } .report-metrics strong { font-size:21px; } .refund-summary { grid-template-columns:1fr; } .tabs { width:100%; } .tabs button { flex:1; padding:10px; } }
</style>
