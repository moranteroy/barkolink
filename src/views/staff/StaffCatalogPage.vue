<template>
  <ion-page
    ><ion-content :fullscreen="true"
      ><div class="reference-shell design-workspace" :class="{ 'fare-directory': section === 'fares', 'passenger-directory': section === 'passengers', 'schedule-directory': section === 'trips' && role === 'ticketing', 'boarding-trips-directory': section === 'trips' && role === 'boarding' }">
        <button
          v-if="menuOpen"
          class="reference-scrim"
          aria-label="Close navigation"
          @click="menuOpen = false"
        ></button>
        <aside class="reference-sidebar sidebar" :class="{ open: menuOpen }">
          <BrandMark /><StaffNavigation
            :role="role"
            @navigate="menuOpen = false"
          />
        </aside>
        <div class="reference-main">
          <StaffWorkspaceHeader :role="role" navigation :menu-open="menuOpen" @toggle-menu="menuOpen = !menuOpen" />
          <main class="reference-content">
            <div class="reference-heading">
              <div>
                <p v-if="section === 'passengers'" class="directory-kicker">TICKETING DESK / PASSENGER RECORDS</p>
                <p v-if="section === 'trips' && role === 'ticketing'" class="directory-kicker">TICKETING DESK / SAILING SCHEDULES</p>
                <p v-if="section === 'trips' && role === 'boarding'" class="directory-kicker">BOARDING WORKSPACE / SAILINGS</p>
                <p v-if="section === 'fares'" class="directory-kicker">TICKETING DESK / FARE REFERENCE</p>
                <h1>{{ title }}</h1>
                <p>
                  {{ descriptions[section] || "Your operational workspace." }}
                </p>
              </div>
              <Button variant="outline" :disabled="loading" @click="load"><IonIcon :icon="refreshOutline" aria-hidden="true" />{{ loading ? "Refreshing..." : "Refresh" }}</Button>
            </div>
            <p v-if="error" role="alert" class="catalog-error">{{ error }}</p>
            <WeatherTripPicker v-if="section === 'trips'" :trips="trips" />
            <NoShowsPanel
              v-if="section === 'no-shows'"
              :key="refresh"
            /><template v-else
              ><form
                v-if="['trips', 'passengers'].includes(section)"
                class="reference-filters"
                @submit.prevent="
                  page = 0;
                  load();
                "
              >
                <label v-if="section === 'passengers'" class="directory-search-label" for="staff-record-search"><IonIcon :icon="searchOutline" aria-hidden="true" /> Find a passenger</label>
                <label v-if="section === 'trips'" class="directory-search-label" for="staff-record-search"><IonIcon :icon="searchOutline" aria-hidden="true" /> Find a sailing</label>
                <input
                  id="staff-record-search"
                  v-model.trim="search"
                  type="search"
                  maxlength="120"
                  :placeholder="section === 'trips' ? 'Search trip code or route' : 'Passenger name, booking reference or ticket code'"
                  aria-label="Search staff records"
                /><select
                  v-if="section === 'trips'"
                  v-model="status"
                  aria-label="Trip status"
                >
                  <option value="">All statuses</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="BOARDING">Boarding</option>
                  <option value="DELAYED">Delayed</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option></select
                ><Button type="submit" :disabled="loading"><IonIcon :icon="searchOutline" aria-hidden="true" /> Search</Button><Button v-if="(section === 'passengers' && search) || (section === 'trips' && (search || status))" type="button" variant="ghost" :disabled="loading" @click="search = ''; status = ''; page = 0; load()">{{ section === 'trips' ? 'Reset filters' : 'Clear search' }}</Button>
                <p v-if="section === 'trips'" class="directory-search-help">Departure times are in Philippine time. Seats reflect the latest loaded records.</p>
                <p v-if="section === 'passengers'" class="directory-search-help">Search all passenger records. Column filters apply to the current page.</p>
              </form>
              <section v-if="role === 'boarding' && section === 'trips'" class="trip-directory" aria-labelledby="sailing-list-title" :aria-busy="loading">
                <div class="sailing-list-heading">
                  <div><h2 id="sailing-list-title">Sailing directory</h2><p>Review departures and open a passenger manifest.</p></div>
                  <span class="sailing-count" aria-live="polite">{{ loading ? 'Loading…' : `${total.toLocaleString()} sailings` }}</span>
                </div>
                <div class="sailing-table-scroll" tabindex="0" role="region" aria-label="Sailing records">
                  <table class="sailing-table">
                    <caption class="sr-only">Sailings with departure times in Philippine time, vessel, available seats, status and passenger manifest.</caption>
                    <thead><tr><th scope="col">Route / Trip code</th><th scope="col">Departure</th><th scope="col">Vessel</th><th scope="col">Available seats</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
                    <tbody>
                      <tr v-if="loading"><td colspan="6" class="sailing-empty" role="status">Loading sailings…</td></tr>
                      <tr v-else-if="!trips.length"><td colspan="6" class="sailing-empty">{{ error ? 'Sailings unavailable. Use Refresh to try again.' : 'No sailings match your search or status filter.' }}</td></tr>
                      <tr v-for="trip in loading ? [] : trips" :key="trip.code">
                        <td data-label="Route"><div class="sailing-route"><strong>{{ trip.origin.name }} <IonIcon :icon="arrowForwardOutline" aria-hidden="true" /> {{ trip.destination.name }}</strong><small>{{ trip.code }}</small></div></td>
                        <td data-label="Departure" class="sailing-departure">{{ date(trip.departureAt) }}</td>
                        <td data-label="Vessel">{{ trip.vessel.name }}</td>
                        <td data-label="Available seats"><div class="seat-availability"><span><strong>{{ trip.availableSeats }}</strong><small> / {{ trip.vessel.passengerCapacity }}</small></span><div class="seat-track" aria-hidden="true"><i :style="{ width: `${trip.vessel.passengerCapacity > 0 ? Math.max(0, Math.min(100, trip.availableSeats / trip.vessel.passengerCapacity * 100)) : 0}%` }"></i></div></div></td>
                        <td data-label="Status"><Badge class="sailing-badge" :class="trip.status.toLowerCase()" :variant="trip.status === 'CANCELLED' ? 'destructive' : ['DELAYED', 'BOARDING'].includes(trip.status) ? 'warning' : 'default'">{{ humanize(trip.status) }}</Badge></td>
                        <td class="sailing-action"><router-link :to="{path: '/staff/boarding/manifest', query: {sailing: trip.code}}" :aria-label="`View passenger manifest for ${trip.code}`">Manifest <IonIcon :icon="arrowForwardOutline" aria-hidden="true" /></router-link></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
              <section v-else-if="section === 'fares'" class="fare-reference" aria-label="Vessel fares" :aria-busy="loading">
                <div class="fare-toolbar"><label for="fare-vessel-search"><IonIcon :icon="searchOutline" aria-hidden="true" /> Find a vessel</label><input id="fare-vessel-search" v-model.trim="fareSearch" type="search" placeholder="Search vessel name" /><button v-if="fareSearch" @click="fareSearch = ''">Clear</button><span>{{ filteredFares.length }} of {{ fares.length }} vessels</span></div>
                <p class="fare-help">Regular fares are per passenger. Accommodation charges are added to the fare.</p>
                <p v-if="loading" class="fare-empty" role="status">Loading vessel fares...</p>
                <p v-else-if="!filteredFares.length" class="fare-empty" role="status">{{ error ? 'Fares unavailable. Use Refresh to try again.' : fareSearch ? 'No vessels match your search.' : 'No vessel fares available yet.' }}</p>
                <article v-for="fare in filteredFares" v-else :key="fare.vesselName" class="vessel-fare">
                  <div class="fare-vessel"><span class="fare-ship"><IonIcon :icon="boatOutline" aria-hidden="true" /></span><h2>{{ fare.vesselName }}</h2></div>
                  <div class="base-fare"><small>Regular fare</small><strong>PHP {{ fare.regularFare.toLocaleString() }}</strong><span>per passenger</span></div>
                  <div class="fare-discounts"><h3>Passenger discounts</h3><div class="discount-list"><span v-for="discount in passengerDiscountsForSettings(fare)" :key="discount.id" class="fare-discount" :class="{ inactive: !discount.isActive }">{{ discount.name }} <b>{{ discount.percentage }}%</b><small v-if="!discount.isActive">Inactive</small></span></div><p v-if="!passengerDiscountsForSettings(fare).length">No discounts configured.</p></div>
                  <div class="fare-accommodations"><h3>Accommodation extra fare</h3><div v-for="accommodation in fare.accommodations" :key="accommodation.id" class="accommodation-charge"><span>{{ accommodation.name }}</span><b>{{ accommodation.surcharge === 0 ? 'Included' : `+ PHP ${accommodation.surcharge.toLocaleString()}` }}</b></div><span v-if="!fare.accommodations.length">Standard seating</span></div>
                </article>
                <p class="fare-help fare-footnote"><IonIcon :icon="informationCircleOutline" aria-hidden="true" /> Verify passenger eligibility before applying discounts. Final fares are calculated when booking.</p>
              </section>
              <div v-else class="catalog-table">
                <RecordsGrid
                  v-if="['trips', 'passengers', 'fares'].includes(section)"
                  :key="section"
                  :title="title"
                  :columns="gridColumns"
                  :rows="gridRows"
                  :loading="loading"
                  :density="['passengers', 'trips'].includes(section) ? 'compact' : 'comfortable'"
                  ><template #cell="{ row, index, value }"
                    ><router-link
                      v-if="
                        section === 'trips' &&
                        role === 'boarding' &&
                        index === 0
                      "
                      :to="`/staff/boarding/manifest?sailing=${encodeURIComponent(row.key)}`"
                      >{{ value }}</router-link
                    ><Badge v-else-if="index === row.statusIndex" :variant="['Cancelled', 'No show'].includes(String(value)) ? 'destructive' : ['Pending', 'Delayed', 'Boarding'].includes(String(value)) ? 'warning' : 'success'">{{ value }}</Badge><strong v-else-if="section === 'passengers' && index === 0" class="passenger-name">{{ value }}</strong><span v-else :class="{ 'passenger-code': section === 'passengers' && [1, 2].includes(index) }">{{ value }}</span></template
                  ></RecordsGrid
                >
                <div v-else class="staff-inbox">
                  <article v-for="n in inbox" :key="n.id">
                    <strong>{{ n.title }}</strong>
                    <p>{{ n.message }}</p>
                    <small>{{ date(n.createdAt) }}</small
                    ><button v-if="!n.readAt" @click="read(n.id)">
                      Mark read
                    </button>
                  </article>
                </div>
                <p
                  v-if="!recordCount && section === 'notifications'"
                  class="reference-empty"
                >
                  {{ loading ? "Loading records…" : "No records found." }}
                </p>
              </div>
<WorkspacePagination v-if="['passengers', 'trips'].includes(section) ? total > 0 : total > 30" :page="page" :total="total" :disabled="loading" @change="page = $event; load()"><span v-if="['passengers', 'trips'].includes(section)">{{ recordCount ? page * 30 + 1 : 0 }} &ndash; {{ recordCount ? page * 30 + recordCount : 0 }} of {{ total.toLocaleString() }} {{ section === 'trips' ? 'sailings' : 'passengers' }}</span></WorkspacePagination></template
            >
          </main>
        </div>
      </div></ion-content
    ></ion-page
  >
</template>
<script setup lang="ts">
import WeatherTripPicker from '../../components/shared/WeatherTripPicker.vue';
import WorkspacePagination from "../../components/shared/WorkspacePagination.vue";
import { setUnreadNotifications, clearNotificationUnread } from "../../composables/notificationUnread";
import StaffWorkspaceHeader from "../../components/staff/StaffWorkspaceHeader.vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { passengerDiscountsForSettings } from "../../data/fareSettings";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { boatOutline, informationCircleOutline, searchOutline, refreshOutline, arrowForwardOutline } from "ionicons/icons";
import { IonIcon, IonPage, IonContent, onIonViewWillEnter } from "@ionic/vue";
import BrandMark from "../../components/shared/BrandMark.vue";
import StaffNavigation from "../../components/staff/StaffNavigation.vue";
import RecordsGrid from "../../components/shared/RecordsGrid.vue";
import NoShowsPanel from "../../components/admin/NoShowsPanel.vue";
import { staffDatabase } from "../../services/session";
import {
  staffTrips,
  staffPassengers,
  staffFares,
  type WorkspaceTrip,
  type WorkspacePassenger,
  type VesselFares,
} from "../../services/database/workspaces";
import {
  myNotifications,
  markNotificationRead,
} from "../../services/database/passenger";
import { databaseRequestError } from "../../data/databaseErrors";
import { auditLabel as humanize } from "../../data/auditPresentation";
const route = useRoute(),
  role = computed(() =>
    route.path.startsWith("/staff/boarding") ? "boarding" : "ticketing",
  ),
  section = computed(() => String(route.params.section || "trips"));
const title = computed(
  () =>
    (
      ({
        trips: role.value === "boarding" ? "Active trips" : "Trips & schedules",
        passengers: "Passengers",
        fares: "Fares",
        notifications: "Notifications",
        "no-shows": "No-show passengers",
      }) as Record<string, string>
    )[section.value] || "Staff workspace",
);
const descriptions: Record<string, string> = {
  trips: "Review ferry departures, vessels, and capacity.",
  passengers: "Look up passenger reservations and ticket status.",
  fares: "View the saved vessel fares and passenger discounts.",
  "no-shows": "Review passengers who did not board completed trips.",
  notifications: "Read your account notices and operational updates.",
};
const fareSearch = ref("");
const filteredFares = computed(() => fares.value.filter(fare => fare.vesselName.toLowerCase().includes(fareSearch.value.toLowerCase())));
const trips = ref<WorkspaceTrip[]>([]),
  passengers = ref<WorkspacePassenger[]>([]),
  fares = ref<VesselFares[]>([]),
  inbox = ref<
    Array<{
      id: string;
      title: string;
      message: string;
      createdAt: string;
      readAt?: string | null;
    }>
  >([]),
  page = ref(0),
  total = ref(0),
  search = ref(""),
  status = ref(""),
  error = ref(""),
  loading = ref(false),
  menuOpen = ref(false),
  refresh = ref(0);
const gridColumns = computed(() =>
  section.value === "trips"
    ? ["Trip", "Route", "Vessel", "Departure", "Available", "Status"]
    : section.value === "passengers"
      ? ["Passenger", "Booking", "Trip", "Accommodation", "Category", "Ticket"]
      : [
          "Vessel",
          "Regular fare",
          "Passenger discounts",
          "Accommodation extra fare",
        ],
);
const gridRows = computed(() =>
  section.value === "trips"
    ? trips.value.map((s) => ({
        key: s.code,
        source: s,
        statusIndex: 5,
        sortValues: [
          undefined,
          undefined,
          undefined,
          new Date(s.departureAt).getTime(),
        ],
        cells: [
          s.code,
          s.origin.name + " to " + s.destination.name,
          s.vessel.name,
          date(s.departureAt),
          s.availableSeats + " / " + s.vessel.passengerCapacity,
          humanize(s.status),
        ],
      }))
    : section.value === "passengers"
      ? passengers.value.map((p) => ({
          key: p.id,
          source: p,
          statusIndex: 5,
          cells: [
            p.fullName,
            p.booking.reference,
            p.booking.sailing.code,
            p.booking.accommodationName || "Standard",
            humanize(p.passengerType),
            humanize(p.ticketStatus),
          ],
        }))
      : fares.value.map((f, index) => ({
          key: f.vesselName + "-" + index,
          source: f,
          cells: [
            f.vesselName,
            "PHP " + f.regularFare,
            passengerDiscountsForSettings(f)
              .map(
                (d) =>
                  d.name +
                  ": " +
                  d.percentage +
                  "%" +
                  (d.isActive ? "" : " (inactive)"),
              )
              .join("; ") || "None",
            f.accommodations
              .map((a) => a.name + ": PHP " + a.surcharge)
              .join("; ") || "Standard seating",
          ],
        })),
);
const recordCount = computed(() =>
  section.value === "trips"
    ? trips.value.length
    : section.value === "passengers"
      ? passengers.value.length
      : section.value === "fares"
        ? fares.value.length
        : inbox.value.length,
);
const date = (v: string) =>
  new Date(v).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
let request = 0;
async function load() {
  if (!staffDatabase) return;
  const token = ++request;
  loading.value = true;
  error.value = "";
  try {
    if (section.value === "no-shows") {
      refresh.value++;
      return;
    }
    if (section.value === "trips") {
      const r = await staffTrips(staffDatabase, {
        page: page.value,
        search: search.value,
        status: status.value,
      });
      if (token !== request) return;
      trips.value = r.data.sailings;
      total.value = r.data.totalCount;
    } else if (section.value === "passengers") {
      const r = await staffPassengers(staffDatabase, {
        page: page.value,
        search: search.value,
      });
      if (token !== request) return;
      passengers.value = r.data.passengers;
      total.value = r.data.totalCount;
    } else if (section.value === "fares") {
      const r = await staffFares(staffDatabase);
      if (token !== request) return;
      fares.value = r.data.fares;
      total.value = fares.value.length;
    } else {
      const r = await myNotifications(staffDatabase);
      if (token !== request) return;
      inbox.value = r.data.notifications;
      setUnreadNotifications(inbox.value);
      total.value = inbox.value.length;
    }
  } catch (e) {
    if (token === request)
      error.value = databaseRequestError(e, "Could not load staff records.");
  } finally {
    if (token === request) loading.value = false;
  }
}
async function read(id: string) {
  if (!staffDatabase) return;
  try {
    await markNotificationRead(staffDatabase, { id });
    clearNotificationUnread(id);
    await load();
  } catch (e) {
    error.value = databaseRequestError(e, "Could not mark notification read.");
  }
}

watch(section, () => {
  fareSearch.value = "";
  page.value = 0;
  search.value = "";
  status.value = "";
  void load();
});
onIonViewWillEnter(load);
</script>
<style scoped>
.boarding-trips-directory .reference-content { padding: 24px 28px 36px; }
.boarding-trips-directory .reference-heading { margin-bottom: 20px; }
.boarding-trips-directory .reference-heading h1 { font-size: 27px; margin: 5px 0; }
.boarding-trips-directory .reference-heading p:last-child { font-size: 13px; line-height: 1.6; }
.boarding-trips-directory .reference-heading > button { min-height: 44px; }
.boarding-trips-directory :deep(.weather-trip-picker) { width: 100%; max-width: none; margin: 0 0 16px; padding: 12px 16px; border-radius: 12px; }
.boarding-trips-directory :deep(.weather-trigger strong) { font-size: 12px; }
.boarding-trips-directory :deep(.weather-trigger small) { font-size: 11px; }
.boarding-trips-directory .reference-filters { display: grid; grid-template-columns: minmax(0, 1fr) 170px auto auto; gap: 10px; padding: 16px; margin: 0 0 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); align-items: center; }
.boarding-trips-directory .directory-search-label { grid-column: 1 / -1; font-size: 12px; font-weight: 650; }
.boarding-trips-directory .reference-filters input, .boarding-trips-directory .reference-filters select { min-height: 44px; width: 100%; font-family: inherit; font-size: 13px; }
.boarding-trips-directory .reference-filters button { min-height: 44px; }
.boarding-trips-directory .directory-search-help { grid-column: 1 / -1; margin: 0; font-size: 11px; line-height: 1.6; color: var(--muted); }
.boarding-trips-directory .trip-directory { display: block; border: 1px solid var(--line); border-radius: 14px 14px 0 0; background: var(--surface); overflow: hidden; }
.sailing-list-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px; }
.sailing-list-heading h2 { font-size: 18px; line-height: 1.4; margin: 0 0 5px; }
.sailing-list-heading p { font-size: 12px; color: var(--muted); margin: 0; line-height: 1.5; }
.sailing-count { flex: none; padding: 6px 10px; background: var(--light-blue); color: var(--ocean); border-radius: 20px; font-size: 11px; font-weight: 650; }
.sailing-table-scroll { max-height: 540px; overflow: auto; scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
.sailing-table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 12px; }
.sailing-table th { position: sticky; top: 0; z-index: 1; padding: 12px 16px; border-block: 1px solid var(--line); background: var(--surface-soft); color: var(--muted); font-size: 10px; font-weight: 650; letter-spacing: .5px; text-transform: uppercase; white-space: nowrap; }
.sailing-table td { padding: 16px; border-bottom: 1px solid var(--line); line-height: 1.6; vertical-align: middle; }
.sailing-table tbody tr:last-child td { border-bottom: 0; }
.sailing-table tbody tr:hover td { background: var(--surface-soft); }
.sailing-route { min-width: 180px; }
.sailing-route strong { display: block; font-size: 13px; line-height: 1.6; }
.sailing-route ion-icon { color: var(--ocean); font-size: 13px; vertical-align: middle; margin: 0 3px; }
.sailing-route small { display: block; color: var(--muted); font-size: 11px; margin-top: 4px; }
.sailing-departure { min-width: 145px; font-variant-numeric: tabular-nums; }
.seat-availability { min-width: 85px; }
.seat-availability strong { font-size: 14px; font-variant-numeric: tabular-nums; }
.seat-availability small { color: var(--muted); font-size: 11px; }
.seat-track { height: 4px; margin-top: 7px; border-radius: 10px; overflow: hidden; background: var(--line); }
.seat-track i { display: block; height: 100%; background: var(--ocean); border-radius: inherit; }
.sailing-badge { font-size: 11px; font-weight: 650; white-space: nowrap; border: 1px solid transparent; }
.sailing-badge.scheduled { color: #1d4ed8; background: #eff6ff; border-color: #bfdbfe; }
.sailing-badge.boarding { color: #6d28d9; background: #f5f3ff; border-color: #ddd6fe; }
.sailing-badge.delayed { color: #92400e; background: #fffbeb; border-color: #fde68a; }
.sailing-badge.completed { color: #166534; background: #f0fdf4; border-color: #bbf7d0; }
.sailing-badge.cancelled { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }
:global(:root[data-theme="dark"]) .sailing-badge.scheduled { color: #93c5fd; background: #172e4d; border-color: #315780; }
:global(:root[data-theme="dark"]) .sailing-badge.boarding { color: #c4b5fd; background: #30234e; border-color: #60478a; }
:global(:root[data-theme="dark"]) .sailing-badge.delayed { color: #fcd34d; background: #3c2d17; border-color: #78602b; }
:global(:root[data-theme="dark"]) .sailing-badge.completed { color: #86efac; background: #18382b; border-color: #2e674a; }
:global(:root[data-theme="dark"]) .sailing-badge.cancelled { color: #fca5a5; background: #43232c; border-color: #7f3946; }
.sailing-action a { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; color: var(--ocean); font-size: 12px; font-weight: 600; text-decoration: none; white-space: nowrap; }
.sailing-action a:hover { background: var(--light-blue); border-color: var(--ocean); }
.sailing-action a:focus-visible, .sailing-table-scroll:focus-visible { outline: 2px solid var(--ocean); outline-offset: -2px; }
.sailing-table .sailing-empty { padding: 40px 20px; text-align: center; color: var(--muted); }
.boarding-trips-directory :deep(.workspace-pagination) { margin: 0; padding: 14px 20px; border: 1px solid var(--line); border-top: 0; border-radius: 0 0 14px 14px; font-size: 12px; }
.boarding-trips-directory :deep(.workspace-pagination button) { min-height: 44px; }
@media (max-width: 1100px) {
  .boarding-trips-directory .reference-filters { grid-template-columns: minmax(0, 1fr) 150px auto; }
  .boarding-trips-directory .reference-filters button[type="button"] { grid-column: 3; }
  .sailing-table th, .sailing-table td { padding-inline: 12px; }
}
@media (max-width: 800px) {
  .boarding-trips-directory .reference-content { padding: 20px 16px 32px; }
  .boarding-trips-directory .reference-heading { flex-wrap: wrap; }
  .sailing-table-scroll { max-height: none; }
  .sailing-table, .sailing-table tbody { display: block; }
  .sailing-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .sailing-table tbody tr { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 20px; padding: 18px; border-top: 1px solid var(--line); }
  .sailing-table td { display: block; padding: 0; border: 0; min-width: 0; }
  .sailing-table td[data-label]::before { content: attr(data-label); display: block; color: var(--muted); font-size: 10px; margin-bottom: 4px; }
  .sailing-table td:first-child { grid-column: 1 / -1; }
  .sailing-table td:first-child::before { display: none; }
  .sailing-route, .sailing-departure, .seat-availability { min-width: 0; }
  .sailing-action { align-self: end; text-align: right; }
  .sailing-table .sailing-empty { grid-column: 1 / -1; }
}
@media (max-width: 580px) {
  .boarding-trips-directory .reference-filters { grid-template-columns: minmax(0, 1fr) auto; padding: 14px; }
  .boarding-trips-directory .reference-filters input { grid-column: 1 / -1; }
  .boarding-trips-directory .reference-filters button[type="button"] { grid-column: 1 / -1; justify-self: start; }
  .sailing-list-heading { padding: 16px; flex-wrap: wrap; gap: 10px; }
  .boarding-trips-directory :deep(.workspace-pagination) { padding: 14px 16px; }
}
</style>

<style scoped>
.reference-shell {
  display: flex;
  min-height: 100%;
}
.reference-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  display: flex;
  flex-direction: column;
  width: 250px;
  padding: 24px 16px;
  background: #0c2038;
  color: white;
  z-index: 30;
}
.reference-sidebar :deep(.brand-copy strong),
.reference-sidebar :deep(.brand-copy b) {
  color: white;
}
.reference-sidebar :deep(.brand-copy small) {
  color: #a2b9ce;
}
.reference-logout {
  margin-top: 15px;
  padding: 12px;
  border: 0;
  border-top: 1px solid #ffffff20;
  background: transparent;
  color: #afc5d9;
  text-align: left;
  cursor: pointer;
}
.reference-main {
  margin-left: 250px;
  width: calc(100% - 250px);
  min-width: 0;
}
.reference-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 72px;
  padding: 0 30px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}
.reference-topbar strong {
  font-size: 16px;
}
.reference-topbar a {
  font-size: 12px;
  color: var(--ocean);
  text-decoration: none;
}
.reference-content {
  padding: 32px;
  max-width: 1500px;
  margin: auto;
}
.reference-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 25px;
}
.reference-heading h1 {
  margin: 0 0 7px;
  font-size: 28px;
}
.reference-heading p {
  font-size: 12px;
  color: var(--muted);
}
button {
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--ocean);
  font-size: 12px;
  cursor: pointer;
}
.reference-filters {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}
.reference-filters input,
.reference-filters select {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--ink);
  min-width: 0;
  font-size: 12px;
}
.reference-filters input {
  flex: 1;
}
.reference-empty {
  padding: 30px;
  color: var(--muted);
  font-size: 12px;
}
.reference-menu,
.reference-scrim {
  display: none;
}
.staff-inbox article {
  padding: 20px;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}
.staff-inbox p {
  white-space: pre-wrap;
  font-size: 12px;
  line-height: 1.6;
}
.staff-inbox small {
  color: var(--muted);
}
.staff-inbox button {
  margin-left: 15px;
}
@media (max-width: 800px) {
  .reference-sidebar {
    display: none;
  }
  .reference-sidebar.open {
    display: flex;
    width: min(85vw, 300px);
  }
  .reference-main {
    width: 100%;
    margin: 0;
  }
  .reference-scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 29;
    background: #061222a8;
    border: 0;
  }
  .reference-menu {
    display: block;
  }
  .reference-topbar {
    padding: 0 18px;
  }
  .reference-content {
    padding: 26px 18px;
  }
  .reference-heading {
    align-items: start;
  }
  .reference-heading h1 {
    font-size: 24px;
  }
  .reference-filters {
    flex-wrap: wrap;
  }
  .reference-filters input {
    min-width: 100%;
  }
}

.reference-content { padding-top: 24px; }
.reference-heading { margin-bottom: 20px; }
.reference-filters { padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); gap: 10px; }
.trip-directory { display: grid; gap: 12px; }
.trip-result-count { margin: 4px 0; font-size: 12px; color: var(--muted); }
.operation-trip { padding: 18px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.trip-route { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.trip-route h2 { margin: 0; font-size: 17px; line-height: 1.5; }
.operation-trip > small { display: block; margin-top: 7px; color: var(--muted); }
.operation-trip dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 16px 0; }
.operation-trip dt { font-size: 11px; color: var(--muted); margin-bottom: 5px; }
.operation-trip dd { margin: 0; font-size: 12px; line-height: 1.6; }
.operation-trip > a { display: inline-flex; min-height: 40px; align-items: center; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; color: var(--ocean); text-decoration: none; font-size: 12px; }
@media (max-width: 600px) { .trip-route { align-items: flex-start; flex-wrap: wrap; } .operation-trip dl { grid-template-columns: minmax(0, 1fr); } .operation-trip { padding: 14px; } }


/* Compact sailing rows for scanning many departures. */
.trip-directory { gap: 7px; }
.operation-trip { display: grid; grid-template-columns: minmax(180px, 1.1fr) minmax(280px, 1.6fr) auto 76px; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; }
.trip-identity { min-width: 0; }
.trip-identity h2 { margin: 0; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
.trip-identity small { display: block; margin-top: 4px; font-size: 10px; color: var(--muted); overflow-wrap: anywhere; }
.operation-trip dl { margin: 0; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, .6fr); gap: 10px; }
.operation-trip dt { margin-bottom: 3px; font-size: 10px; }
.operation-trip dd { font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
.operation-trip > a { justify-content: center; min-height: 40px; padding: 7px 9px; font-size: 11px; }
.operation-trip .trip-status { justify-self: end; font-size: 9px; }
@media (max-width: 1100px) {
 .operation-trip { grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
 .operation-trip .trip-status { grid-column: 2; grid-row: 1; }
 .operation-trip dl { grid-column: 1; grid-row: 2; }
 .operation-trip > a { grid-column: 2; grid-row: 2; }
}
@media (max-width: 600px) {
 .operation-trip { padding: 12px; }
 .operation-trip dl { grid-column: 1 / -1; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; }
 .operation-trip > a { grid-row: 3; min-height: 36px; }
 .operation-trip dd { font-size: 10px; }
}

</style>

<style scoped>
.passenger-directory .reference-content { padding: 24px 28px 32px; }
.directory-kicker { color: var(--ocean) !important; font-size: 10px !important; font-weight: 700; letter-spacing: .1em; margin: 0 0 7px; }
.passenger-directory .reference-heading h1 { font-size: 28px; }
.passenger-directory .reference-heading button { display: inline-flex; gap: 7px; min-height: 44px; }
.passenger-directory .reference-filters { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px 10px; padding: 14px; margin-bottom: 16px; }
.directory-search-label { grid-column: 1 / -1; display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; }
.directory-search-label ion-icon { color: var(--ocean); }
.passenger-directory .reference-filters input { width: 100%; min-height: 44px; padding: 10px 12px; background: var(--surface-soft); }
.passenger-directory .reference-filters button { min-height: 44px; display: inline-flex; gap: 7px; }
.directory-search-help { grid-column: 1 / -1; margin: 0; color: var(--muted); font-size: 11px; line-height: 1.6; }
.passenger-directory .catalog-table { overflow: hidden; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.passenger-name { font-weight: 600; }
.passenger-code { font-size: 11px; }
.passenger-directory :deep(.grid-tools) { padding: 10px 12px; }
.passenger-directory :deep(.workspace-pagination) { padding: 12px 14px; border: 1px solid var(--line); border-top: 0; border-radius: 0 0 12px 12px; margin-top: 0; background: var(--surface); }
.passenger-directory :deep(.workspace-pagination button) { min-height: 44px; }
@media (max-width: 800px) { .passenger-directory .reference-content { padding: 20px 16px 28px; } }
@media (max-width: 480px) {
 .passenger-directory .reference-filters { grid-template-columns: minmax(0, 1fr) auto; padding: 12px; }
 .passenger-directory .reference-filters input { grid-column: 1 / -1; }
 .passenger-directory :deep(.grid-tools > div:last-child) { flex-wrap: wrap; }
 .passenger-directory :deep(.grid-summary) { width: 100%; }
 .passenger-directory :deep(.pagination-controls) { width: 100%; justify-content: space-between; gap: 6px; }
 .passenger-directory :deep(.pagination-position) { font-size: 10px; }
}
</style>

<style scoped>
.schedule-directory .reference-content { padding: 24px 28px 32px; }
.schedule-directory .reference-heading button { display: inline-flex; gap: 7px; min-height: 44px; }
.schedule-directory .reference-filters { display: grid; grid-template-columns: minmax(0, 1fr) 190px auto auto; padding: 14px; gap: 10px; margin-bottom: 16px; }
.schedule-directory .reference-filters input { width: 100%; min-height: 44px; background: var(--surface-soft); }
.schedule-directory .reference-filters button { display: inline-flex; gap: 7px; min-height: 44px; }
.schedule-directory .catalog-table { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--surface); }
.schedule-directory :deep(.grid-tools) { padding: 10px 12px; }
.schedule-directory :deep(.workspace-pagination) { margin-top: 0; padding: 12px 14px; border: 1px solid var(--line); border-top: 0; border-radius: 0 0 12px 12px; background: var(--surface); }
.schedule-directory :deep(.workspace-pagination button) { min-height: 44px; }
@media(max-width:1000px) { .schedule-directory .reference-filters { grid-template-columns: minmax(0, 1fr) auto; }.schedule-directory .reference-filters input { grid-column: 1 / -1; } }
@media(max-width:800px) { .schedule-directory .reference-content { padding: 20px 16px 28px; } }
@media(max-width:480px) { .schedule-directory .reference-filters { padding: 12px; }.schedule-directory :deep(.grid-tools > div:last-child) { flex-wrap: wrap; }.schedule-directory :deep(.grid-summary) { width: 100%; }.schedule-directory :deep(.pagination-controls) { width: 100%; gap: 6px; justify-content: space-between; } }
</style>

<style scoped>
.fare-directory .reference-content { padding: 24px 28px 32px; }
.fare-directory .reference-heading button { min-height: 44px; display: inline-flex; gap: 7px; }
.fare-reference { min-width: 0; }
.fare-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
.fare-toolbar label { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; }
.fare-toolbar label ion-icon { color: var(--ocean); }
.fare-toolbar input { flex: 1; min-width: 140px; min-height: 44px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); color: var(--ink); font: inherit; font-size: 12px; }
.fare-toolbar > span { color: var(--muted); font-size: 11px; }
.fare-toolbar button { min-height: 44px; }
.fare-help { color: var(--muted); font-size: 11px; line-height: 1.7; margin: 12px 0; }
.vessel-fare { display: grid; grid-template-columns: minmax(160px, 1fr) 130px minmax(220px, 1.8fr) minmax(150px, 1fr); gap: 16px; align-items: start; padding: 16px; margin-bottom: 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.fare-vessel { display: flex; align-items: center; gap: 9px; min-width: 0; }
.fare-ship { display: grid; place-items: center; flex: none; width: 32px; height: 32px; border-radius: 9px; background: var(--light-blue); color: var(--ocean); font-size: 18px; }
.fare-vessel h2 { margin: 0; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
.base-fare { display: grid; gap: 4px; }.base-fare small, .base-fare span { font-size: 10px; color: var(--muted); }.base-fare strong { font-size: 18px; color: var(--ocean); white-space: nowrap; }
.vessel-fare h3 { margin: 0 0 8px; font-size: 11px; color: var(--muted); font-weight: 500; }
.discount-list { display: flex; flex-wrap: wrap; gap: 5px; }.fare-discount { display: inline-flex; gap: 5px; align-items: center; flex-wrap: wrap; border: 1px solid var(--line); border-radius: 6px; padding: 4px 6px; font-size: 10px; background: var(--surface-soft); }.fare-discount b { color: var(--ocean); }.fare-discount.inactive { color: var(--muted); border-style: dashed; }.fare-discount small { font-size: 9px; }
.accommodation-charge { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 5px; margin-top: 6px; font-size: 11px; line-height: 1.5; }.accommodation-charge b { font-weight: 600; color: var(--ocean); }.fare-accommodations > span,.fare-discounts p { font-size: 11px; color: var(--muted); }
.fare-footnote { display: flex; align-items: flex-start; gap: 7px; }.fare-footnote ion-icon { flex: none; margin-top: 2px; color: var(--ocean); }
.fare-empty { padding: 24px; text-align: center; border: 1px dashed var(--line); border-radius: 12px; color: var(--muted); font-size: 12px; }
@media(max-width:1200px) { .vessel-fare { grid-template-columns: minmax(0, 1fr) 130px; }.fare-discounts { grid-column: 1; }.fare-accommodations { grid-column: 2; } }
@media(max-width:800px) { .fare-directory .reference-content { padding: 20px 16px 28px; } }
@media(max-width:480px) { .vessel-fare { padding: 12px; gap: 12px; grid-template-columns: minmax(0, 1fr) 100px; }.base-fare strong { font-size: 16px; }.fare-discounts, .fare-accommodations { grid-column: 1 / -1; }.fare-toolbar input { flex-basis: 100%; }.fare-toolbar > span { margin-left: auto; } }
</style>

<style scoped>
.schedule-directory .reference-heading { margin-bottom: 16px; }.schedule-directory .reference-heading h1 { font-size: 27px; }
.schedule-directory .catalog-table { border-radius: 12px; }
.schedule-directory .reference-filters { background: var(--surface); border-radius: 12px; gap: 9px; }
.schedule-directory .reference-filters input { font-size: 12px; }.schedule-directory .reference-filters select { font-size: 12px; }
@media(min-width:1180px) {
 .schedule-directory .reference-content:has(> .weather-trip-picker) { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 16px; align-items: start; }
 .schedule-directory .reference-content > .reference-heading, .schedule-directory .reference-content > .catalog-error, .schedule-directory .reference-content > .catalog-table, .schedule-directory .reference-content > :deep(.workspace-pagination) { grid-column: 1 / -1; }
 .schedule-directory .reference-content > .reference-heading { margin-bottom: 0; }
 .schedule-directory .reference-content > :deep(.weather-trip-picker) { grid-column: 1; width: 100%; max-width: 660px; margin: 0; }
 .schedule-directory .reference-content:has(> .weather-trip-picker) > .reference-filters { grid-column: 2; display: grid; grid-template-columns: minmax(0, 1fr) auto; padding: 12px; margin: 0; }
 .schedule-directory .reference-filters input { grid-column: 1 / -1; }
 .schedule-directory .reference-filters select { width: 100%; }
 .schedule-directory .reference-filters button { padding: 8px 11px; }
 .schedule-directory .reference-filters .directory-search-help { font-size: 10px; }
 .schedule-directory .reference-content > :deep(.workspace-pagination) { margin-top: -16px; }
}
</style>

<style scoped>
/* Match the weather and search panel widths throughout the schedule page. */
.schedule-directory .reference-content:has(> .weather-trip-picker) { display: block; }
.schedule-directory .reference-content > :deep(.weather-trip-picker) { width: 100%; max-width: none; margin: 12px 0 16px; }
.schedule-directory .reference-content > :deep(.weather-trip-picker .trip-weather) { max-width: 660px; justify-self: center; }
.schedule-directory .reference-content > .reference-heading { margin-bottom: 16px; }
.schedule-directory .reference-content:has(> .weather-trip-picker) > .reference-filters { width: 100%; box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 1fr) 190px auto auto; padding: 12px; margin: 0 0 16px; }
.schedule-directory .reference-content > .reference-filters input { grid-column: auto; }
.schedule-directory .reference-content > :deep(.workspace-pagination) { margin-top: 0; }
@media(max-width:1000px) {
 .schedule-directory .reference-content:has(> .weather-trip-picker) > .reference-filters { grid-template-columns: minmax(0, 1fr) auto; }
 .schedule-directory .reference-content > .reference-filters input { grid-column: 1 / -1; }
}
</style>
