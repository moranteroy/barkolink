<template>
  <section class="trip-operations">
    <header v-if="!embedded">
      <div>
        <p class="eyebrow">FERRY OPERATIONS</p>
        <h2>Trip operations</h2>
        <p>Passengers and terminal progress for one sailing.</p>
      </div>
      <button :disabled="loading || busy" @click="load">Refresh</button>
    </header>
    <div class="sailing-picker-card">
      <div class="picker-heading">
        <span class="workspace-symbol">
          <ion-icon :icon="boatOutline" aria-hidden="true" />
        </span>
        <div>
          <p class="eyebrow">SAILING WORKSPACE</p>
          <h3>{{ code ? 'Manage your sailing' : 'Select a trip to manage' }}</h3>
        </div>
      </div>
      <label class="picker" for="operations-sailing">Choose sailing<select id="operations-sailing" v-model="code" :disabled="loading || busy" @change="selectTrip">
          <option value="">Select a sailing to open its workspace</option>
          <option v-for="s in sailings" :key="s.code" :value="s.code">{{ s.code }} | {{ s.origin.name }} | {{ s.destination.name }} | {{ date(s.departureAt) }}</option>
        </select>
      </label>
      <button v-if="sailings.length < sailingTotal" :disabled="moreLoading || busy" @click="loadMoreSailings">{{ moreLoading ? 'Loading...' : 'Load older sailings' }}</button>
    </div>
    <p v-if="error" class="error message" role="alert">{{ error }}</p>
    <p v-if="notice" class="message" role="status">{{ notice }}</p>
    <p v-if="loading" class="loading-state" role="status">Loading sailing records...</p>
    <div v-if="!code && !loading && !error" class="workspace-empty">
      <div class="empty-heading">
        <span class="empty-symbol">
          <ion-icon :icon="boatOutline" aria-hidden="true" />
        </span>
        <div>
          <h3>{{ sailings.length ? 'Everything for one sailing, in one place' : 'No sailings available yet' }}</h3>
          <p>{{ sailings.length ? 'Choose a sailing above to review reservations, arrival and boarding progress.' : 'Create a trip in Trips & schedules to get started.' }}</p>
        </div>
      </div>
      <router-link v-if="!sailings.length" class="schedule-link" to="/admin/trips">Open Trips & schedules <ion-icon :icon="calendarOutline" aria-hidden="true" />
      </router-link>
      <div class="workspace-features">
        <div>
          <ion-icon :icon="ticketOutline" aria-hidden="true" />
          <strong>Reservations</strong>
          <small>Bookings and passenger tickets</small>
        </div>
        <div>
          <ion-icon :icon="scanOutline" aria-hidden="true" />
          <strong>Terminal operations</strong>
          <small>Separate arrival and boarding queues</small>
        </div>
        <div>
          <ion-icon :icon="documentTextOutline" aria-hidden="true" />
          <strong>Attendance records</strong>
          <small>Manifest, no-shows and activity</small>
        </div>
      </div>
    </div>
    <template v-if="data && !loading">
      <div class="sailing-summary">
        <div class="trip-header">
          <div>
            <div class="sailing-identity">
              <small>{{ data.sailing.code }}</small>
              <Badge :class="statusClass(data.sailing.status)" :variant="statusVariant(data.sailing.status)">{{ label(data.sailing.status) }}</Badge>
            </div>
            <h3>{{ data.sailing.origin.name }} <span class="route-arrow">&rarr;</span> {{ data.sailing.destination.name }}</h3>
            <p>{{ data.sailing.vessel.name }} <span>&middot;</span> {{ date(data.sailing.departureAt) }} <small>PH time</small>
            </p>
          </div>
          <router-link to="/admin/trips">
            <ion-icon :icon="calendarOutline" aria-hidden="true" /> Manage schedule</router-link>
        </div>
        <div class="metrics">
          <article v-for="metric in metrics" :key="metric.label">
            <small>{{ metric.label }}</small>
            <strong>{{ metric.value }}</strong>
          </article>
        </div>
      </div>
      <nav aria-label="Sailing operation tabs">
        <button v-for="name in tabs" :key="name" :class="{ active: tab === name }" :aria-pressed="tab === name" @click="tab = name">{{ name }}<span v-if="tabCount(name) !== null">{{ tabCount(name) }}</span>
        </button>
      </nav>
      <div v-if="tab === 'Overview'" class="overview">
        <div class="content-heading">
          <div>
            <p class="eyebrow">TERMINAL OVERVIEW</p>
            <h3>Passenger progress</h3>
          </div>
          <strong class="progress-value">{{ paid.length ? Math.round(boarded / paid.length * 100) : 0 }}<small>% boarded</small>
          </strong>
        </div>
        <progress aria-label="Paid passengers boarded" :value="boarded" :max="Math.max(1, paid.length)" />
        <p>{{ boarded }} of {{ paid.length }} paid passengers boarded.</p>
        <div class="stage-grid">
          <div>
            <small>Awaiting check-in</small>
            <strong>{{ arrivalQueue.length }}</strong>
          </div>
          <div>
            <small>Ready to board</small>
            <strong>{{ boardingQueue.length }}</strong>
          </div>
          <div>
            <small>Boarded</small>
            <strong>{{ boarded }}</strong>
          </div>
        </div>
        <p class="operational-note">{{ terminalNote }}</p>
        <div class="links">
          <router-link :to="`/admin/check-in?sailing=${encodeURIComponent(code)}`">
            <ion-icon :icon="scanOutline" aria-hidden="true" />
            <div>
              <strong>Check-in desk</strong>
              <small>Verify tickets and record arrival</small>
            </div>
          </router-link>
          <router-link :to="`/admin/boarding?sailing=${encodeURIComponent(code)}`">
            <ion-icon :icon="boatOutline" aria-hidden="true" />
            <div>
              <strong>Boarding desk</strong>
              <small>Confirm passengers entering the vessel</small>
            </div>
          </router-link>
          <router-link :to="`/admin/manifest?sailing=${encodeURIComponent(code)}`">
            <ion-icon :icon="documentTextOutline" aria-hidden="true" />
            <div>
              <strong>Passenger manifest</strong>
              <small>Review attendance and export CSV</small>
            </div>
          </router-link>
        </div>
        <p class="footnote">Reserved seats include unpaid bookings. Terminal queues include paid, confirmed reservations only.</p>
      </div>
      <section v-else-if="tab === 'Activity'" class="activity">
        <div class="content-heading">
          <div>
            <p class="eyebrow">AUDIT TRAIL</p>
            <h3>Sailing activity</h3>
          </div>
          <small>{{ activityEvents.length }} events | PH time</small>
        </div>
        <div v-if="!activityEvents.length" class="record-empty">
          <ion-icon :icon="timeOutline" aria-hidden="true" />
          <strong>No activity recorded</strong>
          <p>Sailing and passenger events will appear here when available.</p>
        </div>
        <div v-else class="activity-list">
          <article v-for="event in activityEvents" :key="event.id">
            <span class="event-icon">
              <ion-icon :icon="timeOutline" aria-hidden="true" />
            </span>
            <div>
              <strong>{{ activityLabel(event.action) }}</strong>
              <small v-if="['INSERT', 'UPDATE', 'DELETE'].includes(event.action)">Audit action: {{ event.action }}</small>
            </div>
            <time :datetime="event.createdAt">{{ date(event.createdAt) }}</time>
          </article>
        </div>
      </section>
      <template v-else>
        <AdminManifestExport v-if="tab === 'Manifest'" :sailing-code="code" :sailings="[{ code, origin: data.sailing.origin.name, destination: data.sailing.destination.name, vessel: data.sailing.vessel.name }]" />
        <div v-if="tab === 'No-shows'" class="reconcile">
          <div>
            <p class="eyebrow">ATTENDANCE RECONCILIATION</p>
            <h3>Record passengers who did not board</h3>
            <p>{{ reconcileHint }}</p>
            <small>{{ noShowCandidates }} eligible passengers | {{ paid.filter(p => p.noShow).length }} recorded</small>
          </div>
          <button :disabled="busy || !canReconcile || !noShowCandidates" @click="reconcile">{{ busy ? 'Reconciling...' : 'Reconcile no-shows' }}</button>
        </div>
        <section class="records-panel">
          <div class="content-heading">
            <div>
              <p class="eyebrow">{{ tab === 'Bookings' ? 'RESERVATIONS' : 'PASSENGER RECORDS' }}</p>
              <h3>{{ viewTitle }}</h3>
              <p>{{ viewDescription }}</p>
            </div>
            <span class="record-count">{{ filteredRecordsCount }} shown</span>
          </div>
          <label class="record-search">
            <ion-icon :icon="searchOutline" aria-hidden="true" />
            <input v-model="search" :placeholder="tab === 'Bookings' ? 'Search booking reference' : 'Search passenger, booking or category'" :aria-label="tab === 'Bookings' ? 'Search bookings' : 'Search passengers'" type="search" />
          </label>
          <div v-if="filteredRecordsCount" class="table-wrap">
            <table v-if="tab === 'Bookings'">
              <thead>
                <tr>
                  <th>Booking reference</th>
                  <th>Passengers</th>
                  <th>Total</th>
                  <th>Booking status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="booking in filteredBookings" :key="booking.id">
                  <td data-label="Booking reference">
                    <strong>{{ booking.reference }}</strong>
                  </td>
                  <td data-label="Passengers">{{ booking.passengerCount }}</td>
                  <td data-label="Total" class="numeric">{{ money(booking.total) }}</td>
                  <td data-label="Booking status">
                    <Badge :class="statusClass(booking.status)" :variant="statusVariant(booking.status)">{{ label(booking.status) }}</Badge>
                  </td>
                  <td data-label="Payment">
                    <Badge :class="statusClass(booking.paymentStatus)" :variant="statusVariant(booking.paymentStatus)">{{ label(booking.paymentStatus) }}</Badge>
                  </td>
                </tr>
              </tbody>
            </table>
            <table v-else>
              <thead>
                <tr>
                  <th>Passenger</th>
                  <th>Booking</th>
                  <th>Category</th>
                  <th>Ticket status</th>
                  <th>Attendance</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="person in filteredPassengers" :key="person.id">
                  <td data-label="Passenger">
                    <strong>{{ person.fullName }}</strong>
                  </td>
                  <td data-label="Booking">{{ person.booking.reference }}</td>
                  <td data-label="Category">{{ label(person.passengerType) }}</td>
                  <td data-label="Ticket status">
                    <Badge :class="statusClass(person.ticketStatus)" :variant="statusVariant(person.ticketStatus)">{{ label(person.ticketStatus) }}</Badge>
                  </td>
                  <td data-label="Attendance">
                    <span :class="['attendance', { recorded: person.boardedAt || person.checkedInAt, absent: person.noShow }]">{{ person.noShow ? 'No-show recorded' : person.boardedAt ? 'Boarded' : person.checkedInAt ? 'Checked in' : 'Awaiting arrival' }}</span>
                    <small v-if="person.boardedAt || person.checkedInAt" class="attendance-time">{{ date((person.boardedAt || person.checkedInAt)!) }}</small>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="record-empty">
            <ion-icon :icon="search ? searchOutline : tab === 'Bookings' ? ticketOutline : peopleOutline" aria-hidden="true" />
            <strong>{{ search ? 'No matching records' : emptyTitle }}</strong>
            <p>{{ search ? 'Try a different name or reference, or clear your search.' : emptyDescription }}</p>
            <button v-if="search" @click="search = ''">Clear search</button>
          </div>
        </section>
      </template>
    </template>
  </section>
</template>
<script setup lang="ts">
import { confirmAction } from "../../composables/confirmation";
import { Badge } from "@/components/ui/badge";
defineProps<{ embedded?: boolean }>();
import AdminManifestExport from "./AdminManifestExport.vue";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { IonIcon } from "@ionic/vue";
import { timeOutline, calendarOutline, scanOutline, boatOutline, documentTextOutline, ticketOutline, searchOutline, peopleOutline } from "ionicons/icons";
import { adminSailings } from "../../services/database/staff";
import {
  tripOperations,
  reconcileNoShows,
  type TripOperations,
} from "../../services/database/experience";
import { staffDatabase } from "../../services/session";
import { databaseRequestError } from "../../data/databaseErrors";
const route = useRoute(),
  router = useRouter();
const tabs = [
  "Overview",
  "Bookings",
  "Passengers",
  "Check-in",
  "Boarding",
  "Manifest",
  "No-shows",
  "Activity",
];
const tab = ref("Overview"),
  code = ref(String(route.query.sailing || "")),
  data = ref<TripOperations | null>(null);
const sailings = ref<
  Array<{
    code: string;
    departureAt: string;
    origin: { name: string };
    destination: { name: string };
  }>
>([]);
const sailingPage = ref(0),
  sailingTotal = ref(0),
  moreLoading = ref(false);
async function loadMoreSailings() {
  if (!staffDatabase || moreLoading.value) return;
  moreLoading.value = true;
  try {
    const result = await adminSailings(staffDatabase, {
      page: sailingPage.value + 1,
      pageSize: 100,
    });
    const seen = new Set(sailings.value.map((s) => s.code));
    sailings.value.push(
      ...result.data.sailings.filter((s) => !seen.has(s.code)),
    );
    sailingPage.value++;
    sailingTotal.value = result.data.totalCount || sailings.value.length;
  } catch (cause) {
    error.value = databaseRequestError(cause, "Could not load more sailings.");
  } finally {
    moreLoading.value = false;
  }
}
const loading = ref(false),
  busy = ref(false),
  error = ref(""),
  notice = ref("");
const date = (value: string) =>
  new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
function statusVariant(value: string): 'default' | 'success' | 'warning' | 'destructive' {
  if (['CANCELLED', 'EXPIRED', 'NO_SHOW', 'REFUNDED'].includes(value)) return 'destructive';
  if (['PENDING', 'UNPAID', 'DELAYED', 'REFUND_PENDING'].includes(value)) return 'warning';
  if (['CONFIRMED', 'PAID', 'COMPLETED', 'CHECKED_IN', 'BOARDED'].includes(value)) return 'success';
  return 'default';
}
const paid = computed(
  () =>
    data.value?.passengers.filter(
      (p) =>
        p.booking.status === "CONFIRMED" && p.booking.paymentStatus === "PAID",
    ) || [],
);
const activityEvents = computed(() =>
  [
    ...(data.value?.activity || []),
    ...(data.value?.passengers || []).flatMap((person) => [
      ...(person.checkedInAt
        ? [
            {
              id: "check-in-" + person.id,
              action: "CHECKED IN · " + person.fullName,
              createdAt: person.checkedInAt,
            },
          ]
        : []),
      ...(person.boardedAt
        ? [
            {
              id: "boarded-" + person.id,
              action: "BOARDED · " + person.fullName,
              createdAt: person.boardedAt,
            },
          ]
        : []),
    ]),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
);
const boarded = computed(
  () => paid.value.filter((p) => p.ticketStatus === "BOARDED").length,
);
const search = ref("");
watch(tab, () => { search.value = ""; });
const label = (value: string) => value === 'PWD' ? value : value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
const statusClass = (value: string) => ({
  'status-blue': ['ISSUED', 'SCHEDULED', 'CONFIRMED'].includes(value),
  'status-purple': ['CHECKED_IN', 'BOARDING'].includes(value),
});
const activityLabel = (value: string) => ({ INSERT: 'Record created', UPDATE: 'Record updated', DELETE: 'Record deleted' }[value]
  || (value.startsWith('CHECKED IN') ? value.replace('CHECKED IN', 'Checked in')
    : value.startsWith('BOARDED') ? value.replace('BOARDED', 'Boarded') : label(value)));
const arrivalQueue = computed(() => paid.value.filter(p => p.ticketStatus === 'ISSUED' && !p.noShow));
const boardingQueue = computed(() => paid.value.filter(p => p.ticketStatus === 'CHECKED_IN' && !p.noShow));
const noShowCandidates = computed(() => arrivalQueue.value.length + boardingQueue.value.length);
const canReconcile = computed(() => data.value?.sailing.status === 'COMPLETED' && Date.parse(data.value.sailing.departureAt) <= Date.now());
const terminalNote = computed(() => data.value?.sailing.status === 'CANCELLED'
  ? 'This sailing is cancelled. Reservations and attendance remain available for review.'
  : data.value?.sailing.status === 'COMPLETED' ? 'This sailing is completed. Review the manifest and reconcile any remaining no-shows.'
  : 'Check-in records passenger arrival. Boarding confirms that a checked-in passenger has entered the vessel.');
const reconcileHint = computed(() => data.value?.sailing.status === 'CANCELLED'
  ? 'No-show reconciliation is unavailable for cancelled sailings.'
  : !canReconcile.value ? 'Available after departure once this sailing is marked Completed in Trips & schedules.'
  : noShowCandidates.value ? 'Record paid passengers who did not board. Booking history and fares are preserved.'
  : 'All eligible passengers have been boarded or already recorded as no-shows.');
const viewTitle = computed(() => ({ Bookings: 'Sailing bookings', Passengers: 'Passenger directory', 'Check-in': 'Awaiting check-in', Boarding: 'Ready to board', Manifest: 'Paid passenger manifest', 'No-shows': 'Recorded no-shows' }[tab.value] || 'Passengers'));
const viewDescription = computed(() => ({ Bookings: 'All reservations for this sailing, including cancelled bookings.', Passengers: 'Tickets and attendance across all booking statuses.', 'Check-in': 'Step 1 · Paid passengers with issued tickets awaiting arrival verification.', Boarding: 'Step 2 · Checked-in passengers awaiting confirmation at the vessel.', Manifest: 'Passengers on paid, confirmed reservations.', 'No-shows': 'Paid passengers whose no-show attendance has been recorded.' }[tab.value] || ''));
const emptyTitle = computed(() => ({ Bookings: 'No bookings yet', 'Check-in': 'No passengers awaiting check-in', Boarding: 'No passengers ready to board', Manifest: 'No paid passengers to include', 'No-shows': 'No recorded no-shows' }[tab.value] || 'No passengers yet'));
const emptyDescription = computed(() => data.value?.sailing.status === 'CANCELLED' && ['Check-in', 'Boarding', 'Manifest', 'No-shows'].includes(tab.value)
  ? 'This sailing is cancelled. View Bookings or Passengers for its reservation history.'
  : ({ Bookings: 'Reservations will appear here when passengers book this sailing.', 'Check-in': 'Only paid, confirmed passengers with issued tickets appear in this queue.', Boarding: 'Passengers appear here after their tickets are checked in at the arrival desk.', Manifest: 'The manifest includes paid, confirmed reservations only.', 'No-shows': 'Recorded attendance will appear here after reconciliation.' }[tab.value] || 'Passenger records will appear when reservations are created.'));
function tabCount(name: string): number | null {
  return ({ Bookings: data.value?.bookings.length || 0, Passengers: data.value?.passengers.length || 0, 'Check-in': arrivalQueue.value.length, Boarding: boardingQueue.value.length, 'No-shows': paid.value.filter(p => p.noShow).length } as Record<string, number>)[name] ?? null;
}
const metrics = computed(() => [
  {
    label: "Capacity",
    value: data.value?.sailing.vessel.passengerCapacity || 0,
  },
  {
    label: "Reserved seats",
    value:
      (data.value?.sailing.vessel.passengerCapacity || 0) -
      (data.value?.sailing.availableSeats || 0),
  },
  { label: "Available", value: data.value?.sailing.availableSeats || 0 },
  {
    label: "Checked in",
    value: paid.value.filter((p) =>
      ["CHECKED_IN", "BOARDED"].includes(p.ticketStatus),
    ).length,
  },
  { label: "Boarded", value: boarded.value },
  { label: "No-shows", value: paid.value.filter((p) => p.noShow).length },
]);
const visiblePassengers = computed(() =>
  tab.value === "Passengers"
    ? data.value?.passengers || []
    : tab.value === "No-shows"
      ? paid.value.filter((p) => p.noShow)
      : tab.value === "Check-in"
        ? paid.value.filter((p) => p.ticketStatus === "ISSUED" && !p.noShow)
        : tab.value === "Boarding"
          ? paid.value.filter(
              (p) => p.ticketStatus === "CHECKED_IN" && !p.noShow,
            )
          : paid.value,
);
const matchesSearch = (value: string) => value.toLowerCase().includes(search.value.trim().toLowerCase());
const filteredBookings = computed(() => (data.value?.bookings || []).filter(b => matchesSearch(b.reference)));
const filteredPassengers = computed(() => visiblePassengers.value.filter(p => matchesSearch(`${p.fullName} ${p.booking.reference} ${label(p.passengerType)}`)));
const filteredRecordsCount = computed(() => tab.value === 'Bookings' ? filteredBookings.value.length : filteredPassengers.value.length);
async function load() {
  if (!staffDatabase || loading.value) return;
  loading.value = true;
  error.value = "";
  data.value = null;
  try {
    if (code.value) {
      data.value = (await tripOperations(staffDatabase, code.value)).data;
      if (!sailings.value.some((s) => s.code === code.value))
        sailings.value.push(data.value.sailing);
    }
  } catch (cause) {
    error.value = databaseRequestError(
      cause,
      "Could not load trip operations.",
    );
  } finally {
    loading.value = false;
  }
}
async function selectTrip() {
  notice.value = "";
  search.value = "";
  await router.replace({
    query: { ...route.query, sailing: code.value || undefined },
  });
  await load();
}
async function reconcile() {
  if (!staffDatabase || busy.value || !data.value || !canReconcile.value || !noShowCandidates.value) return;
  const eligible = paid.value.filter(
    (p) => ["ISSUED", "CHECKED_IN"].includes(p.ticketStatus) && !p.noShow,
  ).length;
  if (
    !(await confirmAction({
      title: "Record no-show attendance?",
      message: `Record ${eligible} paid, non-boarded passengers as no-shows for ${code.value}? Booking history and fares will be preserved.`,
      confirmText: "Record no-shows",
    }))
  )
    return;
  busy.value = true;
  error.value = "";
  try {
    const result = await reconcileNoShows(staffDatabase, code.value);
    await load();
    notice.value = `${result.data.marked} no-show records added.`;
  } catch (cause) {
    error.value = databaseRequestError(cause, "Could not reconcile no-shows.");
  } finally {
    busy.value = false;
  }
}
onMounted(async () => {
  if (!staffDatabase) return;
  loading.value = true;
  try {
    const result = await adminSailings(staffDatabase, { pageSize: 100 });
    sailings.value = result.data.sailings;
    sailingPage.value = 0;
    sailingTotal.value = result.data.totalCount || sailings.value.length;
  } catch (cause) {
    error.value = databaseRequestError(cause, "Could not load sailings.");
  } finally {
    loading.value = false;
  }
  if (code.value) await load();
});
</script>
<style scoped>
.trip-operations { display: grid; gap: 14px; color: var(--ink); }
.trip-operations, .trip-operations > *, .picker { min-width: 0; }
header, .trip-header, .content-heading, .picker-heading, .sailing-identity, .reconcile { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
h2, h3, p { margin: 0; }
h3 { font-size: 16px; font-weight: 700; }
p, small { color: var(--muted); font-size: 12px; line-height: 1.6; }
.eyebrow { color: var(--ocean); font-size: 9px; font-weight: 800; letter-spacing: .1em; margin-bottom: 4px; }
button, select, input { font: inherit; font-size: 12px; }
button, select, .schedule-link, .trip-header > a { min-height: 38px; border: 1px solid var(--line); border-radius: 8px; padding: 9px 12px; }
select, input { color: var(--ink); background: var(--surface-soft); min-width: 0; }
button { color: var(--ocean); background: var(--light-blue); cursor: pointer; font-weight: 600; }
button:disabled { opacity: .5; cursor: default; }
button:focus-visible, select:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
.sailing-picker-card, .sailing-summary, .workspace-empty, .overview, .records-panel, .activity, .reconcile { border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.sailing-picker-card { display: grid; grid-template-columns: minmax(180px, .65fr) minmax(0, 1.6fr); align-items: center; gap: 14px 20px; padding: 14px 18px; }
.sailing-picker-card > button { grid-column: 2; justify-self: end; }
.picker-heading { justify-content: flex-start; gap: 10px; }
.picker-heading h3 { font-size: 14px; }
.workspace-symbol, .empty-symbol, .event-icon { display: grid; place-items: center; flex: none; color: var(--ocean); background: var(--light-blue); border-radius: 10px; }
.workspace-symbol { width: 38px; height: 38px; font-size: 22px; }
.picker { display: grid; gap: 5px; color: var(--muted); font-size: 10px; font-weight: 600; }
.picker select { width: 100%; min-height: 40px; }
.workspace-empty { padding: 24px; }
.empty-heading { display: flex; align-items: center; gap: 16px; }
.empty-symbol { width: 52px; height: 52px; font-size: 29px; }
.empty-heading p { margin-top: 6px; }
.workspace-features { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--line); }
.workspace-features > div { display: grid; grid-template-columns: 24px 1fr; gap: 3px 10px; }
.workspace-features ion-icon { grid-row: span 2; color: var(--ocean); font-size: 21px; }
.workspace-features strong { font-size: 12px; }
.workspace-features small { font-size: 11px; }
.schedule-link { display: inline-flex; align-items: center; gap: 8px; margin-top: 16px; color: var(--ocean); text-decoration: none; font-size: 12px; }
.trip-header { padding: 18px; }
.sailing-identity { justify-content: flex-start; gap: 10px; }
.sailing-identity small { font-size: 11px; color: var(--ocean); font-weight: 700; }
.trip-header h3 { margin: 8px 0 6px; font-size: 20px; line-height: 1.4; }
.route-arrow { color: var(--ocean); }
.trip-header p { display: flex; flex-wrap: wrap; gap: 6px; }
.trip-header p small { font-size: 10px; }
.trip-header > a { display: inline-flex; align-items: center; gap: 7px; color: var(--ocean); background: var(--surface-soft); text-decoration: none; font-size: 11px; flex: none; }
.trip-header > a ion-icon { font-size: 16px; }
.metrics { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); border-top: 1px solid var(--line); padding: 14px 4px; background: var(--surface-soft); border-radius: 0 0 12px 12px; }
.metrics article { display: grid; gap: 5px; padding: 0 14px; border-right: 1px solid var(--line); }
.metrics article:last-child { border-right: 0; }
.metrics small { font-size: 10px; }
.metrics strong { font-size: 23px; font-variant-numeric: tabular-nums; line-height: 1.1; }
nav { display: flex; gap: 3px; overflow-x: auto; border-bottom: 1px solid var(--line); padding-bottom: 5px; }
nav button { white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: var(--muted); font-size: 11px; min-height: 38px; padding: 9px 11px; }
nav button:hover { color: var(--ink); background: var(--surface-soft); }
nav button.active { color: var(--ocean); background: var(--light-blue); }
nav button span { font-size: 9px; padding: 1px 5px; border-radius: 5px; background: var(--surface-soft); color: var(--muted); font-variant-numeric: tabular-nums; }
.overview { padding: 18px; }
.progress-value { color: var(--ocean); font-size: 25px; font-variant-numeric: tabular-nums; }
.progress-value small { font-size: 10px; margin-left: 4px; }
progress { display: block; width: 100%; height: 8px; appearance: none; margin: 16px 0 8px; border: 0; border-radius: 8px; overflow: hidden; background: var(--line); }
progress::-webkit-progress-bar { background: var(--line); border-radius: 8px; }
progress::-webkit-progress-value { background: var(--ocean); border-radius: 8px; }
progress::-moz-progress-bar { background: var(--ocean); border-radius: 8px; }
.stage-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 18px 0; }
.stage-grid > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px; border: 1px solid var(--line); border-radius: 8px; }
.stage-grid strong { font-size: 20px; font-variant-numeric: tabular-nums; }
.operational-note { padding: 10px 12px; border-left: 3px solid var(--ocean); background: var(--surface-soft); border-radius: 0 6px 6px 0; }
.links { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
.links a { display: flex; align-items: center; gap: 10px; text-decoration: none; border: 1px solid var(--line); border-radius: 8px; padding: 12px; color: var(--ocean); }
.links a:hover { background: var(--surface-soft); }
.links ion-icon { flex: none; font-size: 22px; }
.links strong, .links small { display: block; font-size: 11px; }
.links small { margin-top: 4px; font-size: 10px; }
.footnote { margin-top: 14px; font-size: 10px; }
.content-heading { padding: 16px 18px; }
.overview > .content-heading { padding: 0; }
.content-heading p:not(.eyebrow) { margin-top: 5px; font-size: 11px; }
.record-count { color: var(--ocean); background: var(--light-blue); padding: 4px 8px; border-radius: 6px; font-size: 10px; white-space: nowrap; }
.record-search { display: flex; align-items: center; gap: 8px; margin: 0 18px 14px; padding: 0 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-soft); }
.record-search ion-icon { color: var(--muted); font-size: 17px; flex: none; }
.record-search input { width: 100%; min-height: 38px; background: transparent; border: 0; }
.table-wrap { overflow: auto; max-height: 420px; border-top: 1px solid var(--line); border-radius: 0 0 12px 12px; }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th, td { text-align: left; padding: 12px 16px; border-bottom: 1px solid var(--line); font-size: 12px; }
th { position: sticky; top: 0; z-index: 1; background: var(--surface-soft); color: var(--muted); font-size: 9px; letter-spacing: .04em; text-transform: uppercase; padding-block: 13px; }
tbody tr:last-child td { border-bottom: 0; }
tbody tr:hover { background: var(--surface-soft); }
td strong { font-size: 12px; font-weight: 600; }
.numeric { font-variant-numeric: tabular-nums; white-space: nowrap; }
.attendance { color: var(--muted); font-size: 11px; }
.attendance.recorded { color: var(--ocean); }
.attendance.absent { color: var(--danger); }
.attendance-time { display: block; font-size: 10px; margin-top: 3px; }
.record-empty { display: grid; justify-items: center; text-align: center; padding: 30px 18px; gap: 8px; border-top: 1px solid var(--line); }
.record-empty > ion-icon { color: var(--ocean); font-size: 27px; margin-bottom: 2px; }
.record-empty strong { font-size: 14px; }
.record-empty p { max-width: 460px; font-size: 11px; }
.reconcile { padding: 18px; }
.reconcile p:not(.eyebrow) { margin: 7px 0; max-width: 630px; font-size: 11px; }
.reconcile small { font-size: 10px; }
.reconcile > button { flex: none; }
.activity-list { max-height: 420px; overflow: auto; border-top: 1px solid var(--line); }
.activity article { display: flex; align-items: center; gap: 12px; padding: 13px 18px; border-bottom: 1px solid var(--line); }
.activity article:last-child { border-bottom: 0; }
.event-icon { width: 32px; height: 32px; font-size: 18px; border-radius: 8px; }
.activity article strong { font-size: 12px; }
.activity article small { display: block; font-size: 10px; margin-top: 3px; }
.activity time { margin-left: auto; color: var(--muted); font-size: 10px; text-align: right; }
.message, .loading-state { padding: 12px 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
.error { color: var(--danger); }
.status-blue { color: #246fba; background: #e8f2fc; border-color: #b7d7f7; }
.status-purple { color: #7445b8; background: #f0eafa; border-color: #d6c5f0; }
:global(:root[data-theme="dark"]) .status-blue { color: #86c8ff; background: #173b59; border-color: #285478; }
:global(:root[data-theme="dark"]) .status-purple { color: #cfb2ff; background: #342748; border-color: #55406f; }
@media (max-width: 1000px) { .sailing-picker-card { grid-template-columns: 1fr; gap: 12px; } .sailing-picker-card > button { grid-column: 1; } .trip-header { align-items: flex-start; } .links small { display: none; } }
@media (max-width: 700px) {
  .workspace-empty { padding: 18px; } .workspace-features, .links { grid-template-columns: 1fr; gap: 14px; } .trip-header { flex-direction: column; padding: 16px; } .trip-header h3 { font-size: 18px; }
  .metrics { grid-template-columns: repeat(3, 1fr); gap: 16px 0; } .metrics article:nth-child(3) { border-right: 0; } .metrics strong { font-size: 21px; }
  .stage-grid { gap: 6px; } .stage-grid > div { flex-direction: column; align-items: flex-start; padding: 10px; } .stage-grid small { font-size: 10px; }
  .content-heading { align-items: flex-start; padding: 14px; } .record-search { margin-inline: 14px; } .reconcile { flex-direction: column; align-items: stretch; padding: 16px; } .activity time { max-width: 100px; }
  table, tbody, tr, td { display: block; } thead { display: none; } tr { padding: 10px 14px; border-bottom: 1px solid var(--line); } td { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 5px 12px; padding: 6px 0; border: 0; overflow-wrap: anywhere; } td::before { content: attr(data-label); font-size: 10px; color: var(--muted); margin-right: auto; } .attendance-time { width: 100%; text-align: right; }
}
</style>
