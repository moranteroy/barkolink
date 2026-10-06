<template>
  <ion-page>
    <ion-content :fullscreen="true" class="home-content">
      <main class="page-shell passenger-home">
        <PassengerHeader class="topbar" />
        <section class="welcome-section">
          <h1>{{ greeting }}, {{ firstName }}!</h1>
          <p>Where would you like to sail today?</p>
        </section>
        <p v-if="loadError" class="home-error" role="alert">{{ loadError }} <button @click="loadData">Retry</button></p>
        <TripSearchCard class="home-search" />
        <section class="section-block upcoming-block" aria-labelledby="upcoming-heading">
          <div class="section-heading">
            <h2 id="upcoming-heading"><ion-icon :icon="boatOutline" aria-hidden="true" /> Upcoming trip</h2>
            <router-link to="/bookings">See all <ion-icon :icon="ticketOutline" aria-hidden="true" /></router-link>
          </div>
          <div v-if="loading" class="upcoming-empty" role="status">Loading your upcoming trip...</div>
          <article v-else-if="journey" class="upcoming-card">
            <div class="journey-banner">
              <div class="journey-status-row">
                <span>{{ departureLabel }}</span>
                <b class="journey-status" :class="{ pending: !hasTicket }">{{ hasTicket ? 'Confirmed' : 'Payment pending' }}</b>
              </div>
              <div class="upcoming-route">
                <div><strong>{{ journey.from }}</strong><span>{{ journey.departure }} <small>Departure</small></span></div>
                <ion-icon :icon="arrowForwardOutline" aria-label="to" />
                <div class="align-right"><strong>{{ journey.to }}</strong><span>{{ journey.arrival }} <small>Arrival</small></span></div>
              </div>
            </div>
            <div class="journey-footer">
              <div class="journey-copy">
                <strong>{{ journey.vessel }}</strong>
                <p>{{ sailingDate }} <template v-if="journey.accommodation"><span aria-hidden="true">·</span> {{ journey.accommodation }}</template> <span aria-hidden="true">·</span> {{ journey.passengers.length }} passenger{{ journey.passengers.length === 1 ? '' : 's' }}</p>
                <small v-if="!hasTicket">Pay at the ticketing desk before your payment deadline.</small>
              </div>
              <ion-button v-if="hasTicket" :router-link="`/ticket?reference=${encodeURIComponent(journey.reference)}`">View e-ticket</ion-button>
              <ion-button v-else :router-link="`/booking-details?reference=${encodeURIComponent(journey.reference)}`">View booking</ion-button>
            </div>
          </article>
          <article v-else-if="!loadError" class="upcoming-empty">
            <span class="empty-icon"><ion-icon :icon="boatOutline" aria-hidden="true" /></span>
            <div><strong>Your next journey starts here</strong><p>Search a sailing above. Your active reservation will appear here.</p></div>
          </article>
        </section>
        <section class="section-block quick-block" aria-labelledby="quick-heading">
          <div class="section-heading"><h2 id="quick-heading"><ion-icon :icon="sparklesOutline" aria-hidden="true" /> Travel essentials</h2></div>
          <div class="essentials-grid">
            <router-link to="/travelers"><span class="quick-icon"><ion-icon :icon="peopleOutline" aria-hidden="true" /></span><span><strong>Saved travelers</strong><small>Book with saved details</small></span><ion-icon :icon="chevronForwardOutline" aria-hidden="true" /></router-link>
            <router-link to="/help"><span class="quick-icon"><ion-icon :icon="helpCircleOutline" aria-hidden="true" /></span><span><strong>Travel guide</strong><small>Payment & boarding help</small></span><ion-icon :icon="chevronForwardOutline" aria-hidden="true" /></router-link>
          </div>
        </section>
        <section v-if="recentSearches.length" class="section-block recent-block" aria-labelledby="recent-heading">
          <div class="section-heading"><h2 id="recent-heading"><ion-icon :icon="timeOutline" aria-hidden="true" /> Recent searches</h2></div>
          <div class="recent-list">
            <article v-for="item in recentSearches" :key="`${item.from}-${item.to}-${item.date}-${item.passengers}`">
              <div><strong>{{ item.from }} <ion-icon :icon="arrowForwardOutline" aria-label="to" /> {{ item.to }}</strong><p>{{ searchDate(item.date) }} <span aria-hidden="true">·</span> {{ item.passengers }} passenger{{ item.passengers === 1 ? '' : 's' }}</p></div>
              <button @click="repeatSearch(item)" :aria-label="`Search again: ${item.from} to ${item.to}`"><ion-icon :icon="searchOutline" aria-hidden="true" /> Search again</button>
            </article>
          </div>
        </section>
        <AdvisoryBanner class="home-advisories" show-heading />
      </main>
      <PassengerBottomNav />
    </ion-content>
  </ion-page>
</template>
<script setup lang="ts">
import { databaseRequestError } from "../../data/databaseErrors";
import { computed, ref } from "vue";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  onIonViewWillEnter,
  useIonRouter,
} from "@ionic/vue";
import { myBookings, myProfile } from "../../services/database/passenger";
import { auth, database } from "../../services/session";
import {
  arrowForwardOutline,
  boatOutline,
  sparklesOutline,
  peopleOutline,
  helpCircleOutline,
  chevronForwardOutline,
  timeOutline,
  ticketOutline,
  searchOutline,
} from "ionicons/icons";
import PassengerHeader from "../../components/passenger/PassengerHeader.vue";
import PassengerBottomNav from "../../components/passenger/PassengerBottomNav.vue";
import AdvisoryBanner from "../../components/passenger/AdvisoryBanner.vue";
import TripSearchCard from "../../components/passenger/TripSearchCard.vue";
import { readRecentSearches, recordRecentSearch, type RecentSearch } from "../../data/recentSearches";
import { philippineDateKey } from "../../data/travelDate";
const ionRouter = useIonRouter();
const recentSearches = ref(readRecentSearches());
function searchDate(date: string) {
  return new Date(`${date}T00:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });
}
function repeatSearch(item: RecentSearch) {
  const date = item.date < philippineDateKey() ? philippineDateKey() : item.date;
  localStorage.setItem("barkolink-search-route", JSON.stringify({ from: item.from, to: item.to }));
  localStorage.setItem("barkolink-search-iso-date", date);
  localStorage.setItem("barkolink-search-date", searchDate(date));
  localStorage.setItem("barkolink-search-passengers", String(item.passengers));
  recordRecentSearch({ ...item, date });
  ionRouter.navigate("/search", "forward", "push");
}
type Journey = {
  reference: string;
  from: string;
  to: string;
  date: string;
  departure: string;
  arrival: string;
  vessel: string;
  accommodation?: string | null;
  passengers: { name: string; type: string }[];
  status: string;
  paymentStatus: string;
};
const savedJourney = ref<Journey | null>(null);
const loadError = ref("");
const loading = ref(false);
const displayName = ref(
  auth?.currentUser?.displayName ||
    auth?.currentUser?.email?.split("@")[0] ||
    "there",
);
const firstName = computed(() => displayName.value.trim().split(/\s+/)[0]);
const greeting =
  new Date().getHours() < 12
    ? "Good morning"
    : new Date().getHours() < 18
      ? "Good afternoon"
      : "Good evening";
const journey = computed(() => savedJourney.value);
const hasTicket = computed(() => journey.value?.status === "CONFIRMED" && journey.value?.paymentStatus === "PAID");
const sailingDate = computed(() => journey.value ? searchDate(philippineDateKey(new Date(journey.value.date))) : "");
const departureLabel = computed(() => {
  if (!journey.value) return "";
  const days = Math.round((Date.parse(philippineDateKey(new Date(journey.value.date))) - Date.parse(philippineDateKey())) / 86400000);
  return days === 0 ? "Departing today" : days === 1 ? "Departing tomorrow" : `Departing in ${days} days`;
});

let loadRequest = 0;
async function loadData() {
  const request = ++loadRequest;
  loading.value = true;
  const user = auth?.currentUser;
  displayName.value =
    user?.displayName || user?.email?.split("@")[0] || "there";
  savedJourney.value = null;
  loadError.value = "";
  if (!user || !database) {
    loadError.value = "Your account is unavailable. Please sign in again.";
    loading.value = false;
    return;
  }
  try {
    const [profile, bookings] = await Promise.all([
      myProfile(database, { fetchPolicy: "SERVER_ONLY" }),
      myBookings(database, { fetchPolicy: "SERVER_ONLY" }),
    ]);
    if (request !== loadRequest || auth?.currentUser?.uid !== user.uid) return;
    if (profile.data.user?.fullName)
      displayName.value = profile.data.user.fullName;
    const item = bookings.data.bookings
      .filter(
        (x) =>
          ["CONFIRMED", "PENDING"].includes(x.status) &&
          ["PAID", "UNPAID"].includes(x.paymentStatus) &&
          new Date(x.sailing.departureAt) > new Date(),
      )
      .sort((a, b) =>
        a.sailing.departureAt.localeCompare(b.sailing.departureAt),
      )[0];
    savedJourney.value = item
      ? {
          reference: item.reference,
          from: item.sailing.origin.name,
          to: item.sailing.destination.name,
          date: item.sailing.departureAt,
          departure: new Date(item.sailing.departureAt).toLocaleTimeString(
            "en-PH",
            { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" },
          ),
          arrival: new Date(item.sailing.arrivalAt).toLocaleTimeString(
            "en-PH",
            { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" },
          ),
          vessel: item.sailing.vessel.name,
          accommodation: item.accommodationName,
          passengers: item.bookingPassengers_on_booking.map((person) => ({
            name: person.fullName,
            type: person.passengerType,
          })),
          status: item.status,
          paymentStatus: item.paymentStatus,
        }
      : null;
  } catch (error) {
    if (request === loadRequest && auth?.currentUser?.uid === user.uid) {
      loadError.value = databaseRequestError(
        error,
        "Could not load your trips.",
      );
    }
  } finally {
    if (request === loadRequest) loading.value = false;
  }
}
onIonViewWillEnter(() => {
  recentSearches.value = readRecentSearches();
  void loadData();
});
</script>
<style scoped>
.home-content { --background: var(--page-background); }
.page-shell { display: block; width: 100%; max-width: 680px; margin: 0 auto; padding: 20px 16px calc(108px + env(safe-area-inset-bottom)); color: var(--ink); }
.topbar { margin-bottom: 22px; }
.welcome-section { margin: 0 0 22px; }
.welcome-section h1 { margin: 0 0 6px; font-size: 23px; line-height: 1.35; letter-spacing: -.6px; overflow-wrap: anywhere; }
.welcome-section p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.6; }
.home-search { padding: 20px; border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 4px 14px #102b4c08; }
.home-search :deep(.card-heading) { align-items: center; margin-bottom: 18px; }
.home-search :deep(.eyebrow) { display: none; }
.home-search :deep(h2) { margin: 0; font-size: 17px; letter-spacing: -.3px; }
.home-search :deep(.route-badge) { padding: 7px 9px; background: var(--light-blue); color: var(--ocean); border-radius: 7px; font-size: 9px; }
.home-search :deep(.route-fields) { grid-template-columns: minmax(0, 1fr) 30px minmax(0, 1fr); gap: 6px; }
.home-search :deep(.detail-fields) { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px 12px; margin-top: 16px; }
.home-search :deep(.search-button) { grid-column: 1 / -1; width: 100%; height: 46px; margin: 0; border-radius: 10px; background: var(--action); }
.home-search :deep(select), .home-search :deep(input), .home-search :deep(.counter) { background: var(--surface); border-radius: 10px; }
.home-search :deep(input) { min-width: 0; max-width: 100%; }
:global(:root[data-theme="dark"]) .home-search :deep(input[type="date"]) { color-scheme: dark; }
.home-search :deep(label) { font-size: 10px; font-weight: 600; letter-spacing: .02em; }
.home-search :deep(.swap-button) { display: grid; place-items: center; width: 30px; min-height: 44px; margin: 0; padding: 0; background: transparent; color: var(--ocean); }
.section-block { margin-top: 26px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.section-heading h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 14px; font-weight: 650; line-height: 1.5; }
.section-heading h2 ion-icon { color: var(--ocean); font-size: 17px; flex: none; }
.section-heading a { display: inline-flex; align-items: center; gap: 5px; min-height: 32px; color: var(--ocean); text-decoration: none; font-size: 12px; font-weight: 600; white-space: nowrap; }
.upcoming-card { overflow: hidden; border: 1px solid var(--line); border-radius: 15px; background: var(--surface); box-shadow: 0 2px 6px #102b4c06; }
.journey-banner { padding: 18px; background: linear-gradient(115deg, #102c4d, #166bc0); color: #fff; }
.journey-status-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
.journey-status-row > span { font-size: 10px; font-weight: 650; letter-spacing: .04em; text-transform: uppercase; color: #c6e0fa; }
.journey-status { padding: 5px 9px; border-radius: 7px; background: #ffffff24; color: #fff; font-size: 10px; font-weight: 650; }
.journey-status.pending { background: #fff0cd; color: #784909; }
.upcoming-route { display: grid; grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr); align-items: center; gap: 10px; margin-top: 24px; }
.upcoming-route > div { min-width: 0; }
.upcoming-route strong { display: block; font-size: 23px; line-height: 1.25; letter-spacing: -.5px; overflow-wrap: anywhere; }
.upcoming-route span { display: block; margin-top: 6px; font-size: 13px; color: #e1efff; }
.upcoming-route small { display: block; margin-top: 4px; color: #bdd8f6; font-size: 10px; }
.upcoming-route > ion-icon { font-size: 22px; color: #c6e0fa; }
.align-right { text-align: right; }
.journey-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px; }
.journey-copy { min-width: 0; }
.journey-copy > strong { display: block; font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.journey-copy p { margin: 3px 0 0; font-size: 11px; line-height: 1.6; color: var(--muted); }
.journey-copy small { display: block; margin-top: 6px; color: var(--muted); font-size: 11px; line-height: 1.6; }
.journey-footer ion-button { flex: none; margin: 0; min-height: 44px; --border-radius: 9px; --background: var(--action); --color: #fff; --box-shadow: none; font-size: 11px; font-weight: 650; text-transform: none; }
.upcoming-empty { display: flex; align-items: center; gap: 14px; min-height: 110px; padding: 18px; border: 1px dashed var(--line); border-radius: 14px; background: var(--surface); color: var(--muted); font-size: 13px; }
.upcoming-empty strong { color: var(--ink); font-size: 13px; }
.upcoming-empty p { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.7; }
.empty-icon, .quick-icon { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 10px; background: var(--light-blue); color: var(--ocean); font-size: 20px; }
.essentials-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.essentials-grid a { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 80px; padding: 13px 12px; border: 1px solid var(--line); border-radius: 13px; background: var(--surface); color: var(--ink); text-decoration: none; }
.essentials-grid a > span:nth-child(2) { min-width: 0; }
.essentials-grid strong { display: block; font-size: 12px; line-height: 1.5; }
.essentials-grid small { display: block; margin-top: 4px; font-size: 10px; line-height: 1.5; color: var(--muted); }
.essentials-grid a > ion-icon { margin-left: auto; flex: none; font-size: 14px; color: var(--muted); }
.essentials-grid a:hover, .recent-list article:hover { border-color: var(--ocean); }
.recent-list { display: grid; gap: 9px; }
.recent-list article { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.recent-list article > div { min-width: 0; }
.recent-list strong { font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }
.recent-list strong ion-icon { margin: 0 4px; vertical-align: middle; color: var(--muted); }
.recent-list p { margin: 4px 0 0; font-size: 11px; color: var(--muted); }
.recent-list button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; flex: none; min-height: 44px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ocean); font-size: 11px; cursor: pointer; }
.home-advisories { margin: 26px 0 0; }
.home-advisories :deep(article) { border-radius: 13px; border-left-width: 1px; }
.home-advisories :deep(article > ion-icon) { box-sizing: content-box; padding: 9px; border-radius: 10px; background: var(--light-blue); font-size: 18px; }
.home-advisories :deep(.high > ion-icon) { background: #fff0d4; color: #986009; }
.home-advisories :deep(h3) { font-size: 13px; font-weight: 600; }
.home-advisories :deep(article p) { font-size: 12px; }
.home-error { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px; margin-bottom: 18px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--danger); font-size: 12px; line-height: 1.6; }
.home-error button { border: 0; background: transparent; color: var(--ocean); font-weight: 600; cursor: pointer; }
a:focus-visible, button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
@container passenger (max-width: 420px) {
  .home-search :deep(.detail-fields) { grid-template-columns: minmax(0, 1fr); }
}
@container passenger (max-width: 380px) {
  .welcome-section h1 { font-size: 21px; }
  .home-search { padding: 16px 12px; }
  .home-search :deep(.route-fields) { gap: 3px; grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr); }
  .home-search :deep(.swap-button) { width: 24px; }
  .journey-banner { padding: 16px; }
  .upcoming-route { gap: 6px; }
  .upcoming-route strong { font-size: 19px; }
  .journey-footer { flex-wrap: wrap; gap: 12px; }
  .journey-footer ion-button { width: 100%; }
  .essentials-grid a { align-items: flex-start; gap: 8px; padding: 12px 10px; }
  .essentials-grid a > ion-icon { display: none; }
  .quick-icon { width: 30px; height: 30px; font-size: 17px; }
  .recent-list article { flex-wrap: wrap; }
}
</style>
