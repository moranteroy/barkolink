<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <main class="search-page">
        <PassengerHeader />
        <div class="title-row">
          <div>
            <p class="kicker">AVAILABLE SAILINGS</p>
            <h1 v-if="searchRoute.from && searchRoute.to">
              {{ searchRoute.from }} <span>to</span> {{ searchRoute.to }}
            </h1>
            <h1 v-else>Available trips</h1>
            <p class="subline">
              <ion-icon :icon="calendarOutline" />
              {{ travelDate || "Upcoming departures" }} <i></i>
              {{ passengerCount }} passenger{{
                passengerCount === 1 ? "" : "s"
              }}
            </p>
          </div>
        </div>
        <div class="search-tools">
          <Button variant="outline" :aria-expanded="modifySearch" @click="modifySearch = !modifySearch">
            {{ modifySearch ? "Close search" : "Modify search" }}
          </Button>
          <ToggleGroup class="time-filters" type="single" :model-value="timeFilter" aria-label="Departure time" @update:model-value="setTimeFilter">
            <ToggleGroupItem
              v-for="filter in ['All', 'Morning', 'Afternoon', 'Evening']"
              :key="filter"
              :value="filter"
              :class="{ active: timeFilter === filter }"
            >
              {{ filter }}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <TripSearchCard
          v-if="modifySearch"
          @searched="searchAgain"
        /><AdvisoryBanner />
        <section class="summary-strip">
          <div>
            <strong>{{ sortedTrips.length }}</strong
            ><span>trips found</span>
          </div>
          <button type="button" @click="sortDescending = !sortDescending">
            Departure
            <b>{{ sortDescending ? "latest first" : "earliest first" }}</b
            ><ion-icon :icon="chevronDownOutline" />
          </button>
        </section>
        <div v-if="loading" class="trip-list" role="status" aria-label="Loading available sailings">
          <Card v-for="item in 3" :key="item" class="trip-loading"><Skeleton class="h-5 w-2/3" /><Skeleton class="h-10 w-full" /><Skeleton class="h-4 w-1/2" /></Card>
        </div>
        <p v-else-if="errorMessage" class="state-message error" role="alert">
          {{ errorMessage }}
        </p>
        <section v-else-if="sortedTrips.length" class="trip-list">
          <template v-for="(trip, index) in sortedTrips" :key="trip.id">
            <h2 v-if="route.query.all === '1' && (!index || sortedTrips[index - 1].date !== trip.date)">{{ trip.date }}</h2>
            <TripCard :trip="trip" />
          </template>
        </section>
        <section v-else class="no-trips">
          <strong>No sailings found</strong>
          <p>Try another route or travel date.</p>
          <button @click="router.push('/home')">Change search</button>
        </section>
        <div class="demo-note">
          <ion-icon :icon="informationCircleOutline" /><span
            >Fares are calculated from the selected passenger types.</span
          >
        </div>
      </main>
      <PassengerBottomNav />
    </ion-content>
  </ion-page>
</template>
<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import TripSearchCard from "../../components/passenger/TripSearchCard.vue";
import AdvisoryBanner from "../../components/passenger/AdvisoryBanner.vue";
import { databaseRequestError } from "../../data/databaseErrors";
import { IonContent, IonIcon, IonPage } from "@ionic/vue";
import {
  calendarOutline,
  chevronDownOutline,
  informationCircleOutline,
} from "ionicons/icons";
import { useRoute, useRouter } from "vue-router";
import { computed, ref } from "vue";
import { onIonViewWillEnter } from "@ionic/vue";
import PassengerHeader from "../../components/passenger/PassengerHeader.vue";
import PassengerBottomNav from "../../components/passenger/PassengerBottomNav.vue";
import TripCard from "../../components/passenger/TripCard.vue";
import { browseSailings } from "../../services/database/passenger";
import { database } from "../../services/session";
const router = useRouter();
const route = useRoute();
function readSearchRoute() {
  try {
    return JSON.parse(
      localStorage.getItem("barkolink-search-route") || "{}",
    ) as { from?: string; to?: string };
  } catch {
    return {};
  }
}
const searchRoute = ref(readSearchRoute());
const travelDate = ref(localStorage.getItem("barkolink-search-date") || "");
const travelIsoDate = ref(
  localStorage.getItem("barkolink-search-iso-date") || "",
);
const passengerCount = ref(
  Math.max(
    1,
    Math.min(
      8,
      Number(localStorage.getItem("barkolink-search-passengers")) || 1,
    ),
  ),
);
const trips = ref<
  Array<{
    id: string;
    departureAt: string;
    vessel: string;
    from: string;
    to: string;
    departure: string;
    arrival: string;
    duration: string;
    fare: string;
    available: number;
    status: string;
    date: string;
    passengerCount: number;
    regularFare: number;
    studentFare: number;
    seniorFare: number;
    childFare: number;
    pwdFare: number;
  }>
>([]);
const loading = ref(true);
const errorMessage = ref("");
const sortDescending = ref(false),
  modifySearch = ref(false),
  timeFilter = ref("All");
function setTimeFilter(value: unknown) {
  if (typeof value === "string" && ["All", "Morning", "Afternoon", "Evening"].includes(value)) timeFilter.value = value;
}
const sortedTrips = computed(() =>
  [...trips.value]
    .filter((trip) => {
      const hour = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Manila",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date(trip.departureAt)),
      );
      return (
        timeFilter.value === "All" ||
        (timeFilter.value === "Morning"
          ? hour < 12
          : timeFilter.value === "Afternoon"
            ? hour >= 12 && hour < 18
            : hour >= 18)
      );
    })
    .sort((a, b) =>
      sortDescending.value
        ? b.departureAt.localeCompare(a.departureAt)
        : a.departureAt.localeCompare(b.departureAt),
    ),
);
const dateKey = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? ""
    : new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(parsed);
};
const clock = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
async function loadTrips() {
  loading.value = true;
  errorMessage.value = "";
  searchRoute.value = route.query.all === "1" ? {} : readSearchRoute();
  travelDate.value =
    route.query.all === "1"
      ? ""
      : localStorage.getItem("barkolink-search-date") || "";
  travelIsoDate.value =
    route.query.all === "1"
      ? ""
      : localStorage.getItem("barkolink-search-iso-date") || "";
  passengerCount.value = Math.max(
    1,
    Math.min(
      8,
      Number(localStorage.getItem("barkolink-search-passengers")) || 1,
    ),
  );
  try {
    if (!database)
      throw new Error(
        "Supabase is not configured. Add the Supabase project settings to .env.local to browse live sailings.",
      );
    const result = await browseSailings(database);
    trips.value = result.data.sailings
      .filter(
        (sailing) =>
          (!searchRoute.value.from ||
            sailing.origin.city.toLowerCase() ===
              searchRoute.value.from?.toLowerCase()) &&
          (!searchRoute.value.to ||
            sailing.destination.city.toLowerCase() ===
              searchRoute.value.to?.toLowerCase()) &&
          (!travelIsoDate.value ||
            dateKey(sailing.departureAt) === travelIsoDate.value) &&
          new Date(sailing.departureAt) > new Date() &&
          sailing.availableSeats >= passengerCount.value,
      )
      .map((sailing) => ({
        id: sailing.code,
        originPortName: sailing.origin.name,
        destinationPortName: sailing.destination.name,
        departureAt: sailing.departureAt,
        vessel: sailing.vessel.name,
        from: sailing.origin.city,
        to: sailing.destination.city,
        departure: clock(sailing.departureAt),
        arrival: clock(sailing.arrivalAt),
        duration: `${Math.floor(sailing.durationMinutes / 60)}h ${sailing.durationMinutes % 60}m`,
        fare: `PHP ${sailing.regularFare.toLocaleString()}`,
        available: sailing.availableSeats,
        status: ["SCHEDULED", "AVAILABLE"].includes(sailing.status.toUpperCase())
          ? sailing.availableSeats < 20 ? "Limited" : "Available"
          : sailing.status.replaceAll("_", " "),
        date: new Date(sailing.departureAt).toLocaleDateString("en-PH", {
        timeZone: "Asia/Manila",
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        passengerCount: passengerCount.value,
        accommodations: sailing.accommodations || [],
        regularFare: sailing.regularFare,
        studentFare: sailing.studentFare,
        seniorFare: sailing.seniorFare,
        childFare: sailing.childFare,
        pwdFare: sailing.pwdFare,
        passengerDiscounts: sailing.passengerDiscounts,
        customDiscounts: sailing.customDiscounts || [],
        pregnantFare: sailing.pregnantFare ?? sailing.regularFare,
      }));
  } catch (error) {
    errorMessage.value = databaseRequestError(
      error,
      "Could not load sailings.",
    );
  } finally {
    loading.value = false;
  }
}
onIonViewWillEnter(loadTrips);
async function searchAgain() {
  modifySearch.value = false;
  await router.replace("/search");
  await loadTrips();
}
</script>
<style scoped>
.search-page {
  max-width: 850px;
  margin: 0 auto;
  padding: 26px 34px 105px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.page-header .brand-mark {
  margin: auto;
}
.back-button,
.filter-button {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: #fff;
  color: var(--ink);
  font-size: 20px;
}
.kicker {
  margin: 55px 0 7px;
  color: var(--ocean);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
}
.title-row h1 {
  margin: 0;
  font-size: 31px;
  letter-spacing: -1px;
}
.title-row h1 span {
  color: var(--muted);
  font-weight: 400;
}
.subline {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 12px;
}
.subline ion-icon {
  color: var(--ocean);
}
.subline i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #b8c0cc;
}
.summary-strip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 34px 0 13px;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--light-blue);
}
.summary-strip div {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.summary-strip strong {
  color: var(--ocean);
  font-size: 18px;
}
.summary-strip span {
  color: var(--muted);
  font-size: 11px;
}
.summary-strip button {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 11px;
}
.summary-strip b {
  color: var(--ink);
}
.summary-strip ion-icon {
  margin-left: 4px;
  vertical-align: middle;
}
.trip-list {
  display: grid;
  gap: 12px;
}
.demo-note {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 18px 4px;
  color: var(--muted);
  font-size: 10px;
}
.demo-note ion-icon {
  flex: none;
  color: var(--ocean);
  font-size: 16px;
}
@container passenger (max-width:620px) {
  .search-page {
    padding: 20px 16px 102px;
  }
  .kicker {
    margin-top: 42px;
  }
  .title-row h1 {
    font-size: 27px;
  }
  .summary-strip {
    margin-top: 25px;
  }
}
.header-spacer {
  width: 38px;
  height: 38px;
}
@container passenger (max-width:620px) {
  .search-page {
    padding: 20px 16px 105px;
  }
  .kicker {
    margin-top: 40px;
  }
  .title-row h1 {
    font-size: 27px;
  }
  .summary-strip {
    margin-top: 25px;
  }
}
.search-tools {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  flex-wrap: wrap;
  margin: 22px 0;
}
.search-tools button {
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--ocean);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.time-filters {
  display: flex;
  gap: 6px;
  overflow: auto;
}
.time-filters button.active {
  background: var(--ocean);
  color: white;
}
</style>
