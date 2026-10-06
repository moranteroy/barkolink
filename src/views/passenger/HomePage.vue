<template>
  <ion-page>
    <ion-content :fullscreen="true" class="home-content">
      <main class="page-shell design-passenger-home">
        <PassengerHeader class="topbar glass-toolbar" :name="displayName" />

        <section class="welcome-section">
          <div>
            <p class="kicker">{{ today }}</p>
            <h1>{{ greeting }}, {{ firstName }}!</h1>
            <p class="welcome-copy">Where would you like to sail today?</p>
          </div>
        </section>
        <p v-if="loadError" class="home-error" role="alert">
          {{ loadError }} <button @click="loadData">Retry</button>
        </p>

        <WorkspaceWelcome
          class="passenger-welcome-banner"
          eyebrow="YOUR JOURNEY, ALL IN ONE PLACE"
          title="Find your next island escape."
          description="Search ferry departures, keep your tickets close, and travel with the latest sailing updates."
          :links="[
            { label: 'Browse departures', to: '/search?all=1' },
            { label: 'My bookings', to: '/bookings' },
          ]"
        /><TripSearchCard /><AdvisoryBanner />
        <div class="passenger-shortcuts">
          <router-link to="/travelers">Saved travelers →</router-link
          ><router-link to="/help">Help & travel guide →</router-link>
        </div>

        <section class="section-block upcoming-block">
          <div class="section-heading">
            <div>
              <p class="kicker">YOUR NEXT JOURNEY</p>
              <h2>Upcoming trip</h2>
            </div>
            <router-link to="/bookings"
              >See all <ion-icon :icon="arrowForwardOutline"
            /></router-link>
          </div>
          <p v-if="loading" role="status">Loading your upcoming trip...</p>
          <article v-else-if="journey" class="upcoming-card glass-panel">
            <div class="upcoming-top">
              <div class="date-chip">
                <strong>{{ journeyDate.day }}</strong
                ><span>{{ journeyDate.month }}</span>
              </div>
              <div>
                <span :class="['confirmed', journey.status.toLowerCase()]"
                  ><ion-icon :icon="checkmarkCircle" />
                  {{
                    journey.paymentStatus === "PAID"
                      ? "PAID"
                      : "PAYMENT PENDING"
                  }}</span
                >
                <p>
                  Booking <strong>{{ journey.reference }}</strong>
                </p>
              </div>
            </div>
            <div class="upcoming-route">
              <div>
                <span>{{ journey.from.toUpperCase() }}</span
                ><strong>{{ journey.departure }}</strong>
              </div>
              <div class="route-track">
                <span></span><i></i><ion-icon :icon="boatOutline" /><i></i
                ><span></span>
              </div>
              <div class="align-right">
                <span>{{ journey.to.toUpperCase() }}</span
                ><strong>{{ journey.arrival }}</strong>
              </div>
            </div>
            <div class="vessel-row">
              <span><ion-icon :icon="boatOutline" /> {{ journey.vessel }}</span
              ><span
                >{{ journey.passengers.length }} passenger{{
                  journey.passengers.length === 1 ? "" : "s"
                }}</span
              >
            </div>
            <div class="upcoming-actions">
              <ion-button
                v-if="journey.paymentStatus === 'PAID'"
                fill="outline"
                :router-link="`/ticket?reference=${encodeURIComponent(journey.reference)}`"
                ><ion-icon slot="start" :icon="ticketOutline" /> View
                ticket</ion-button
              ><span v-if="journey.paymentStatus !== 'PAID'" class="pay-note"
                >Pay at ticketing desk</span
              ><ion-button
                :router-link="`/booking-details?reference=${encodeURIComponent(journey.reference)}`"
                >View details <ion-icon slot="end" :icon="arrowForwardOutline"
              /></ion-button>
            </div>
          </article>
          <article v-else-if="!loadError" class="upcoming-empty">
            <strong>No upcoming trip</strong>
            <p>Your active reservations will appear here.</p>
            <router-link to="/search">Find a sailing</router-link>
          </article>
        </section>

        <section class="section-block quick-block">
          <div class="section-heading">
            <div>
              <p class="kicker">MAKE IT EASY</p>
              <h2>Quick actions</h2>
            </div>
          </div>
          <div class="quick-grid">
            <router-link to="/search?all=1"
              ><span class="quick-icon blue"
                ><ion-icon :icon="searchOutline" /></span
              ><strong>Book ferry</strong
              ><small>Find a trip</small></router-link
            ><router-link to="/ticket"
              ><span class="quick-icon mint"
                ><ion-icon :icon="qrCodeOutline" /></span
              ><strong>My tickets</strong
              ><small>View your passes</small></router-link
            ><router-link to="/bookings?tab=Past%20departures"
              ><span class="quick-icon amber"
                ><ion-icon :icon="timeOutline" /></span
              ><strong>History</strong><small>Past journeys</small></router-link
            ><router-link to="/notifications"
              ><span class="quick-icon coral"
                ><ion-icon :icon="notificationsOutline" /></span
              ><strong>Alerts</strong><small>Stay updated</small></router-link
            >
          </div>
        </section>

        <section class="inspiration">
          <div>
            <p class="kicker">SAIL WITH CONFIDENCE</p>
            <h2>Every journey,<br /><em>made simpler.</em></h2>
            <p>One place for bookings, tickets, and travel updates.</p>
          </div>
          <div class="sun-disc"></div>
          <div class="boat-illustration"><span></span><i></i></div>
        </section>
      </main>
      <PassengerBottomNav />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import WorkspaceWelcome from "../../components/shared/WorkspaceWelcome.vue";

import { databaseRequestError } from "../../data/databaseErrors";
import { computed, ref } from "vue";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  onIonViewWillEnter,
} from "@ionic/vue";
import { myBookings, myProfile } from "../../services/database/passenger";
import { auth, database } from "../../services/session";
import {
  arrowForwardOutline,
  boatOutline,
  checkmarkCircle,
  notificationsOutline,
  qrCodeOutline,
  searchOutline,
  ticketOutline,
  timeOutline,
} from "ionicons/icons";
import PassengerHeader from "../../components/passenger/PassengerHeader.vue";
import PassengerBottomNav from "../../components/passenger/PassengerBottomNav.vue";
import AdvisoryBanner from "../../components/passenger/AdvisoryBanner.vue";
import TripSearchCard from "../../components/passenger/TripSearchCard.vue";
type Journey = {
  reference: string;
  from: string;
  to: string;
  date: string;
  departure: string;
  arrival: string;
  vessel: string;
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
const today = new Intl.DateTimeFormat("en-PH", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
})
  .format(new Date())
  .toUpperCase();
const greeting =
  new Date().getHours() < 12
    ? "Good morning"
    : new Date().getHours() < 18
      ? "Good afternoon"
      : "Good evening";
const journey = computed(() => savedJourney.value);
const journeyDate = computed(() => {
  const parsed = new Date(journey.value?.date || "");
  return Number.isNaN(parsed.getTime())
    ? { day: "â€”", month: "â€”" }
    : {
        day: parsed.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric" }),
        month: parsed
          .toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short" })
          .toUpperCase(),
      };
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
  void loadData();
});
</script>

<style scoped>
.page-shell {
  max-width: 1120px;
  margin: 0 auto;
  padding: 26px 34px 110px;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.top-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}
.icon-button,
.avatar {
  border: 0;
  background: transparent;
  cursor: pointer;
}
.icon-button {
  position: relative;
  color: var(--ink);
  font-size: 22px;
}
.icon-button span {
  position: absolute;
  right: 1px;
  top: 0;
  width: 7px;
  height: 7px;
  border: 2px solid white;
  border-radius: 50%;
  background: #f97363;
}
.avatar {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #d9edf8;
  color: var(--ocean);
  font-size: 12px;
  font-weight: 800;
}
.welcome-section {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin: 54px 0 28px;
}
.kicker {
  margin: 0;
  color: var(--ocean);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.11em;
}
.welcome-section h1 {
  margin: 8px 0 5px;
  font-size: 34px;
  line-height: 1;
  letter-spacing: -1.3px;
}
.welcome-copy {
  margin: 0;
  color: var(--muted);
  font-size: 15px;
}
.wave-mark {
  display: flex;
  gap: 5px;
  align-items: flex-end;
  height: 42px;
  opacity: 0.8;
}
.wave-mark span {
  display: block;
  width: 5px;
  border-radius: 8px;
  background: #acd8ed;
}
.wave-mark span:nth-child(1) {
  height: 17px;
}
.wave-mark span:nth-child(2) {
  height: 32px;
  background: #6db9dc;
}
.wave-mark span:nth-child(3) {
  height: 42px;
  background: var(--ocean);
}
.section-block {
  margin-top: 40px;
}
.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  margin-bottom: 16px;
}
.section-heading h2 {
  margin: 5px 0 0;
  font-size: 21px;
  letter-spacing: -0.5px;
}
.section-heading a {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--ocean);
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
}
.section-heading ion-icon {
  font-size: 14px;
}
.upcoming-empty {
  display: grid;
  gap: 8px;
  min-height: 150px;
  align-content: center;
  padding: 22px;
  border: 1px dashed var(--line);
  border-radius: 18px;
  background: var(--surface);
  color: var(--ink);
}
.upcoming-empty p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}
.upcoming-empty a {
  width: max-content;
  color: var(--ocean);
  font-size: 11px;
  font-weight: 800;
  text-decoration: none;
}
.upcoming-card {
  padding: 20px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 12px 30px rgba(16, 43, 76, 0.06);
}
.upcoming-top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.date-chip {
  display: grid;
  place-items: center;
  width: 44px;
  height: 50px;
  border-radius: 10px;
  background: var(--deep);
  color: #fff;
  line-height: 1;
}
.date-chip strong {
  font-size: 19px;
}
.date-chip span {
  font-size: 9px;
  letter-spacing: 0.1em;
  color: #9cc9e3;
}
.confirmed {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #117a52;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.07em;
}
.confirmed ion-icon {
  font-size: 14px;
}
.confirmed.pending {
  color: #9a5b00;
}
.confirmed.issued {
  color: #117a52;
}
.upcoming-top p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 11px;
}
.upcoming-top p strong {
  color: var(--ink);
}
.more {
  margin-left: auto;
  color: var(--muted);
  font-size: 20px;
}
.upcoming-route {
  display: grid;
  grid-template-columns: 1fr 1.6fr 1fr;
  align-items: center;
  margin: 25px 0 20px;
}
.upcoming-route span {
  display: block;
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
}
.upcoming-route strong {
  display: block;
  margin-top: 5px;
  font-size: 25px;
  letter-spacing: -0.6px;
}
.upcoming-route small {
  font-size: 11px;
  color: var(--muted);
}
.align-right {
  text-align: right;
}
.route-track {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ocean);
}
.route-track i {
  height: 1px;
  flex: 1;
  background: var(--line);
}
.route-track span {
  width: 6px;
  height: 6px;
  border: 2px solid var(--ocean);
  border-radius: 50%;
}
.route-track ion-icon {
  font-size: 19px;
}
.vessel-row {
  display: flex;
  justify-content: space-between;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 11px;
}
.vessel-row span:first-child {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ink);
  font-weight: 700;
}
.vessel-row ion-icon {
  color: var(--ocean);
  font-size: 17px;
}
.upcoming-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.upcoming-actions ion-button {
  --border-radius: 9px;
  height: 37px;
  margin: 0;
  font-size: 11px;
  text-transform: none;
  font-weight: 800;
}
.upcoming-actions ion-button:first-child {
  --color: var(--ocean);
  --border-color: #bcd9e9;
}
.upcoming-actions ion-button:last-child {
  --background: var(--ocean);
  --box-shadow: none;
}
.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.quick-grid a {
  padding: 15px 14px;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: var(--surface);
  color: var(--ink);
  text-decoration: none;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}
.quick-grid a:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(16, 43, 76, 0.08);
}
.quick-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  margin-bottom: 11px;
  border-radius: 10px;
  font-size: 18px;
}
.quick-icon.blue {
  color: var(--ocean);
  background: var(--light-blue);
}
.quick-icon.mint {
  color: #078a72;
  background: #def7f0;
}
.quick-icon.amber {
  color: #b77700;
  background: #fff1d2;
}
.quick-icon.coral {
  color: #d45d4d;
  background: #ffebe7;
}
.quick-grid strong,
.quick-grid small {
  display: block;
}
.quick-grid strong {
  color: var(--ink);
  font-size: 12px;
}
.quick-grid small {
  margin-top: 4px;
  color: var(--muted);
  font-size: 10px;
}
.inspiration {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  min-height: 145px;
  margin-top: 40px;
  padding: 22px 28px;
  border-radius: 20px;
  background: var(--deep);
  color: #fff;
}
.inspiration .kicker {
  color: #7cc4e5;
}
.inspiration h2 {
  margin: 7px 0;
  font-size: 25px;
  line-height: 1.05;
  letter-spacing: -0.7px;
}
.inspiration em {
  color: #7cc4e5;
  font-style: normal;
}
.inspiration p:last-child {
  margin: 0;
  color: #afc0d2;
  font-size: 12px;
}
.sun-disc {
  position: absolute;
  right: 100px;
  top: -45px;
  width: 170px;
  height: 170px;
  border-radius: 50%;
  background: #f6c667;
  opacity: 0.9;
}
.boat-illustration {
  position: absolute;
  right: 45px;
  bottom: 28px;
  width: 185px;
  height: 58px;
}
.boat-illustration:before {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 170px;
  height: 27px;
  border-radius: 0 0 70px 70px;
  background: #f5f8fb;
  transform: skew(-20deg);
}
.boat-illustration span {
  position: absolute;
  left: 68px;
  bottom: 27px;
  width: 50px;
  height: 25px;
  border-radius: 5px 5px 0 0;
  background: #d9edf8;
}
.boat-illustration i {
  position: absolute;
  left: 92px;
  bottom: 52px;
  width: 2px;
  height: 29px;
  background: #d9edf8;
}
.boat-illustration i:after {
  content: "";
  position: absolute;
  left: 2px;
  top: 0;
  border-style: solid;
  border-width: 8px 0 8px 20px;
  border-color: transparent transparent transparent #7cc4e5;
}
@media (min-width: 900px) {
  .page-shell {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(290px, 1fr);
    grid-template-areas: "header header" "welcome welcome" "search search" "upcoming quick" "inspiration inspiration";
    column-gap: 24px;
    max-width: 1180px;
    padding: 34px 36px 115px;
  }
  .topbar {
    grid-area: header;
  }
  .welcome-section {
    grid-area: welcome;
    margin: 62px 0 28px;
  }
  .page-shell > .search-card {
    grid-area: search;
  }
  .upcoming-block {
    grid-area: upcoming;
    max-width: none;
    min-width: 0;
    margin-top: 34px;
  }
  .quick-block {
    grid-area: quick;
    display: flex;
    flex-direction: column;
    max-width: none;
    min-width: 0;
    margin-top: 34px;
  }
  .quick-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(2, minmax(0, 1fr));
    flex: 1;
    gap: 10px;
  }
  .quick-grid a {
    display: grid;
    height: 100%;
    grid-template-columns: 42px 1fr;
    grid-template-rows: auto auto;
    align-items: center;
    column-gap: 11px;
    min-height: 122px;
    padding: 12px;
  }
  .quick-icon {
    grid-row: 1/3;
    width: 40px;
    height: 40px;
    margin: 0;
  }
  .quick-grid strong {
    align-self: end;
    font-size: 12px;
  }
  .quick-grid small {
    align-self: start;
    margin-top: 3px;
  }
  .inspiration {
    grid-area: inspiration;
    position: relative;
    left: auto;
    top: auto;
    width: auto;
    min-height: 158px;
    margin-top: 28px;
    padding: 24px 30px;
    align-items: center;
  }
  .inspiration .boat-illustration {
    right: 54px;
    bottom: 25px;
    transform: scale(1);
  }
  .sun-disc {
    right: 140px;
    top: -50px;
  }
  .page-shell {
    position: static;
  }
}
@media (min-width: 900px) and (max-width: 1050px) {
  .page-shell {
    grid-template-columns: minmax(0, 1.35fr) minmax(270px, 0.9fr);
    column-gap: 18px;
    padding-left: 24px;
    padding-right: 24px;
  }
  .quick-grid {
    gap: 8px;
  }
  .quick-grid a {
    grid-template-columns: 36px 1fr;
    column-gap: 8px;
    min-height: 96px;
    height: 100%;
    padding: 10px;
  }
  .quick-icon {
    width: 34px;
    height: 34px;
  }
}
@container passenger (max-width:899px) {
  .page-shell {
    display: block;
  }
  .quick-block {
    display: block;
  }
  .wave-mark {
    display: none;
  }
}
@container passenger (max-width:620px) {
  .page-shell {
    padding: 22px 16px 102px;
  }
  .welcome-section {
    margin: 42px 0 22px;
  }
  .welcome-section h1 {
    font-size: 29px;
  }
  .wave-mark {
    display: none;
  }
  .upcoming-route strong {
    font-size: 20px;
  }
  .quick-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .inspiration {
    min-height: 155px;
    padding: 20px;
  }
  .inspiration .boat-illustration {
    right: -15px;
    transform: scale(0.75);
    transform-origin: right bottom;
  }
  .inspiration h2 {
    font-size: 23px;
  }
}

.logout-button {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: var(--surface);
  color: var(--ocean);
  font-size: 19px;
  cursor: pointer;
}
.home-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 0 0 18px;
  padding: 12px;
  border: 1px solid #d89da2;
  border-radius: 10px;
  background: var(--surface);
  color: #ac4149;
  font-size: 12px;
}
.home-error button {
  border: 0;
  background: transparent;
  color: var(--ocean);
  font-weight: 800;
  cursor: pointer;
}
@container passenger (max-width:620px) {
  .page-shell {
    display: block;
    max-width: none;
    padding: 22px 16px 105px;
  }
  .welcome-section {
    margin: 35px 0 22px;
  }
  .welcome-section h1 {
    font-size: 27px;
    line-height: 1.1;
  }
  .welcome-copy {
    font-size: 13px;
  }
  .section-block,
  .upcoming-block,
  .quick-block {
    display: block;
    margin-top: 28px;
  }
  .quick-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: auto;
    gap: 10px;
  }
  .quick-grid a {
    display: block;
    min-height: 100px;
    padding: 13px;
  }
  .quick-icon {
    width: 36px;
    height: 36px;
    margin-bottom: 9px;
  }
  .inspiration {
    min-height: 145px;
    margin-top: 28px;
    padding: 20px;
  }
  .sun-disc {
    right: 25px;
    top: -35px;
    width: 125px;
    height: 125px;
  }
  .inspiration .boat-illustration {
    right: -12px;
    bottom: 22px;
    transform: scale(0.55);
    transform-origin: right bottom;
  }
  .upcoming-route {
    grid-template-columns: minmax(0, 1fr) 65px minmax(0, 1fr);
    gap: 5px;
  }
  .upcoming-route strong {
    font-size: 18px;
  }
  .upcoming-actions {
    justify-content: stretch;
  }
  .upcoming-actions ion-button {
    flex: 1;
    font-size: 10px;
  }
}
.pay-note {
  display: inline-flex;
  align-items: center;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}
@container passenger (min-width:700px) and (max-width:899px) {
  .page-shell {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(250px, 1fr);
    grid-template-areas: "header header" "welcome welcome" "search search" "upcoming quick" "inspiration inspiration";
    column-gap: 18px;
    max-width: none;
    padding: 26px 24px 105px;
  }
  .topbar {
    grid-area: header;
  }
  .welcome-section {
    grid-area: welcome;
    margin: 40px 0 22px;
  }
  .page-shell > .search-card {
    grid-area: search;
  }
  .upcoming-block {
    grid-area: upcoming;
    min-width: 0;
    margin-top: 28px;
  }
  .quick-block {
    grid-area: quick;
    display: flex;
    flex-direction: column;
    min-width: 0;
    margin-top: 28px;
  }
  .quick-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(2, minmax(0, 1fr));
    flex: 1;
    gap: 9px;
  }
  .quick-grid a {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    grid-template-rows: auto auto;
    column-gap: 7px;
    align-items: center;
    min-height: 90px;
    height: 100%;
    padding: 10px;
  }
  .quick-icon {
    grid-row: 1/3;
    width: 32px;
    height: 32px;
    margin: 0;
  }
  .quick-grid strong {
    align-self: end;
    font-size: 11px;
  }
  .quick-grid small {
    align-self: start;
    font-size: 9px;
  }
  .inspiration {
    grid-area: inspiration;
    margin-top: 24px;
  }
  .upcoming-route {
    grid-template-columns: minmax(0, 1fr) 65px minmax(0, 1fr);
  }
  .upcoming-route strong {
    font-size: 20px;
  }
}
.passenger-shortcuts {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin: 20px 0;
}
.passenger-shortcuts a {
  font-size: 12px;
  font-weight: 700;
  color: var(--ocean);
  text-decoration: none;
}
</style>
