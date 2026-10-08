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
              <span><CalendarDays :size="13" aria-hidden="true" />{{ travelDate ? `${dateEvent === 'arrival' ? 'Arriving' : 'Departing'} ${travelDate}` : 'Upcoming sailings' }}</span>
              <span><UsersRound :size="13" aria-hidden="true" />{{ passengerCount }} passenger{{
                passengerCount === 1 ? "" : "s"
              }}</span>
            </p>
          </div>
        </div>
        <div class="search-tools">
          <Button variant="outline" :aria-expanded="modifySearch" aria-controls="search-editor" @click="modifySearch ? modifySearch = false : openSearch()">
            <SlidersHorizontal :size="16" aria-hidden="true" />
            {{ modifySearch ? "Close search" : "Modify search" }}
          </Button>
          <div class="filter-panel"><div class="filter-caption"><span><Clock3 :size="13" aria-hidden="true" />Departure time</span><small>Philippine time</small></div>
          <ToggleGroup class="time-filters" type="single" :model-value="timeFilter" aria-label="Departure time" @update:model-value="setTimeFilter">
            <ToggleGroupItem
              v-for="filter in ['All', 'Morning', 'Afternoon', 'Evening']"
              :key="filter"
              :value="filter"
              :class="{ active: timeFilter === filter }"
            >
              <component :is="timeIcons[filter]" :size="16" aria-hidden="true" /><span>{{ filter }}</span><small>{{ timeRanges[filter] }}</small>
            </ToggleGroupItem>
          </ToggleGroup></div>
        </div>
        <div v-if="modifySearch" id="search-editor" ref="searchEditor" tabindex="-1"><TripSearchCard
          :navigate-on-search="false"
          @searched="searchAgain"
        /></div><AdvisoryBanner />
        <SailingCalendar v-if="!loading && !errorMessage" :sailings="calendarSailings" :selected-date="travelIsoDate" :event="dateEvent" :route-label="searchRoute.from && searchRoute.to ? `${searchRoute.from} → ${searchRoute.to}` : ''" @select="selectCalendarDate" @update:event="changeDateEvent" />
        <section class="summary-strip">
          <div role="status" aria-live="polite">
            <template v-if="loading"><Clock3 :size="15" aria-hidden="true" /><span>Checking sailings…</span></template>
            <template v-else-if="!errorMessage"><strong>{{ sortedTrips.length }}</strong><span>{{ sortedTrips.length === 1 ? 'trip' : 'trips' }} found</span></template>
            <span v-else>Schedule update unavailable</span>
          </div>
          <button type="button" :disabled="loading || !!errorMessage || sortedTrips.length < 2" :aria-label="`Sort departures: ${sortDescending ? 'latest first' : 'earliest first'}`" @click="sortDescending = !sortDescending">
            <ArrowDownUp :size="14" aria-hidden="true" />
            <b>{{ sortDescending ? "latest first" : "earliest first" }}</b
            >
          </button>
        </section>
        <div v-if="loading" class="trip-list" role="status" aria-label="Loading available sailings">
          <Card v-for="item in 3" :key="item" class="trip-loading"><Skeleton class="h-5 w-2/3" /><Skeleton class="h-10 w-full" /><Skeleton class="h-4 w-1/2" /></Card>
        </div>
        <section v-else-if="errorMessage" class="state-message error" role="alert"><span class="state-icon error-icon"><TriangleAlert :size="28" aria-hidden="true" /></span><h2>Schedules unavailable</h2><p>{{ errorMessage }}</p><button type="button" class="state-primary" @click="loadTrips"><RefreshCw :size="15" aria-hidden="true" />Try again</button></section>
        <section v-else-if="sortedTrips.length" class="trip-list">
          <template v-for="(trip, index) in sortedTrips" :key="trip.id">
            <h2 v-if="route.query.all === '1' && (!index || sortedTrips[index - 1].date !== trip.date)"><ion-icon :icon="calendarOutline" aria-hidden="true" />{{ trip.date }}</h2>
            <TripCard :trip="trip" />
          </template>
        </section>
        <section v-else class="no-trips">
          <span class="state-icon"><Ship :size="34" aria-hidden="true" /></span>
          <span class="empty-eyebrow">Plan another crossing</span>
          <h2>{{ dateTrips.length && timeFilter !== 'All' ? `No ${timeFilter.toLowerCase()} sailings` : 'No sailings found' }}</h2>
          <p>{{ dateTrips.length && timeFilter !== 'All' ? 'There are sailings at other times for this search. Try a different departure time.' : calendarSailings.length ? 'Choose a marked day in the calendar above to see other scheduled sailings for this route.' : searchRoute.from || travelDate ? 'No upcoming sailings match this route and passenger count. Try another route or check again later.' : 'No upcoming sailings are listed right now. Check again later or try another route.' }}</p>
          <div class="empty-actions"><button v-if="dateTrips.length && timeFilter !== 'All'" type="button" class="state-primary" @click="timeFilter = 'All'"><Clock3 :size="15" aria-hidden="true" />Show all times</button><button v-else type="button" class="state-primary" @click="openSearch"><SlidersHorizontal :size="15" aria-hidden="true" />Change search</button><button v-if="searchRoute.from || searchRoute.to || travelDate" type="button" class="state-secondary" @click="browseAll">Browse all sailings<ArrowRight :size="14" aria-hidden="true" /></button></div>
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
import { calendarOutline, informationCircleOutline } from "ionicons/icons";
import { CalendarDays, UsersRound, SlidersHorizontal, Clock3, Sunrise, Sun, Moon, Ship, ArrowDownUp, ArrowRight, TriangleAlert, RefreshCw } from '@lucide/vue';
import { useRoute, useRouter } from "vue-router";
import { computed, ref, nextTick } from "vue";
import { onIonViewWillEnter } from "@ionic/vue";
import PassengerHeader from "../../components/passenger/PassengerHeader.vue";
import PassengerBottomNav from "../../components/passenger/PassengerBottomNav.vue";
import TripCard from "../../components/passenger/TripCard.vue";
import SailingCalendar from '../../components/passenger/SailingCalendar.vue';
import type { ScheduleEvent } from '../../data/sailingCalendar';
import { browseSailings, type BrowseSailingsData } from "../../services/database/passenger";
import { database } from "../../services/session";
const router = useRouter();
const route = useRoute();
const dateEvent = ref<ScheduleEvent>('departure');
const calendarSailings = ref<BrowseSailingsData['sailings']>([]);
const searchEditor = ref<HTMLElement>();
const timeIcons: Record<string, typeof Clock3> = { All: Clock3, Morning: Sunrise, Afternoon: Sun, Evening: Moon };
const timeRanges: Record<string, string> = { All: 'Any time', Morning: 'Before noon', Afternoon: '12–6 PM', Evening: 'After 6 PM' };
async function openSearch() {
  modifySearch.value = true;
  await nextTick();
  searchEditor.value?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  const picker = searchEditor.value?.querySelector<HTMLElement>('[role="combobox"]:not(:disabled)');
  (picker || searchEditor.value)?.focus({ preventScroll: true });
}
async function browseAll() {
  timeFilter.value = 'All'; sortDescending.value = false; modifySearch.value = false;
  await router.replace('/trips?all=1');
  await loadTrips();
}
async function selectCalendarDate(date: string) {
  travelIsoDate.value = date;
  travelDate.value = date ? new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }) : '';
  timeFilter.value = 'All'; modifySearch.value = false;
  if (date && dateEvent.value === 'departure') {
    localStorage.setItem('barkolink-search-iso-date', date);
    localStorage.setItem('barkolink-search-date', travelDate.value);
    localStorage.setItem('barkolink-search-route', JSON.stringify(searchRoute.value));
  } else if (!date) {
    localStorage.removeItem('barkolink-search-iso-date');
    localStorage.removeItem('barkolink-search-date');
  }
  await router.replace({ path: '/trips', query: { ...route.query, source: route.query.source || 'calendar', from: searchRoute.value.from, to: searchRoute.value.to, date: date || undefined, event: dateEvent.value } });
}
async function changeDateEvent(event: ScheduleEvent) {
  dateEvent.value = event; timeFilter.value = 'All';
  await selectCalendarDate(travelIsoDate.value);
}
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
    arrivalAt: string;
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
const dateTrips = computed(() => trips.value.filter(trip => !travelIsoDate.value || dateKey(dateEvent.value === 'arrival' ? trip.arrivalAt : trip.departureAt) === travelIsoDate.value));
const sortedTrips = computed(() =>
  [...dateTrips.value]
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
  calendarSailings.value = [];
  searchRoute.value = route.query.all === "1" ? {} : readSearchRoute();
  travelDate.value =
    route.query.all === "1"
      ? ""
      : localStorage.getItem("barkolink-search-date") || "";
  travelIsoDate.value =
    route.query.all === "1"
      ? ""
      : localStorage.getItem("barkolink-search-iso-date") || "";
  const fromAssistant = route.query.source === 'assistant';
  const fromShortcut = fromAssistant || route.query.source === 'frequent-route' || route.query.source === 'calendar';
  dateEvent.value = fromShortcut && route.query.event === 'arrival' ? 'arrival' : 'departure';
  const queryString = (key: string) => typeof route.query[key] === 'string' ? String(route.query[key]).slice(0, 80) : '';
  if (fromShortcut) {
    searchRoute.value = { from: queryString('from'), to: queryString('to') };
    const requestedDate = queryString('date');
    travelIsoDate.value = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && dateKey(`${requestedDate}T00:00:00+08:00`) === requestedDate ? requestedDate : '';
    travelDate.value = travelIsoDate.value ? new Date(`${travelIsoDate.value}T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }) : '';
  }
  const matchesCity = (city: string, filter?: string) => !filter || (fromAssistant ? city.toLowerCase().replace(/\s+city$/, '').includes(filter.trim().toLowerCase().replace(/\s+city$/, '')) : city.toLowerCase() === filter.toLowerCase());
  passengerCount.value = Math.max(
    1,
    Math.min(
      8,
      Number(localStorage.getItem("barkolink-search-passengers")) || 1,
    ),
  );
  if (fromAssistant) passengerCount.value = 1;
  try {
    if (!database)
      throw new Error(
        "Schedules are unavailable right now. Please try again later.",
      );
    const result = await browseSailings(database);
    calendarSailings.value = result.data.sailings
      .filter(
        (sailing) =>
          matchesCity(sailing.origin.city, searchRoute.value.from) &&
          matchesCity(sailing.destination.city, searchRoute.value.to) &&
          ['SCHEDULED', 'AVAILABLE', 'BOARDING', 'DELAYED'].includes(sailing.status.toUpperCase()) &&
          new Date(sailing.departureAt) > new Date() &&
          sailing.availableSeats >= passengerCount.value,
      );
    trips.value = calendarSailings.value.map((sailing) => ({
        id: sailing.code,
        originPortName: sailing.origin.name,
        destinationPortName: sailing.destination.name,
        departureAt: sailing.departureAt,
        arrivalAt: sailing.arrivalAt,
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
onIonViewWillEnter(() => {
  timeFilter.value = "All";
  sortDescending.value = false;
  modifySearch.value = false;
  void loadTrips();
});
async function searchAgain() {
  modifySearch.value = false;
  timeFilter.value = "All";
  sortDescending.value = false;
  await router.replace("/trips");
  await loadTrips();
}
</script>
<style scoped>
.search-page { width:100%; max-width:850px; margin:0 auto; padding:20px 16px calc(108px + env(safe-area-inset-bottom)); color:var(--ink); }
.title-row { margin-top:24px; }.kicker { margin:0 0 8px; color:var(--ocean); font-size:10px; font-weight:750; letter-spacing:.1em; }.title-row h1 { margin:0; font-size:26px; line-height:1.3; letter-spacing:-.7px; overflow-wrap:anywhere; }.title-row h1 span { color:var(--muted); font-size:.7em; font-weight:400; }
.subline { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0 0; font-size:11px; color:var(--muted); }.subline > span { display:flex; align-items:center; gap:6px; padding:6px 8px; border:1px solid var(--line); border-radius:7px; background:var(--surface); }.subline svg { color:var(--ocean); flex-shrink:0; }
.search-tools { display:grid; gap:14px; margin:20px 0 16px; }.search-tools > button { justify-self:start; display:flex; align-items:center; gap:7px; min-height:44px; padding:10px 13px; border:1px solid var(--line); border-radius:10px; background:var(--surface); color:var(--ink); font-size:12px; font-weight:650; cursor:pointer; }.search-tools > button svg { color:var(--ocean); }
.filter-panel { padding:12px; border:1px solid var(--line); border-radius:14px; background:var(--surface); }.filter-caption { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; color:var(--muted); }.filter-caption span { display:flex; align-items:center; gap:6px; font-size:10px; font-weight:650; }.filter-caption svg { color:var(--ocean); }.filter-caption small { font-size:9px; }
.time-filters { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:5px; width:100%; }.time-filters button { display:flex; flex-direction:column; justify-content:center; align-items:center; gap:5px; min-width:0; min-height:73px; padding:9px 2px; border:1px solid transparent; border-radius:10px; background:var(--surface-soft); color:var(--muted); font:inherit; font-size:10px; font-weight:650; cursor:pointer; transition:background .18s; }.time-filters small { font-size:8px; font-weight:400; }.time-filters svg { color:var(--ocean); }.time-filters button:nth-child(2) svg { color:#d39c3e; }.time-filters button:nth-child(3) svg { color:#e7ae41; }.time-filters button:nth-child(4) svg { color:#9a8dd6; }.time-filters button:hover { border-color:var(--ocean); }.time-filters button.active { background:var(--action); color:#fff; box-shadow:0 2px 6px #102b4c10; }.time-filters button.active svg { color:#fff; }
#search-editor { scroll-margin-top:16px; }
.summary-strip { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin:18px 0; padding:0 0 14px; border-bottom:1px solid var(--line); }.summary-strip > div { display:flex; align-items:center; gap:7px; font-size:11px; color:var(--muted); }.summary-strip strong { display:grid; place-items:center; min-width:28px; height:28px; padding:0 6px; border-radius:8px; color:var(--ocean); background:var(--light-blue); font-size:14px; }.summary-strip button { display:flex; align-items:center; gap:5px; min-height:44px; padding:8px 10px; border:1px solid var(--line); border-radius:9px; background:var(--surface); color:var(--muted); font:inherit; font-size:10px; cursor:pointer; }.summary-strip b { color:var(--ink); font-weight:600; }.summary-strip svg { color:var(--ocean); flex-shrink:0; }.summary-strip button:disabled { opacity:.5; cursor:default; }
.trip-list { display:grid; gap:14px; }.trip-list > h2 { display:flex; align-items:center; gap:7px; margin:6px 0 0; color:var(--muted); font-size:13px; font-weight:600; line-height:1.6; }.trip-list > h2:not(:first-child) { margin-top:12px; }.trip-list > h2 ion-icon { color:var(--ocean); font-size:16px; }.trip-loading { display:grid; gap:20px; padding:20px; border-radius:14px; }
.state-message,.no-trips { display:flex; flex-direction:column; align-items:center; text-align:center; margin:18px 0; padding:28px 20px; border:1px solid var(--line); border-radius:18px; background:radial-gradient(ellipse at top,color-mix(in srgb,var(--ocean) 7%,transparent),transparent 70%),var(--surface); }.state-icon { display:grid; place-items:center; width:76px; height:76px; margin-bottom:18px; border:1px solid color-mix(in srgb,var(--ocean) 15%,var(--line)); border-radius:24px; background:var(--light-blue); color:var(--ocean); box-shadow:0 0 0 7px color-mix(in srgb,var(--ocean) 4%,transparent); }.empty-eyebrow { margin-bottom:6px; color:var(--ocean); font-size:9px; letter-spacing:.08em; text-transform:uppercase; font-weight:700; }.state-message h2,.no-trips h2 { margin:0; color:var(--ink); font-size:19px; line-height:1.4; letter-spacing:-.3px; }.state-message p,.no-trips p { max-width:340px; margin:10px 0 20px; color:var(--muted); font-size:12px; line-height:1.8; }.empty-actions { display:flex; justify-content:center; flex-wrap:wrap; gap:9px; width:100%; }.state-primary,.state-secondary { display:flex; align-items:center; justify-content:center; gap:7px; min-height:46px; padding:10px 16px; border:1px solid transparent; border-radius:10px; font:inherit; font-size:12px; font-weight:650; cursor:pointer; }.state-primary { background:var(--action); color:#fff; }.state-secondary { border-color:var(--line); background:var(--surface-soft); color:var(--ocean); }.error-icon { color:var(--danger); background:color-mix(in srgb,var(--danger) 10%,var(--surface)); border-color:color-mix(in srgb,var(--danger) 20%,var(--line)); box-shadow:none; }
.demo-note { display:flex; align-items:flex-start; gap:8px; margin:20px 2px 0; color:var(--muted); font-size:10px; line-height:1.7; }.demo-note ion-icon { flex:none; margin-top:2px; font-size:15px; color:var(--ocean); }
button:focus-visible { outline:2px solid var(--ocean); outline-offset:3px; }
@container passenger (max-width:380px) { .title-row h1 { font-size:24px; }.filter-panel { padding:10px; }.time-filters { gap:4px; }.time-filters button { font-size:9px; }.time-filters small { display:none; }.time-filters button { min-height:57px; }.state-message,.no-trips { padding:26px 16px; }.empty-actions button { width:100%; } }
@media(prefers-reduced-motion:reduce) { .time-filters button { transition:none; } }
</style>
