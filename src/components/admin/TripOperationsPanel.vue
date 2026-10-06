<template>
  <section class="trip-operations">
    <header>
      <div v-if="!embedded">
        <p class="eyebrow">FERRY OPERATIONS</p>
        <h2>Trip operations</h2>
        <p>One workspace for a sailing's passengers and terminal progress.</p>
      </div>
      <button v-if="!embedded" :disabled="loading || busy" @click="load">Refresh</button>
    </header>
    <label class="picker"
      >Choose sailing<select
        v-model="code"
        :disabled="loading || busy"
        @change="selectTrip"
      >
        <option value="">Select a sailing</option>
        <option v-for="s in sailings" :key="s.code" :value="s.code">
          {{ s.code }} · {{ s.origin.name }} → {{ s.destination.name }} ·
          {{ date(s.departureAt) }}
        </option>
      </select></label
    ><button
      v-if="sailings.length < sailingTotal"
      :disabled="moreLoading || busy"
      @click="loadMoreSailings"
    >
      {{ moreLoading ? "Loading…" : "Load older sailings" }}
    </button>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="loading">Loading sailing records…</p>
    <template v-if="data && !loading"
      ><div class="trip-header">
        <div>
          <small>{{ data.sailing.code }} · {{ data.sailing.status }}</small>
          <h3>
            {{ data.sailing.origin.name }} → {{ data.sailing.destination.name }}
          </h3>
          <p>
            {{ data.sailing.vessel.name }} ·
            {{ date(data.sailing.departureAt) }}
          </p>
        </div>
        <router-link to="/admin/trips">Manage schedule & status <ion-icon :icon="calendarOutline" aria-hidden="true" /></router-link>
      </div>
      <div class="metrics">
        <article v-for="metric in metrics" :key="metric.label">
          <small>{{ metric.label }}</small
          ><strong>{{ metric.value }}</strong>
        </article>
      </div>
      <nav aria-label="Sailing operation tabs">
        <button
          v-for="name in tabs"
          :key="name"
          :class="{ active: tab === name }"
          @click="tab = name"
        >
          {{ name }}
        </button>
      </nav>
      <div v-if="tab === 'Overview'" class="overview">
        <h3>Terminal progress</h3>
        <progress :value="boarded" :max="Math.max(1, paid.length)" />
        <p>{{ boarded }} of {{ paid.length }} paid passengers boarded.</p>
        <p>
          Reserved seats include unpaid bookings. Only paid active passengers
          can check in or board.
        </p>
        <div class="links">
          <router-link
            :to="`/admin/check-in?sailing=${encodeURIComponent(code)}`"
            >Check-in desk <ion-icon :icon="scanOutline" aria-hidden="true" /></router-link
          ><router-link
            :to="`/admin/boarding?sailing=${encodeURIComponent(code)}`"
            >Boarding desk <ion-icon :icon="boatOutline" aria-hidden="true" /></router-link
          ><router-link
            :to="`/admin/manifest?sailing=${encodeURIComponent(code)}`"
            >Manifest & export <ion-icon :icon="documentTextOutline" aria-hidden="true" /></router-link
          >
        </div>
      </div>
      <div v-else-if="tab === 'Activity'" class="activity">
        <p v-if="!activityEvents.length">
          No activity recorded for this sailing.
        </p>
        <article v-for="event in activityEvents" :key="event.id">
          <ion-icon :icon="timeOutline" />
          <div>
            <strong>{{ event.action.replaceAll("_", " ") }}</strong
            ><small>{{ date(event.createdAt) }}</small>
          </div>
        </article>
      </div>
      <div v-else-if="tab === 'Bookings'" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Passengers</th>
              <th>Total</th>
              <th>Status</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="booking in data.bookings" :key="booking.id">
              <td data-label="Reference">{{ booking.reference }}</td>
              <td data-label="Passengers">{{ booking.passengerCount }}</td>
              <td data-label="Total">
                PHP {{ booking.total.toLocaleString() }}
              </td>
              <td data-label="Status">{{ booking.status }}</td>
              <td data-label="Payment">{{ booking.paymentStatus }}</td>
            </tr>
            <tr v-if="!data.bookings.length">
              <td colspan="5">No bookings.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <template v-else
        ><AdminManifestExport
          v-if="tab === 'Manifest'"
          :sailings="[
            {
              code,
              origin: data.sailing.origin.name,
              destination: data.sailing.destination.name,
              vessel: data.sailing.vessel.name,
            },
          ]"
        />
        <div v-if="tab === 'No-shows'" class="reconcile">
          <p>
            Reconcile paid passengers who did not board after this sailing is
            completed. This records attendance and preserves fares and reserved
            seat history.
          </p>
          <button
            :disabled="
              busy ||
              data.sailing.status !== 'COMPLETED' ||
              Date.parse(data.sailing.departureAt) > Date.now()
            "
            @click="reconcile"
          >
            {{ busy ? "Reconciling…" : "Reconcile no-shows" }}</button
          ><small v-if="data.sailing.status !== 'COMPLETED'"
            >Complete the departed sailing in Trips & schedules first.</small
          >
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Passenger</th>
                <th>Booking</th>
                <th>Category</th>
                <th>Ticket</th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="person in visiblePassengers" :key="person.id">
                <td data-label="Passenger">{{ person.fullName }}</td>
                <td data-label="Booking">{{ person.booking.reference }}</td>
                <td data-label="Category">{{ person.passengerType }}</td>
                <td data-label="Ticket">{{ person.ticketStatus }}</td>
                <td data-label="Attendance">
                  {{
                    person.noShow
                      ? "NO-SHOW"
                      : person.boardedAt
                        ? "BOARDED"
                        : "NOT BOARDED"
                  }}
                </td>
              </tr>
              <tr v-if="!visiblePassengers.length">
                <td colspan="5">No passengers in this view.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </section>
</template>
<script setup lang="ts">
import { confirmAction } from "../../composables/confirmation";
defineProps<{ embedded?: boolean }>();
import AdminManifestExport from "./AdminManifestExport.vue";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { IonIcon } from "@ionic/vue";
import { timeOutline, calendarOutline, scanOutline, boatOutline, documentTextOutline } from "ionicons/icons";
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
  new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
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
  await router.replace({
    query: { ...route.query, sailing: code.value || undefined },
  });
  await load();
}
async function reconcile() {
  if (!staffDatabase || busy.value || !data.value) return;
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
.trip-operations,
.trip-operations > * {
  min-width: 0;
}
.trip-operations nav {
  max-width: 100%;
}
.picker select {
  width: 100%;
  min-width: 0;
}
.trip-operations {
  display: grid;
  gap: 20px;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
h2,
h3 {
  margin: 0;
}
p {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}
.eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--ocean);
}
.picker {
  display: grid;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
}
select {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  max-width: 100%;
}
button {
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--light-blue);
  color: var(--ocean);
  font-weight: 700;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
}
.trip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  padding: 22px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 15px;
}
.trip-header h3 {
  margin: 8px 0;
}
.trip-header small {
  color: var(--ocean);
  font-weight: 800;
}
.trip-header a,
.links a {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--ocean);
  text-decoration: none;
}
.trip-header a ion-icon, .links a ion-icon { font-size: 17px; flex: none; }
.metrics {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}
.metrics article {
  display: grid;
  gap: 10px;
  padding: 18px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 13px;
}
.metrics small {
  font-size: 10px;
  color: var(--muted);
}
.metrics strong {
  font-size: 25px;
}
nav {
  display: flex;
  gap: 8px;
  overflow: auto;
  padding-bottom: 5px;
}
nav button {
  white-space: nowrap;
  background: var(--surface);
}
nav button.active {
  background: var(--ocean);
  color: white;
}
.overview,
.reconcile {
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
}
progress {
  width: 100%;
  height: 14px;
  margin-top: 16px;
  accent-color: var(--ocean);
}
.links {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-top: 18px;
}
.activity {
  display: grid;
  gap: 12px;
}
.activity article {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 17px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
}
.activity small {
  display: block;
  margin-top: 5px;
  color: var(--muted);
  font-size: 11px;
}
.activity ion-icon {
  font-size: 24px;
  color: var(--ocean);
}
.reconcile small {
  display: block;
  margin-top: 10px;
  color: var(--muted);
}
.table-wrap {
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 14px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  font-size: 12px;
}
th {
  font-size: 10px;
  color: var(--muted);
  text-transform: uppercase;
}
.error {
  color: var(--danger);
}
@media (max-width: 900px) {
  .metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .trip-header {
    align-items: flex-start;
    flex-direction: column;
  }
  table,
  tbody,
  tr,
  td {
    display: block;
  }
  thead {
    display: none;
  }
  tr {
    padding: 12px;
    border-bottom: 1px solid var(--line);
  }
  td {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    padding: 8px 0;
    border: 0;
    overflow-wrap: anywhere;
  }
  td:before {
    content: attr(data-label);
    color: var(--muted);
    font-size: 10px;
    min-width: 80px;
  }
  td[colspan]:before {
    display: none;
  }
}
</style>
