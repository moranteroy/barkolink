<template>
  <ion-page
    ><ion-content :fullscreen="true"
      ><div class="reference-shell design-workspace">
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
          /><StaffLogoutButton />
        </aside>
        <div class="reference-main">
          <StaffWorkspaceHeader :role="role" :title="title" navigation :menu-open="menuOpen" @toggle-menu="menuOpen = !menuOpen" />
          <main class="reference-content">
            <div class="reference-heading">
              <div>
                <h1>{{ title }}</h1>
                <p>
                  {{ descriptions[section] || "Your operational workspace." }}
                </p>
              </div>
              <Button variant="outline" @click="load">Refresh</Button>
            </div>
            <p v-if="error" role="alert" class="catalog-error">{{ error }}</p>
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
                <input
                  v-model.trim="search"
                  type="search"
                  maxlength="120"
                  :placeholder="section === 'trips' ? 'Search trip code or route' : 'Search records'"
                  aria-label="Search staff records"
                /><select
                  v-if="section === 'trips'"
                  v-model="status"
                  aria-label="Trip status"
                >
                  <option value="">All statuses</option>
                  <option>SCHEDULED</option>
                  <option>BOARDING</option>
                  <option>DELAYED</option>
                  <option>COMPLETED</option>
                  <option>CANCELLED</option></select
                ><Button type="submit">Search</Button>
              </form>
              <section v-if="role === 'boarding' && section === 'trips'" class="trip-directory">
                <p class="trip-result-count">{{ loading ? 'Loading trips...' : `${total} matching sailings` }}</p>
                <article v-for="trip in trips" :key="trip.code" class="operation-trip">
                  <div class="trip-identity"><h2>{{ trip.origin.name }} to {{ trip.destination.name }}</h2><small>{{ trip.code }}</small></div>
                  <dl><div><dt>Departure</dt><dd>{{ date(trip.departureAt) }}</dd></div><div><dt>Vessel</dt><dd>{{ trip.vessel.name }}</dd></div><div><dt>Seats</dt><dd>{{ trip.availableSeats }} / {{ trip.vessel.passengerCapacity }}</dd></div></dl>
                  <Badge class="trip-status" :variant="trip.status === 'CANCELLED' ? 'destructive' : trip.status === 'DELAYED' ? 'warning' : 'success'">{{ humanize(trip.status) }}</Badge>
                  <router-link :to="{path: '/staff/boarding/manifest', query: {sailing: trip.code}}" aria-label="View passenger manifest">Manifest</router-link>
                </article>
                <p v-if="!loading && !trips.length" class="reference-empty">No sailings match your search or status filter.</p>
              </section>
              <div v-else class="catalog-table">
                <RecordsGrid
                  v-if="['trips', 'passengers', 'fares'].includes(section)"
                  :key="section"
                  :title="title"
                  :columns="gridColumns"
                  :rows="gridRows"
                  :loading="loading"
                  ><template #cell="{ row, index, value }"
                    ><router-link
                      v-if="
                        section === 'trips' &&
                        role === 'boarding' &&
                        index === 0
                      "
                      :to="`/staff/boarding/manifest?sailing=${encodeURIComponent(row.key)}`"
                      >{{ value }}</router-link
                    ><Badge v-else-if="index === row.statusIndex" :variant="['Cancelled', 'No show'].includes(String(value)) ? 'destructive' : ['Pending', 'Delayed', 'Boarding'].includes(String(value)) ? 'warning' : 'success'">{{ value }}</Badge><span v-else>{{ value }}</span></template
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
<WorkspacePagination v-if="total > 30" :page="page" :total="total" :disabled="loading" @change="page = $event; load()" /></template
            >
          </main>
        </div>
      </div></ion-content
    ></ion-page
  >
</template>
<script setup lang="ts">
import WorkspacePagination from "../../components/shared/WorkspacePagination.vue";
import { setUnreadNotifications, clearNotificationUnread } from "../../composables/notificationUnread";
import StaffLogoutButton from "../../components/staff/StaffLogoutButton.vue";
import StaffWorkspaceHeader from "../../components/staff/StaffWorkspaceHeader.vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { passengerDiscountsForSettings } from "../../data/fareSettings";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { IonPage, IonContent, onIonViewWillEnter } from "@ionic/vue";
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
  page.value = 0;
  search.value = "";
  status.value = "";
  void load();
});
onIonViewWillEnter(load);
</script>
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
