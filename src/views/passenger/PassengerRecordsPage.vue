<template>
  <ion-page
    ><ion-content :fullscreen="true"
      ><main class="demo-page" :class="{ 'bookings-page': kind === 'bookings', 'ticket-page': kind === 'ticket' }">
        <PassengerHeader />
        <section class="page-title">
          <p class="kicker">{{ eyebrow }}</p>
          <h1>{{ title }}</h1>
          <p>{{ description }}</p>
          <p v-if="loadError" class="data-error" role="alert">
            {{ loadError }}
          </p>
        </section>
        <PaymentReturn v-if="kind === 'bookings' && returnedBooking" :key="returnedBooking.id"
          :booking-id="returnedBooking.id" :reference="returnedBooking.reference"
          :ticket-eligible="bookingTicketReady(returnedBooking)"
          :awaiting-verification="awaitingPaymentVerification(returnedBooking)"
          :cancelled="route.query.payment === 'cancelled'" @checking="returnVerificationPending = true" @updated="paymentVerified" />
        <template v-if="kind === 'ticket'"
          ><div
            v-if="
              bookingTicketReady(currentBooking)
            "
            class="ticket-actions"
          >
            <Button variant="outline" :disabled="ticketBusy" @click="printTicket">
              <ion-icon :icon="printOutline" aria-hidden="true" /> Print / PDF</Button
            ><Button :disabled="ticketBusy" @click="exportTicket('download')">
              <ion-icon :icon="downloadOutline" aria-hidden="true" />{{ ticketBusy ? "Preparing…" : "Download" }}</Button
            ><Button variant="outline" :disabled="ticketBusy" @click="exportTicket('share')">
              <ion-icon :icon="shareOutline" aria-hidden="true" /> Share
            </Button>
          </div>
          <p v-if="ticketNotice" role="status">{{ ticketNotice }}</p>
          <label
            v-if="ticketBookings.length > 1"
            class="ticket-picker"
            aria-label="Choose an e-ticket"
          >
            <span>Your tickets <small>{{ ticketBookings.length }} bookings</small></span>
            <select :value="currentBooking?.reference" @change="chooseTicket">
              <option v-for="item in ticketBookings" :key="item.reference" :value="item.reference">
                {{ item.from }} → {{ item.to }} · {{ item.date }} · {{ item.reference }}
              </option>
            </select>
          </label>
          <article
            v-if="
              currentBooking &&
              bookingTicketReady(currentBooking)
            "
            class="ticket"
          >
            <div class="ticket-head">
              <div class="ticket-title">
                <small
                  ><ion-icon :icon="ticketOutline" aria-hidden="true" />
                  BARKOLINK <span>·</span> DIGITAL BOARDING PASS</small
                >
                <h2>
                  <span class="route-port">{{ currentBooking.from }}</span>
                  <span class="route-arrow"
                    ><ion-icon :icon="arrowForwardOutline" aria-hidden="true"
                  /></span>
                  <span class="route-port">{{ currentBooking.to }}</span>
                </h2>
              </div>
              <b><ion-icon :icon="checkmarkCircleOutline" aria-hidden="true" /> PAID</b>
            </div>
            <div class="ticket-meta">
              <div>
                <small
                  ><ion-icon :icon="calendarOutline" aria-hidden="true" />
                  DEPARTURE</small
                ><strong
                  >{{ currentBooking.date }} <span>·</span>
                  {{ currentBooking.departure }}</strong
                >
              </div>
              <div>
                <small
                  ><ion-icon :icon="boatOutline" aria-hidden="true" />
                  VESSEL</small
                ><strong>{{ currentBooking.vessel }}</strong>
              </div>
              <div>
                <small
                  ><ion-icon :icon="bookmarkOutline" aria-hidden="true" />
                  BOOKING REFERENCE</small
                ><strong>{{ currentBooking.reference }}</strong>
              </div>
            </div>
            <div class="ticket-passengers">
              <h3>
                <ion-icon :icon="peopleOutline" aria-hidden="true" /> Passenger
                tickets
              </h3>
              <div
                v-for="person in currentBooking.passengers"
                :key="person.id || person.name"
                class="ticket-pass"
              >
                <div class="ticket-person">
                  <span class="ticket-person-icon"
                    ><ion-icon :icon="personOutline" aria-hidden="true"
                  /></span>
                  <div>
                    <strong>{{ person.name }}</strong
                    ><small>{{ person.type }} passenger</small>
                  </div>
                  <b
                    ><ion-icon
                      :icon="checkmarkCircleOutline"
                      aria-hidden="true"
                    />
                    {{ person.ticketStatus }}</b
                  >
                </div>
                <div
                  v-if="
                    person.ticketCode &&
                    ['ISSUED', 'CHECKED_IN', 'BOARDED'].includes(
                      person.ticketStatus || '',
                    )
                  "
                  class="qr-block"
                >
                  <img
                    v-if="
                      qrImageUrl(person.ticketCode) &&
                      !qrFailedCodes.includes(person.ticketCode)
                    "
                    :src="qrImageUrl(person.ticketCode)"
                    :alt="`QR code for ${person.name}'s ticket`"
                    width="180"
                    height="180"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    @error="markQrUnavailable(person.ticketCode)"
                  /><span v-else class="qr-unavailable">{{
                    qrFailedCodes.includes(person.ticketCode)
                      ? "QR image unavailable. Show the ticket code to staff."
                      : "Refresh this ticket to load its verified QR. Staff can verify the ticket code."
                  }}</span>
                  <div>
                    <small>SCAN AT THE TERMINAL</small
                    ><code>{{ person.ticketCode }}</code>
                    <p>QR includes your name, date and vessel. Show your passenger ID; staff verifies the live ticket before boarding.</p>
                  </div>
                </div>
                <p v-else class="qr-unavailable">
                  Your ticket will be issued after payment is recorded.
                </p>
              </div>
            </div>
          </article>
          <div v-else-if="loading" class="empty-state">
            <h2>Loading your tickets…</h2>
            <p>Checking your reservations in the database.</p>
          </div>
          <div v-else-if="loadError" class="empty-state">
            <h2>Could not load tickets</h2>
            <p>{{ loadError }}</p>
            <ion-button class="primary" @click="loadData">Retry</ion-button>
          </div>
          <div
            v-else-if="
              currentBooking &&
              !bookingTicketReady(currentBooking) &&
              ['PENDING', 'CONFIRMED'].includes(currentBooking.status)
            "
            class="empty-state"
          >
            <div class="empty-icon">
              <ion-icon :icon="ticketOutline" aria-hidden="true" />
            </div>
            <h2>{{ awaitingPaymentVerification(currentBooking) ? 'Awaiting staff verification' : 'Payment pending' }}</h2>
            <p v-if="awaitingPaymentVerification(currentBooking)">Your payment was received. Staff must verify the transaction before your e-ticket is issued. Do not pay again.</p>
            <p v-else>
              Show booking {{ currentBooking.reference }} at the ticketing desk.
              Pay PHP {{ currentBooking.total.toLocaleString() }} to receive
              your e-ticket.
            </p>
            <ion-button
              class="primary"
              :router-link="`/booking-details?reference=${encodeURIComponent(currentBooking.reference)}`"
              >View reservation</ion-button
            >
          </div>
          <div v-else class="empty-state">
            <div class="empty-icon">
              <ion-icon :icon="ticketOutline" aria-hidden="true" />
            </div>
            <h2>No ticket yet</h2>
            <p>
              Pay for your reservation at the ticketing desk to receive a
              passenger e-ticket.
            </p>
            <ion-button class="primary" router-link="/search"
              >Find a sailing</ion-button
            >
          </div>
        </template>
        <template v-else-if="loading && ['bookings', 'booking-details', 'notifications'].includes(kind) && (kind === 'notifications' ? !notices.length : !bookings.length)">
          <div class="empty-state" role="status"><h2>Loading {{ title.toLowerCase() }}...</h2><p>Checking the latest records.</p></div>
        </template>
        <template v-else-if="loadError && ['bookings', 'booking-details', 'notifications'].includes(kind)">
          <div class="empty-state"><h2>Could not load {{ title.toLowerCase() }}</h2><ion-button class="primary" @click="loadData">Retry</ion-button></div>
        </template>
        <template v-else-if="kind === 'bookings'"
          ><div class="booking-filters">
            <label
              >Find a booking<input
                v-model.trim="bookingSearch"
                type="search"
                placeholder="Reference, route, vessel or passenger" /></label
            ><label
              >Payment status<select v-model="bookingPayment">
                <option value="ALL">All payments</option>
                <option value="UNPAID">Awaiting payment</option>
                <option value="PAID">Paid</option>
                <option value="REFUND_PENDING">Refund pending</option>
                <option value="REFUNDED">Refunded</option>
              </select></label
            >
          </div>
          <div class="tabs" role="group" aria-label="Filter by booking status">
            <button
              v-for="tab in tabs"
              :key="tab"
              :aria-pressed="selectedTab === tab"
              :class="{ selected: selectedTab === tab }"
              @click="selectedTab = tab"
            >
              {{ tab }}
            </button>
          </div>
          <div v-if="visibleBookings.length" class="booking-list">
            <article
              v-for="booking in visibleBookings"
              :key="booking.reference"
              class="booking-card glass-panel"
            >
              <div class="booking-copy">
                <div class="row-heading">
                  <h2>
                    {{ booking.from }}
                    <span
                      ><ion-icon :icon="arrowForwardOutline" aria-hidden="true"
                    /></span>
                    {{ booking.to }}
                  </h2>
                  <b :class="[booking.status.toLowerCase(), booking.paymentStatus.toLowerCase()]">{{
                    booking.paymentStatus === "REFUND_PENDING"
                      ? "REFUND PENDING"
                      : booking.paymentStatus === "REFUNDED"
                        ? "REFUNDED"
                        : ["CANCELLED", "EXPIRED"].includes(booking.status)
                          ? booking.status
                          : booking.paymentStatus === "PAID"
                            ? awaitingPaymentVerification(booking) ? "AWAITING STAFF VERIFICATION" : "PAID"
                            : "PAYMENT PENDING"
                  }}</b>
                </div>
                <div class="booking-meta">
                  <span
                    ><ion-icon :icon="calendarOutline" aria-hidden="true" />
                    {{ booking.date }} · {{ booking.departure }}</span
                  ><span
                    ><ion-icon :icon="boatOutline" aria-hidden="true" />
                    {{ booking.vessel }}</span
                  >
                </div>
                <div class="booking-fare-panel">
                <div class="booking-total"><span>Booking total</span><strong>PHP {{ booking.total.toLocaleString() }}</strong></div>
                <p v-if="booking.accommodationName" class="booking-accommodation">
                  {{ booking.accommodationName }} accommodation · PHP
                  {{ (booking.serviceFee || 0).toLocaleString() }} additional
                  fare included
                </p>
                </div>
                <div class="booking-reference">
                  <span
                    ><ion-icon :icon="ticketOutline" aria-hidden="true" />
                    {{ booking.reference }}</span
                  ><span
                    ><ion-icon :icon="peopleOutline" aria-hidden="true" />
                    {{ booking.passengers.length }} passenger{{
                      booking.passengers.length === 1 ? "" : "s"
                    }}</span
                  >
                </div>
                <OnlinePayment
                  v-if="booking.paymentStatus === 'UNPAID' && ['PENDING','CONFIRMED'].includes(booking.status) && !(returnedBooking?.id === booking.id && returnVerificationPending)"
                  :booking-id="booking.id" :reference="booking.reference" @updated="loadData"
                />
                <p v-if="booking.paymentStatus === 'PAID'" class="payment-hint">{{ awaitingPaymentVerification(booking) ? 'Payment received — Awaiting staff verification' : 'Payment confirmed' }} · {{ paymentMethodLabel(booking) }}</p>
                <PaymentDeadline
                  v-if="
                    booking.paymentDeadline &&
                    booking.paymentStatus === 'UNPAID' &&
                    ['PENDING', 'CONFIRMED'].includes(booking.status)
                  "
                  :deadline="booking.paymentDeadline"
                  @expired="loadData"
                />
                <p
                  v-if="booking.paymentStatus === 'REFUND_PENDING'"
                  class="payment-hint"
                >
                  {{ booking.paymentMethod === 'PAYMONGO_TEST' ? 'Contact ticketing for assistance with your online payment.' : 'Visit the ticketing desk for your cash refund.' }}
                </p>
                <div class="booking-actions">
                  <router-link
                    class="booking-details-link"
                    :to="`/booking-details?reference=${encodeURIComponent(booking.reference)}`"
                    ><ion-icon :icon="documentTextOutline" aria-hidden="true" /> View details</router-link
                  ><router-link
                    class="booking-ticket-link"
                    v-if="
                      bookingTicketReady(booking)
                    "
                    :to="`/ticket?reference=${encodeURIComponent(booking.reference)}`"
                    ><ion-icon :icon="ticketOutline" aria-hidden="true" /> View
                    e-ticket</router-link
                  ><button
                    class="booking-cancel-link"
                    v-if="
                      booking.paymentStatus === 'UNPAID' &&
                      ['PENDING', 'CONFIRMED'].includes(booking.status) &&
                      new Date(booking.departureAt) > new Date()
                    "
                    @click="cancel(booking.reference)"
                  >
                    Cancel reservation
                  </button>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="empty-state">
            <div class="empty-icon">
              <ion-icon :icon="calendarOutline" aria-hidden="true" />
            </div>
            <h2>
              {{
                bookingSearch || bookingPayment !== "ALL"
                  ? "No matching bookings"
                  : `No ${selectedTab.toLowerCase()} bookings`
              }}
            </h2>
            <button
              v-if="bookingSearch || bookingPayment !== 'ALL'"
              class="clear-filters"
              @click="
                bookingSearch = '';
                bookingPayment = 'ALL';
              "
            >
              Clear filters
            </button>
            <p>Your reservations will show here once you book a sailing.</p>
            <ion-button class="primary" router-link="/search"
              >Browse sailings</ion-button
            >
          </div></template
        >
        <template v-else-if="kind === 'booking-details'"
          ><article
            v-if="currentBooking"
            class="booking-detail-card glass-panel"
          >
            <div class="row-heading">
              <h2>
                {{ currentBooking.from }}
                <span
                  ><ion-icon :icon="arrowForwardOutline" aria-hidden="true"
                /></span>
                {{ currentBooking.to }}
              </h2>
              <b class="detail-status" :class="[currentBooking.status.toLowerCase(), currentBooking.paymentStatus.toLowerCase()]">{{
                currentBooking.paymentStatus === "REFUND_PENDING"
                  ? "REFUND PENDING"
                  : currentBooking.paymentStatus === "REFUNDED"
                    ? "REFUNDED"
                    : ["CANCELLED", "EXPIRED"].includes(currentBooking.status)
                      ? currentBooking.status
                      : currentBooking.paymentStatus === "PAID"
                        ? awaitingPaymentVerification(currentBooking) ? "AWAITING STAFF VERIFICATION" : "PAID"
                        : "PAYMENT PENDING"
              }}</b>
            </div>
            <p class="detail-reference">
              <span>Booking reference</span><strong>{{ currentBooking.reference }}</strong>
            </p>
            <div class="booking-meta">
              <div><span><ion-icon :icon="calendarOutline" aria-hidden="true" />Departure</span><strong>{{ currentBooking.date }} · {{ currentBooking.departure }}</strong></div>
              <div><span><ion-icon :icon="boatOutline" aria-hidden="true" />Ferry</span><strong>{{ currentBooking.vessel }}</strong></div>
            </div>
            <section class="detail-fares" aria-labelledby="detail-fares-heading">
              <h3 id="detail-fares-heading">Fare breakdown</h3>
              <div><span>Passenger fares</span><b>PHP {{ (currentBooking.total - (currentBooking.serviceFee || 0)).toLocaleString() }}</b></div>
              <div v-if="currentBooking.accommodationName || currentBooking.serviceFee"><span>Accommodation<small>{{ currentBooking.accommodationName || 'Standard' }}</small></span><b>PHP {{ (currentBooking.serviceFee || 0).toLocaleString() }}</b></div>
              <div v-if="currentBooking.voucherCode" class="detail-fare-total"><span>Voucher {{currentBooking.voucherCode}}</span><strong>- PHP {{currentBooking.voucherDiscount}}</strong></div>
              <div class="detail-fare-total"><strong>Booking total</strong><strong>PHP {{ currentBooking.total.toLocaleString() }}</strong></div>
            </section>
            <div class="detail-passengers">
              <h3>Passengers ({{ currentBooking.passengers.length }})</h3>
              <div
                v-for="(person, index) in currentBooking.passengers"
                :key="person.id || index"
              >
                <span class="ticket-person-icon"
                  ><ion-icon :icon="personOutline" aria-hidden="true" /></span
                ><span
                  ><strong>{{ person.name }}</strong
                  ><small>{{ person.type === 'PWD' ? 'PWD' : person.type.replaceAll('_', ' ').toLowerCase() }} passenger</small></span>
                <b class="detail-person-fare">PHP {{ person.fare.toLocaleString() }}<small>Base fare</small></b>
              </div>
            </div>
            <div
              v-if="
                currentBooking.paymentStatus === 'UNPAID' &&
                ['PENDING', 'CONFIRMED'].includes(currentBooking.status)
              "
              class="detail-payment"
            >
            <OnlinePayment
              v-if="currentBooking.paymentStatus === 'UNPAID' && ['PENDING','CONFIRMED'].includes(currentBooking.status)"
              :booking-id="currentBooking.id" :reference="currentBooking.reference" @updated="loadData"
            />
            <PaymentDeadline
              v-if="currentBooking.paymentDeadline"
              :deadline="currentBooking.paymentDeadline"
              @expired="loadData"
            />
              <h3 v-else>Pay before departure</h3>
              <p>Pay before the deadline to receive your QR ticket. Booking fee: PHP 0.</p>
            </div>
            <p v-if="currentBooking.paymentStatus === 'PAID'" class="payment-hint">{{ awaitingPaymentVerification(currentBooking) ? 'Payment received — Awaiting staff verification' : 'Payment confirmed' }} · {{ paymentMethodLabel(currentBooking) }}</p>
            <p v-if="currentBooking.cancellationReason" class="payment-hint">
              {{ currentBooking.cancellationReason }}
            </p>
            <p
              v-if="currentBooking.paymentStatus === 'REFUND_PENDING'"
              class="payment-hint"
            >
              {{ currentBooking.paymentMethod === 'PAYMONGO_TEST' ? 'Contact ticketing for assistance with your online payment.' : 'Visit the ticketing desk for your cash refund.' }}
            </p>
            <div class="detail-actions">
              <ion-button
                v-if="
                  bookingTicketReady(currentBooking)
                "
                class="primary"
                :router-link="`/ticket?reference=${encodeURIComponent(currentBooking.reference)}`"
                >View e-ticket</ion-button
              ><ion-button fill="outline" router-link="/bookings"
                >All bookings</ion-button
              >
            </div>
          </article>
          <div v-else class="empty-state">
            <h2>No active reservation</h2>
            <p>Book a sailing to see trip details here.</p>
            <ion-button class="primary" router-link="/search"
              >Find a sailing</ion-button
            >
          </div></template
        >
        <template v-else-if="kind === 'notifications'"
          ><div class="notification-toolbar">
            <span>{{ unreadCount }} unread</span
            ><button
              :disabled="noticeBusy || !unreadCount"
              @click="markAllRead"
            >
              {{ noticeBusy ? "Updating?" : "Mark all read" }}
            </button>
          </div>
          <div class="notification-filters">
            <button
              v-for="category in notificationCategories"
              :key="category"
              :class="{ active: notificationFilter === category }"
              @click="notificationFilter = category"
            >
              {{ category }}
            </button>
          </div>
          <div class="notifications">
            <article
              v-for="notice in filteredNotices"
              :key="notice.id"
              :class="{ unread: notice.unread }"
            >
              <span class="notice-icon" :class="notice.type.toLowerCase()"
                ><ion-icon :icon="noticeIcon(notice.type)" aria-hidden="true"
              /></span>
              <div>
                <strong>{{ notice.title }}</strong>
                <p>{{ notice.body }}</p>
                <small>{{ notice.time }}</small>
              </div>
              <button v-if="notice.unread" @click="markNotice(notice)">
                <ion-icon :icon="checkmarkOutline" aria-hidden="true" /> Mark
                read
              </button>
            </article>
          </div>
          <div v-if="!filteredNotices.length" class="empty-state">
            <h2>No notifications</h2>
            <p>Booking and sailing updates will appear here.</p>
          </div></template
        >
        <template v-else
          ><section class="profile-card glass-panel">
            <div class="profile-identity">
              <span class="profile-avatar"
                ><ion-icon :icon="personOutline" aria-hidden="true"
              /></span>
              <p class="profile-kicker">PASSENGER PROFILE</p>
              <h2>{{ profile.name }}</h2>
              <p>{{ profile.email }}</p>
            </div>
            <form @submit.prevent="saveProfile">
              <label
                ><span class="field-label"
                  ><ion-icon :icon="personOutline" aria-hidden="true" /> Full
                  name</span
                ><input
                  v-model.trim="profile.name"
                  autocomplete="name"
                  required /></label
              ><label
                ><span class="field-label"
                  ><ion-icon :icon="mailOutline" aria-hidden="true" /> Email
                  address</span
                ><input
                  v-model.trim="profile.email"
                  type="email"
                  autocomplete="email"
                  readonly /></label
              ><label
                ><span class="field-label"
                  ><ion-icon :icon="callOutline" aria-hidden="true" /> Mobile
                  number</span
                ><input
                  v-model.trim="profile.phone"
                  type="tel"
                  autocomplete="tel"
                  placeholder="09XX XXX XXXX" /></label
              ><ion-button type="submit" class="primary"
                ><ion-icon
                  slot="start"
                  :icon="saved ? checkmarkOutline : saveOutline"
                />{{ saved ? "Saved" : "Save changes" }}</ion-button
              >
            </form>
            <router-link :to="{ name: 'settings' }" class="settings-link"
              ><ion-icon :icon="settingsOutline" aria-hidden="true" />
              Preferences & settings
            </router-link></section
        ></template>
        <p class="prototype-note">
          Your bookings, e-tickets, notifications, and profile are synced with
          the reservation database.
        </p>
      </main>
      <PassengerBottomNav /></ion-content
  ></ion-page>
</template>
<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { confirmAction } from "../../composables/confirmation";
import PaymentDeadline from "../../components/passenger/PaymentDeadline.vue";
import OnlinePayment from "../../components/passenger/OnlinePayment.vue";
import { markAllNotificationsRead } from "../../services/database/experience";
import { clearNotificationUnread, setUnreadNotifications } from "../../composables/notificationUnread";
import { downloadTicket, shareTicket } from "../../data/ticketExport";
import { useQueueRefresh } from "../../composables/queueRefresh";
import { databaseRequestError } from "../../data/databaseErrors";
import { computed, ref, watch } from "vue";
import QRCode from "qrcode";
import { useRoute, useRouter } from "vue-router";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  onIonViewWillEnter,
} from "@ionic/vue";
import {
  arrowForwardOutline,
  bookmarkOutline,
  boatOutline,
  calendarOutline,
  documentTextOutline,
  callOutline,
  checkmarkCircleOutline,
  checkmarkOutline,
  mailOutline,
  notificationsOutline,
  peopleOutline,
  personOutline,
  saveOutline,
  settingsOutline,
  ticketOutline,
  timeOutline,
  printOutline,
  downloadOutline,
  shareOutline,
} from "ionicons/icons";
import PassengerHeader from "../../components/passenger/PassengerHeader.vue";
import PaymentReturn from "../../components/passenger/PaymentReturn.vue";
import { paymentMethodLabel } from "../../data/paymentMethod";
import { awaitingPaymentVerification, bookingTicketReady } from "../../data/paymentVerification";
import PassengerBottomNav from "../../components/passenger/PassengerBottomNav.vue";
import {
  cancelMyBooking,
  markNotificationRead,
  myBookings,
  myNotifications,
  myProfile,
  updateMyProfile,
} from "../../services/database/passenger";
import { auth, database } from "../../services/session";
type Passenger = {
  id?: string;
  name: string;
  type: string;
  fare: number;
  ticketCode?: string;
  ticketQrPayload?: string | null;
  ticketStatus?: string;
};
type Booking = {
  paymentMethod?: string | null;
  paymentProviderMethod?: string | null;
  paymentVerificationRequired?: boolean | null;
  voucherCode?: string | null;
  voucherDiscount?: number;
  accommodationName?: string | null;
  serviceFee?: number;
  paymentDeadline?: string | null;
  cancellationReason?: string | null;
  paymentStatus: string;
  total: number;
  id: string;
  departureAt: string;
  sailingCode: string;
  passengerCount: number;
  reference: string;
  from: string;
  to: string;
  date: string;
  departure?: string;
  time?: string;
  vessel: string;
  status: string;
  passengers: Passenger[];
  arrival?: string;
};
const route = useRoute();
const router = useRouter();
function chooseTicket(event: Event) {
  const reference = (event.target as HTMLSelectElement).value;
  void router.replace({ path: '/ticket', query: { reference } });
}
const kind = computed(() => String(route.name || "bookings"));
const bookingSearch = ref(""),
  bookingPayment = ref("ALL");
const tabs = ["Upcoming", "Past departures", "Cancelled", "Expired"];
const selectedTab = ref("Upcoming");
const bookings = ref<Booking[]>([]);
const returnedBooking = computed(() => ['returned', 'cancelled'].includes(String(route.query.payment))
  ? bookings.value.find(booking => booking.reference === route.query.reference) : undefined);
const returnVerificationPending = ref(true);
function paymentVerified() {
  returnVerificationPending.value = false;
  void loadData();
}
const notices = ref<
  Array<{
    id: string;
    title: string;
    body: string;
    type: string;
    time: string;
    unread: boolean;
  }>
>([]);
const loadError = ref("");
const notificationFilter = ref("ALL"),
  noticeBusy = ref(false),
  ticketBusy = ref(false),
  ticketNotice = ref("");
const unreadCount = computed(
  () => notices.value.filter((n) => n.unread).length,
);
const notificationCategories = computed(() => [
  "ALL",
  ...new Set(notices.value.map((n) => n.type)),
]);
const filteredNotices = computed(() =>
  notices.value.filter(
    (n) =>
      notificationFilter.value === "ALL" || n.type === notificationFilter.value,
  ),
);
async function markAllRead() {
  if (!database || noticeBusy.value) return;
  const uid = auth?.currentUser?.uid;
  noticeBusy.value = true;
  loadError.value = "";
  try {
    await markAllNotificationsRead(database);
    clearNotificationUnread(undefined, uid);
    notices.value.forEach(notice => { notice.unread = false; });
    await loadData();
  } catch (cause) {
    loadError.value = databaseRequestError(
      cause,
      "Could not mark notifications read.",
    );
  } finally {
    noticeBusy.value = false;
  }
}
async function exportTicket(mode: "download" | "share") {
  if (!currentBooking.value || ticketBusy.value) return;
  ticketBusy.value = true;
  ticketNotice.value = "";
  try {
    await (mode === "download" ? downloadTicket : shareTicket)(
      currentBooking.value,
    );
    ticketNotice.value =
      mode === "download"
        ? "Ticket downloaded. Open the file to view or print."
        : "Ticket shared.";
  } catch (cause) {
    ticketNotice.value = databaseRequestError(
      cause,
      "Could not export ticket.",
    );
  } finally {
    ticketBusy.value = false;
  }
}
function printTicket() {
  window.print();
}
const loading = ref(true);
const qrFailedCodes = ref<string[]>([]);
const qrImages = ref<Record<string, string>>({});
let qrRequest = 0;
watch(
  () =>
    bookings.value
      .flatMap((b) => b.passengers.map((p) => p.ticketQrPayload || ""))
      .join("|"),
  async () => {
    const request = ++qrRequest;
    const tickets = bookings.value.flatMap(b=>b.passengers).filter(p=>p.ticketCode && p.ticketQrPayload);
    const results = await Promise.all(
      tickets.map(async (person) => {
        const code=person.ticketCode!;
        try {
          return [
            code,
            await QRCode.toDataURL(person.ticketQrPayload!, {
              width: 360,
              margin: 4,
              errorCorrectionLevel: "M",
            }),
          ] as const;
        } catch {
          markQrUnavailable(code);
          return [code, ""] as const;
        }
      }),
    );
    if (request === qrRequest) qrImages.value = Object.fromEntries(results);
  },
);
function qrImageUrl(ticketCode?: string) {
  return ticketCode ? qrImages.value[ticketCode] || "" : "";
}
function markQrUnavailable(ticketCode: string) {
  if (!qrFailedCodes.value.includes(ticketCode))
    qrFailedCodes.value.push(ticketCode);
}

const ticketBookings = computed(() =>
  bookings.value
    .filter(
      (item) =>
        bookingTicketReady(item) &&
        item.passengers.some(
          (person) =>
            person.ticketCode &&
            ["ISSUED", "CHECKED_IN", "BOARDED"].includes(
              person.ticketStatus || "",
            ),
        ),
    )
    .sort((a, b) => b.departureAt.localeCompare(a.departureAt)),
);
const currentBooking = computed(() => {
  const selected = String(route.query.reference || "");
  if (selected)
    return bookings.value.find((item) => item.reference === selected) || null;
  if (kind.value === "ticket")
    return (
      ticketBookings.value
        .filter((item) => new Date(item.departureAt) > new Date())
        .sort((a, b) => a.departureAt.localeCompare(b.departureAt))[0] ||
      ticketBookings.value[0] ||
      null
    );
  return (
    bookings.value.find(
      (item) =>
        !["CANCELLED", "EXPIRED"].includes(item.status) &&
        new Date(item.departureAt) > new Date(),
    ) || null
  );
});
const visibleBookings = computed(() =>
  bookings.value
    .filter((item) => {
      if (selectedTab.value === "Cancelled") return item.status === "CANCELLED";
      if (selectedTab.value === "Expired") return item.status === "EXPIRED";
      if (selectedTab.value === "Past departures")
        return (
          !["CANCELLED", "EXPIRED"].includes(item.status) &&
          new Date(item.departureAt) <= new Date()
        );
      return (
        !["CANCELLED", "EXPIRED"].includes(item.status) &&
        new Date(item.departureAt) > new Date()
      );
    })
    .filter(
      (item) =>
        (bookingPayment.value === "ALL" ||
          item.paymentStatus === bookingPayment.value) &&
        (!bookingSearch.value ||
          [
            item.reference,
            item.from,
            item.to,
            item.vessel,
            ...item.passengers.map((p) => p.name),
          ]
            .join(" ")
            .toLowerCase()
            .includes(bookingSearch.value.toLowerCase())),
    ),
);
const title = computed(
  () =>
    ({
      ticket: "Your e-ticket",
      bookings: "My bookings",
      "booking-details": "Booking details",
      notifications: "Notifications",
      profile: "Your profile",
    })[kind.value] || "My bookings",
);
const eyebrow = computed(
  () =>
    ({
      ticket: "DIGITAL PASS",
      bookings: "YOUR TRAVEL",
      "booking-details": "RESERVATION DETAILS",
      notifications: "TRAVEL UPDATES",
      profile: "ACCOUNT",
    })[kind.value] || "YOUR TRAVEL",
);
const description = computed(
  () =>
    ({
      ticket: "Your reservation details, ready for the terminal.",
      bookings: "Manage upcoming reservations and past journeys.",
      "booking-details":
        "Review the sailing, passengers and payment details for this reservation.",
      notifications: "Stay up to date with booking and sailing changes.",
      profile: "Keep your contact details up to date.",
    })[kind.value] || "",
);
const profile = ref({ name: "", email: "", phone: "" });
const saved = ref(false);
const formatDay = (v: string) =>
  new Date(v).toLocaleDateString("en-PH", {
        timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const formatTime = (v: string) =>
  new Date(v).toLocaleTimeString("en-PH", {
        timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });
async function loadData() {
  loading.value = true;
  loadError.value = "";
  if (!database) {
    loadError.value =
      "Supabase is not configured. Add the project URL and publishable key to .env.local.";
    loading.value = false;
    return;
  }
  try {
    if (["bookings", "booking-details", "ticket"].includes(kind.value)) {
      const result = await myBookings(database, { fetchPolicy: "SERVER_ONLY" });
      bookings.value = result.data.bookings.map((item) => ({
        id: item.id,
        departureAt: item.sailing.departureAt,
        sailingCode: item.sailing.code,
        passengerCount: item.passengerCount,
        reference: item.reference,
        from: item.sailing.origin.name,
        to: item.sailing.destination.name,
        date: formatDay(item.sailing.departureAt),
        departure: formatTime(item.sailing.departureAt),
        arrival: formatTime(item.sailing.arrivalAt),
        vessel: item.sailing.vessel.name,
        status: item.status,
        paymentStatus: item.paymentStatus,
        voucherCode: item.voucherCode,
        voucherDiscount: item.voucherDiscount,
        paymentMethod: item.paymentMethod,
        paymentProviderMethod: item.paymentProviderMethod,
        paymentVerificationRequired: item.paymentVerificationRequired,
        paymentDeadline: item.paymentDeadline,
        cancellationReason: item.cancellationReason,
        total: item.total,
        accommodationName: item.accommodationName,
        serviceFee: item.serviceFee,
        passengers: item.bookingPassengers_on_booking.map((person) => ({
          id: person.id,
          name: person.fullName,
          type: person.passengerType,
          fare: person.fare,
          ticketCode: person.ticketCode,
          ticketQrPayload: person.ticketQrPayload,
          ticketStatus: person.ticketStatus,
        })),
      }));
    }
    if (kind.value === "notifications") {
      const uid = auth?.currentUser?.uid;
      const result = await myNotifications(database, {
        fetchPolicy: "SERVER_ONLY",
      });
      notices.value = result.data.notifications.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.message,
        type: item.category,
        time: formatDay(item.createdAt),
        unread: !item.readAt,
      }));
      setUnreadNotifications(result.data.notifications, uid);
    }
    if (kind.value === "profile") {
      const result = await myProfile(database, { fetchPolicy: "SERVER_ONLY" });
      profile.value = {
        name:
          result.data.user?.fullName || auth?.currentUser?.displayName || "",
        email: result.data.user?.email || auth?.currentUser?.email || "",
        phone: result.data.user?.phone || "",
      };
    }
  } catch (error) {
    loadError.value = databaseRequestError(
      error,
      "Could not load account data.",
    );
  } finally {
    loading.value = false;
  }
}
onIonViewWillEnter(() => {
  if (kind.value === "bookings")
    selectedTab.value = tabs.includes(String(route.query.tab))
      ? String(route.query.tab)
      : "Upcoming";
  void loadData();
});
useQueueRefresh(
  loadData,
  () =>
    ["/bookings", "/booking-details", "/ticket", "/notifications"].includes(
      route.path,
    ) && !loading.value,
);
async function cancel(reference: string) {
  if (!database) return;
  const item = bookings.value.find((x) => x.reference === reference);
  if (!item) return;
  if (new Date(item.departureAt) <= new Date()) {
    loadError.value = "Departed trips cannot be cancelled.";
    return;
  }
  if (
    !(await confirmAction({
      title: "Cancel reservation?",
      message: `Cancel reservation ${reference} and release ${item.passengerCount} reserved seat(s)? No payment has been collected.`,
      confirmText: "Cancel reservation",
      danger: true,
    }))
  )
    return;
  try {
    await cancelMyBooking(database, {
      id: item.id,
      sailingCode: item.sailingCode,
      passengerCount: item.passengerCount,
    });
    await loadData();
    selectedTab.value = "Cancelled";
  } catch (error) {
    loadError.value = databaseRequestError(
      error,
      "Could not cancel reservation.",
    );
  }
}
function noticeIcon(type: string) {
  return type === "TRIPS"
    ? timeOutline
    : type === "SYSTEM"
      ? notificationsOutline
      : ticketOutline;
}
async function markNotice(notice: { id: string; unread: boolean }) {
  if (!database) return;
  const uid = auth?.currentUser?.uid;
  try {
    await markNotificationRead(database, { id: notice.id });
    notice.unread = false;
    clearNotificationUnread(notice.id, uid);
  } catch (error) {
    loadError.value = databaseRequestError(
      error,
      "Could not update notification.",
    );
  }
}
async function saveProfile() {
  if (!database) return;
  try {
    await updateMyProfile(database, {
      fullName: profile.value.name,
      phone: profile.value.phone || null,
    });
    saved.value = true;
    window.setTimeout(() => (saved.value = false), 1800);
  } catch (error) {
    loadError.value = databaseRequestError(error, "Could not save profile.");
  }
}
</script>
<style scoped>
.demo-page {
  max-width: 920px;
  margin: auto;
  padding: 26px 32px 110px;
}
.demo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.demo-header > a {
  text-decoration: none;
}
.header-tools {
  display: flex;
  align-items: center;
  gap: 15px;
}
.role-link,
.settings-link {
  color: var(--ocean);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}
.avatar,
.profile-avatar {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #d9edf8;
  color: var(--ocean);
  font-weight: 800;
}
.page-title {
  margin: 58px 0 25px;
}
.kicker {
  margin: 0;
  color: var(--ocean);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
}
.page-title h1 {
  margin: 8px 0 5px;
  font-size: 32px;
  letter-spacing: -1px;
}
.page-title > p:last-child {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
.tabs {
  display: flex;
  gap: 24px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--line);
}
.tabs button {
  padding: 0 0 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--muted);
  font-weight: 700;
  cursor: pointer;
}
.tabs button.selected {
  border-color: var(--ocean);
  color: var(--ocean);
}
.booking-list,
.notifications {
  display: grid;
  gap: 12px;
}
.booking-card,
.ticket,
.profile-card,
.notifications article,
.booking-detail-card {
  border: 1px solid var(--line);
  border-radius: 16px;
  background: white;
  box-shadow: 0 9px 28px #102b4c0a;
}
.booking-card {
  display: flex;
  gap: 15px;
  padding: 19px;
}
.booking-detail-card {
  padding: 22px;
}
.detail-reference {
  margin: 7px 0 16px;
  color: var(--muted);
  font-size: 11px;
}
.detail-passengers {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.detail-passengers h3 {
  margin: 0 0 8px;
  font-size: 14px;
}
.detail-passengers > div {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
}
.detail-passengers > div > span:last-child {
  display: grid;
  gap: 3px;
}
.detail-passengers small {
  color: var(--muted);
  font-size: 10px;
}
.detail-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}
.detail-actions ion-button {
  --border-radius: 9px;
  text-transform: none;
  font-weight: 800;
}
.booking-symbol,
.notice-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 20px;
}
.booking-copy {
  flex: 1;
  min-width: 0;
}
.row-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.row-heading h2 {
  margin: 2px 0;
  font-size: 17px;
}
.row-heading h2 span {
  color: var(--muted);
}
.row-heading > b {
  height: max-content;
  padding: 5px 8px;
  border-radius: 6px;
  background: #e6f7ef;
  color: #117a52;
  font-size: 9px;
}
.row-heading > b.completed {
  background: #edf1f5;
  color: #667486;
}
.row-heading > b.cancelled {
  background: #ffebe7;
  color: var(--danger);
}
.booking-copy p {
  margin: 5px 0;
  color: var(--muted);
  font-size: 12px;
}
.booking-copy > small {
  color: var(--muted);
  font-size: 10px;
}
.booking-actions {
  display: flex;
  gap: 16px;
  margin-top: 12px;
}
.booking-actions a,
.booking-actions button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ocean);
  font-size: 11px;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}
.booking-actions button {
  color: var(--danger);
}
.empty-state {
  padding: 55px 20px;
  border: 1px dashed #bdd3df;
  border-radius: 16px;
  text-align: center;
  background: #fff;
}
.empty-icon {
  display: grid;
  place-items: center;
  width: 55px;
  height: 55px;
  margin: 0 auto 14px;
  border-radius: 50%;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 25px;
}
.empty-state h2 {
  margin: 0 0 6px;
}
.empty-state p {
  color: var(--muted);
  font-size: 13px;
}
.primary {
  --background: var(--ocean);
  --box-shadow: none;
  --border-radius: 9px;
  text-transform: none;
  font-weight: 800;
}
.ticket {
  max-width: 680px;
  margin: auto;
  overflow: hidden;
}
.ticket-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 25px;
  background: var(--deep);
  color: white;
}
.ticket-head small {
  color: #9cc9e3;
  font-size: 9px;
  letter-spacing: 0.1em;
}
.ticket-head h2 {
  margin: 8px 0 0;
  font-size: 24px;
}
.ticket-head h2 span {
  color: #83c4e2;
}
.ticket-head > b {
  padding: 6px 9px;
  border-radius: 6px;
  background: #dff5ec;
  color: #13764d;
  font-size: 9px;
}
.ticket-meta {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr;
  gap: 12px;
  padding: 21px 24px;
  border-bottom: 1px dashed var(--line);
}
.ticket-meta small,
.ticket-meta strong {
  display: block;
}
.ticket-meta small {
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
}
.ticket-meta strong {
  margin-top: 6px;
  font-size: 11px;
}
.ticket-passengers {
  padding: 18px 24px;
}
.ticket-passengers h3 {
  margin: 0 0 8px;
  font-size: 14px;
}
.ticket-person {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--line);
}
.initial {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 10px;
  font-weight: 800;
}
.ticket-person > div {
  flex: 1;
}
.ticket-person strong,
.ticket-person small {
  display: block;
}
.ticket-person strong {
  font-size: 12px;
}
.ticket-person small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 10px;
}
.ticket-person > b {
  color: #13764d;
  font-size: 9px;
}
.ticket-foot {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 18px 24px;
  background: #f8fafc;
}
.ticket-foot p {
  max-width: 330px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}
.fake-qr {
  display: grid;
  grid-template-columns: repeat(8, 6px);
  gap: 2px;
  padding: 5px;
  border: 1px solid var(--line);
  background: white;
}
.fake-qr i {
  width: 6px;
  height: 6px;
  background: #fff;
}
.fake-qr i.dark {
  background: var(--deep);
}
.notifications article {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 16px;
}
.notifications article.unread {
  border-left: 3px solid var(--ocean);
}
.notifications article > div {
  flex: 1;
}
.notifications strong {
  font-size: 13px;
}
.notifications p {
  margin: 4px 0;
  color: var(--muted);
  font-size: 11px;
}
.notifications small {
  color: var(--muted);
  font-size: 10px;
}
.notifications button {
  border: 0;
  background: none;
  color: var(--ocean);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}
.profile-card {
  max-width: 520px;
  padding: 25px;
  text-align: center;
}
.profile-avatar {
  width: 64px;
  height: 64px;
  margin: 0 auto 12px;
  font-size: 20px;
}
.profile-card > h2 {
  margin: 0;
}
.profile-card > p {
  margin: 5px 0 20px;
  color: var(--muted);
  font-size: 12px;
}
.profile-card form {
  display: grid;
  gap: 13px;
  text-align: left;
}
.profile-card label {
  display: grid;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
}
.profile-card input {
  height: 42px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font: inherit;
}
.profile-card form ion-button {
  margin-top: 4px;
}
.settings-link {
  display: inline-block;
  margin-top: 18px;
}
.prototype-note {
  margin-top: 18px;
  color: var(--muted);
  font-size: 10px;
  text-align: center;
}
@container passenger (max-width:620px) {
  .detail-actions {
    flex-direction: column;
  }
  .detail-actions ion-button {
    width: 100%;
    margin: 0;
  }
  .demo-page {
    padding: 20px 16px 102px;
  }
  .page-title {
    margin: 43px 0 22px;
  }
  .page-title h1 {
    font-size: 28px;
  }
  .role-link {
    font-size: 10px;
  }
  .booking-card {
    padding: 14px;
  }
  .row-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 5px;
  }
  .ticket-meta {
    grid-template-columns: 1fr 1fr;
    padding: 17px 18px;
  }
  .ticket-meta > div:last-child {
    grid-column: 1/-1;
  }
  .ticket-head {
    padding: 19px;
  }
  .ticket-head h2 {
    font-size: 20px;
  }
  .ticket-foot {
    padding: 15px;
  }
  .tabs {
    gap: 15px;
  }
  .tabs button {
    font-size: 11px;
  }
}
.ticket-title {
  min-width: 0;
}
.ticket-title small,
.ticket-meta small,
.ticket-passengers h3 {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ticket-title small ion-icon {
  font-size: 14px;
}
.ticket-head h2 span {
  display: inline-flex;
  vertical-align: middle;
}
.ticket-head h2 span ion-icon {
  font-size: 18px;
}
.ticket-meta small ion-icon {
  flex: none;
  color: var(--ocean);
  font-size: 14px;
}
.ticket-meta strong {
  overflow-wrap: anywhere;
  line-height: 1.5;
}
.ticket-passengers h3 ion-icon {
  color: var(--ocean);
  font-size: 17px;
}
.ticket-person-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--light-blue);
  color: var(--ocean);
}
.ticket-person-icon ion-icon {
  font-size: 19px;
}
.ticket-person > div {
  min-width: 0;
}
.ticket-person strong {
  overflow-wrap: anywhere;
}
.ticket-person > b {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.ticket-person > b ion-icon {
  font-size: 14px;
}
.ticket-foot {
  min-height: 110px;
  background: var(--surface-soft);
}
.ticket-code {
  display: grid;
  place-items: center;
  gap: 4px;
  flex: none;
  width: 76px;
  height: 76px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--light-blue);
  color: var(--ocean);
}
.ticket-code ion-icon {
  font-size: 40px;
}
.ticket-code small {
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.06em;
}
.empty-icon ion-icon {
  font-size: 27px;
}
@container passenger (max-width:620px) {
  .ticket-head {
    align-items: flex-start;
    gap: 12px;
    padding: 18px 16px;
  }
  .ticket-head h2 {
    font-size: 19px;
  }
  .ticket-head > b {
    flex: none;
  }
  .ticket-meta {
    gap: 16px 12px;
    padding: 16px;
  }
  .ticket-meta strong {
    font-size: 11px;
  }
  .ticket-passengers {
    padding: 16px;
  }
  .ticket-foot {
    align-items: flex-start;
    gap: 12px;
  }
  .ticket-foot p {
    margin: 0;
    font-size: 10px;
  }
  .ticket-code {
    width: 66px;
    height: 66px;
  }
  .ticket-code ion-icon {
    font-size: 34px;
  }
  .ticket-person > b {
    font-size: 8px;
  }
}
.booking-card {
  background: var(--surface);
  border-color: var(--line);
  padding: 20px;
}
.booking-list,
.tabs {
  max-width: 760px;
  margin-left: auto;
  margin-right: auto;
}
.booking-symbol {
  background: var(--light-blue);
  color: var(--ocean);
}
.booking-symbol ion-icon {
  font-size: 21px;
}
.booking-copy {
  min-width: 0;
}
.booking-card .row-heading {
  align-items: center;
}
.booking-card .row-heading h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.booking-card .row-heading h2 span {
  display: inline-flex;
  flex: none;
  color: var(--ocean);
}
.booking-card .row-heading h2 span ion-icon {
  font-size: 16px;
}
.booking-card .row-heading > b {
  flex: none;
}
.row-heading > b.pending {
  background: #fff1d2;
  color: #9a5b00;
}
.booking-meta,
.booking-reference {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 18px;
  color: var(--muted);
  font-size: 11px;
}
.booking-meta {
  margin: 9px 0 6px;
}
.booking-reference {
  font-size: 10px;
}
.booking-meta span,
.booking-reference span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.booking-meta ion-icon,
.booking-reference ion-icon {
  flex: none;
  color: var(--ocean);
  font-size: 14px;
}
.booking-actions {
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
}
.booking-actions a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.booking-actions a ion-icon {
  font-size: 15px;
}
.empty-state {
  background: var(--surface);
  border-color: var(--line);
}
.empty-icon {
  background: var(--light-blue);
  color: var(--ocean);
}
@container passenger (max-width:620px) {
  .booking-card {
    align-items: flex-start;
    gap: 11px;
    padding: 15px;
  }
  .booking-symbol {
    width: 38px;
    height: 38px;
  }
  .booking-card .row-heading {
    align-items: flex-start;
    gap: 8px;
  }
  .booking-card .row-heading h2 {
    font-size: 15px;
    line-height: 1.35;
  }
  .booking-card .row-heading > b {
    font-size: 8px;
  }
  .booking-meta,
  .booking-reference {
    gap: 7px 12px;
    font-size: 10px;
  }
  .booking-actions {
    gap: 11px 15px;
  }
  .booking-actions a,
  .booking-actions button {
    font-size: 10px;
  }
}
.notifications {
  max-width: 760px;
  margin: 0 auto;
}
.notifications article {
  background: var(--surface);
  border-color: var(--line);
  box-shadow: 0 9px 28px #102b4c12;
}
.notifications article.unread {
  border-left: 3px solid var(--ocean);
  background: var(--surface-soft);
}
.notice-icon {
  width: 42px;
  height: 42px;
  background: var(--light-blue);
  color: var(--ocean);
}
.notice-icon ion-icon {
  font-size: 20px;
}
.notice-icon.trips {
  background: #3a2c13;
  color: #f0ba52;
}
.notice-icon.system {
  background: #11352f;
  color: #49c9a5;
}
.notifications article > div {
  min-width: 0;
}
.notifications strong {
  color: var(--ink);
  line-height: 1.4;
}
.notifications p {
  color: var(--muted);
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.notifications button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}
.notifications button ion-icon {
  font-size: 14px;
}
@container passenger (max-width:620px) {
  .notifications article {
    align-items: flex-start;
    gap: 10px;
    padding: 14px;
  }
  .notice-icon {
    width: 38px;
    height: 38px;
  }
  .notifications article > div {
    flex: 1;
  }
  .notifications button {
    grid-column: 2;
    justify-self: start;
    margin-left: 48px;
    margin-top: -2px;
  }
  .notifications article {
    flex-wrap: wrap;
  }
  .notifications article > div {
    min-width: calc(100% - 52px);
  }
}
.profile-card {
  margin: 0 auto;
  background: var(--surface);
  border-color: var(--line);
  color: var(--ink);
  box-shadow: 0 12px 32px #102b4c14;
  text-align: left;
}
.profile-identity {
  text-align: center;
  margin-bottom: 24px;
}
.profile-avatar {
  width: 58px;
  height: 58px;
  margin: 0 auto 12px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 27px;
}
.profile-kicker {
  margin: 0 0 6px !important;
  color: var(--ocean) !important;
  font-size: 9px !important;
  font-weight: 800;
  letter-spacing: 0.12em;
}
.profile-identity h2 {
  color: var(--ink);
}
.profile-identity > p:last-child {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 12px;
}
.profile-card form {
  gap: 16px;
}
.profile-card label {
  color: var(--ink);
}
.field-label {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}
.field-label ion-icon {
  color: var(--ocean);
  font-size: 15px;
}
.profile-card input {
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
}
.profile-card input:focus {
  outline: 2px solid color-mix(in srgb, var(--ocean) 35%, transparent);
  outline-offset: 1px;
}
.profile-card form ion-button {
  width: 100%;
  height: 46px;
  margin: 3px 0 0;
}
.settings-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 16px;
  padding: 11px 8px;
  border-top: 1px solid var(--line);
  color: var(--ocean);
  font-size: 11px;
}
.settings-link ion-icon {
  font-size: 15px;
}
.settings-link .settings-arrow {
  margin-left: auto;
}
@container passenger (max-width:620px) {
  .profile-card {
    width: 100%;
    padding: 19px 16px;
  }
  .profile-identity {
    margin-bottom: 20px;
  }
  .profile-avatar {
    width: 52px;
    height: 52px;
  }
  .profile-card form {
    gap: 14px;
  }
  .profile-card form ion-button {
    height: 44px;
  }
  .settings-link {
    margin-top: 12px;
  }
}
@container passenger (max-width:620px) {
  .demo-page {
    padding: 20px 16px 104px;
  }
  .page-title {
    margin: 38px 0 22px;
  }
  .page-title h1 {
    font-size: 27px;
  }
  .booking-card {
    padding: 15px;
  }
  .row-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .ticket-meta {
    grid-template-columns: 1fr 1fr;
  }
  .ticket-meta > div:last-child {
    grid-column: 1/-1;
  }
  .detail-actions {
    flex-direction: column;
  }
  .detail-actions ion-button {
    width: 100%;
  }
}

.ticket-pass {
  padding: 12px 0;
  border-top: 1px solid var(--line);
}
.ticket-pass:first-of-type {
  border-top: 0;
}
.ticket-pass .ticket-person {
  padding: 2px 0 12px;
  border: 0;
}
.qr-block {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-soft);
}
.qr-block img {
  display: block;
  width: 180px;
  height: 180px;
  flex: none;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  object-fit: contain;
}
.qr-block > div {
  min-width: 0;
}
.qr-block small {
  display: block;
  color: var(--ocean);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.qr-block code {
  display: block;
  margin-top: 8px;
  color: var(--ink);
  font-size: 11px;
  overflow-wrap: anywhere;
}
.qr-block p {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.45;
}
.qr-unavailable {
  display: block;
  color: #a65530;
  font-size: 11px;
  line-height: 1.5;
}
.ticket-picker {
  display: flex;
  gap: 9px;
  max-width: 680px;
  margin: 0 auto 14px;
  overflow-x: auto;
  padding: 1px 1px 7px;
}
.ticket-picker a {
  display: grid;
  gap: 4px;
  flex: 0 0 auto;
  max-width: 240px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  text-decoration: none;
}
.ticket-picker a.selected {
  border-color: var(--ocean);
  background: var(--light-blue);
}
.ticket-picker strong {
  font-size: 11px;
}
.ticket-picker small {
  color: var(--muted);
  font-size: 9px;
}
@container passenger (max-width:480px) {
  .qr-block {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .qr-block img {
    align-self: center;
  }
  .qr-block > div {
    text-align: center;
  }
}
.payment-hint {
  display: block;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  margin: 8px 0;
}
.booking-detail-card {
  overflow: hidden;
  padding: 0;
  background: var(--surface);
  border-color: var(--line);
  color: var(--ink);
}
.booking-detail-card .row-heading {
  align-items: flex-start;
  padding: 20px 20px 0;
}
.booking-detail-card .row-heading h2 {
  margin: 0;
  color: var(--ink);
  font-size: 20px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.booking-detail-card .row-heading h2 span {
  display: inline-flex;
  vertical-align: middle;
  color: var(--ocean);
}
.booking-detail-card .row-heading > b {
  flex: none;
}
.booking-detail-card .detail-reference {
  display: inline-flex;
  margin: 12px 20px 0;
  padding: 6px 9px;
  border-radius: 7px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 10px;
  font-weight: 800;
}
.booking-detail-card .booking-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 20px 20px 0;
  padding: 0 0 18px;
  border-bottom: 1px solid var(--line);
}
.booking-detail-card .booking-meta span {
  align-items: flex-start;
  color: var(--ink);
  font-size: 11px;
  line-height: 1.45;
}
.booking-detail-card .detail-passengers {
  margin: 0 20px;
  padding: 18px 0 0;
  border: 0;
}
.booking-detail-card .detail-passengers h3 {
  margin: 0 0 12px;
  color: var(--ink);
  font-size: 14px;
}
.booking-detail-card .detail-passengers > div {
  border-top: 1px solid var(--line);
}
.booking-detail-card .detail-passengers strong {
  color: var(--ink);
}
.booking-detail-card .detail-passengers small {
  color: var(--muted);
}
.booking-detail-card .payment-hint {
  margin: 16px 20px 0;
}
.booking-detail-card .detail-actions {
  margin: 18px 20px 20px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}
.booking-detail-card .detail-actions ion-button[fill="outline"] {
  --color: var(--ocean);
  --border-color: var(--line);
}
@container passenger (max-width:380px) {
  .booking-detail-card .booking-meta {
    grid-template-columns: 1fr;
  }
  .booking-detail-card .row-heading h2 {
    font-size: 18px;
  }
}
.notification-toolbar,
.ticket-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 15px 0;
}
.notification-toolbar {
  justify-content: space-between;
  font-size: 12px;
}
.notification-toolbar button,
.ticket-actions button,
.notification-filters button {
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--ocean);
  font-weight: 700;
  cursor: pointer;
}
.notification-filters {
  display: flex;
  gap: 8px;
  overflow: auto;
  margin-bottom: 18px;
}
.notification-filters button {
  font-size: 10px;
  white-space: nowrap;
}
.notification-filters .active {
  background: var(--ocean);
  color: white;
}
button:disabled {
  opacity: 0.5;
}
.booking-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 12px;
  margin: 20px 0;
}
.booking-filters label {
  display: grid;
  gap: 7px;
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
}
.booking-filters input,
.booking-filters select {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
}
.booking-actions {
  flex-wrap: wrap;
}
.clear-filters {
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--ocean);
  cursor: pointer;
}
@media (max-width: 500px) {
  .booking-filters {
    grid-template-columns: 1fr;
  }
}
/* Booking details use one padded card and distinct fare/payment sections. */
.booking-detail-card { padding: 20px; border-radius: 18px; }
.booking-detail-card .row-heading { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 0; }
.booking-detail-card .row-heading h2 { font-size: 22px; line-height: 1.5; }
.booking-detail-card .row-heading h2 span { margin-inline: 5px; }
.booking-detail-card .row-heading > .detail-status { padding: 5px 9px; border-radius: 6px; font-size: 10px; line-height: 1.5; letter-spacing: .025em; }
.booking-detail-card .detail-status.unpaid.pending { color: #8a5100; background: #fff0d5; }
.booking-detail-card .detail-status.paid { color: var(--ocean); background: var(--light-blue); }
.booking-detail-card .detail-reference { display: grid; gap: 5px; margin: 18px 0 0; padding: 0; border-radius: 0; background: none; font-weight: 400; }
.booking-detail-card .detail-reference span { color: var(--muted); font-size: 11px; }
.booking-detail-card .detail-reference strong { color: var(--ink); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.booking-detail-card .booking-meta { margin: 20px 0 0; padding: 18px 0; border-top: 1px solid var(--line); gap: 16px; }
.booking-detail-card .booking-meta > div { min-width: 0; }
.booking-detail-card .booking-meta span { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted); }
.booking-detail-card .booking-meta strong { display: block; margin-top: 7px; color: var(--ink); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.detail-fares { margin-top: 20px; padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); }
.detail-fares h3, .booking-detail-card .detail-passengers h3 { margin: 0 0 14px; font-size: 14px; line-height: 1.5; color: var(--ink); }
.detail-fares > div { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-top: 12px; color: var(--muted); font-size: 12px; line-height: 1.6; }
.detail-fares > div > span { min-width: 0; overflow-wrap: anywhere; }
.detail-fares b { flex: none; font-size: 12px; color: var(--ink); white-space: nowrap; }
.detail-fares small { display: block; margin-top: 3px; color: var(--muted); font-size: 11px; }
.detail-fares > .detail-fare-total { flex-wrap: wrap; align-items: center; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); color: var(--ink); }
.detail-fare-total strong:first-child { font-size: 13px; }
.detail-fare-total strong:last-child { font-size: 22px; line-height: 1.4; white-space: nowrap; }
.booking-detail-card .detail-passengers { margin: 24px 0 0; padding: 0; }
.booking-detail-card .detail-passengers > div { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: start; gap: 10px; padding: 14px 0; }
.booking-detail-card .detail-passengers > div > span:nth-child(2) { min-width: 0; overflow-wrap: anywhere; }
.booking-detail-card .detail-passengers strong { display: block; font-size: 14px; line-height: 1.5; }
.booking-detail-card .detail-passengers small { display: block; margin-top: 5px; font-size: 11px; line-height: 1.5; }
.detail-person-fare { text-align: right; white-space: nowrap; color: var(--ink); font-size: 12px; line-height: 1.5; }
.detail-person-fare small { font-weight: 400; }
.detail-payment { margin-top: 20px; }
.detail-payment > p { margin: 12px 0 0; color: var(--muted); font-size: 12px; line-height: 1.8; }
.detail-payment > h3 { font-size: 14px; color: var(--ink); }
.detail-payment :deep(.deadline) { display: grid; grid-template-columns: 24px minmax(0, 1fr); align-items: start; gap: 10px; margin: 0; padding: 16px; }
.detail-payment :deep(.deadline div) { min-width: 0; }
.detail-payment :deep(.deadline strong) { font-size: 13px; line-height: 1.5; }
.detail-payment :deep(.deadline small) { font-size: 12px; line-height: 1.6; }
.detail-payment :deep(.deadline b) { grid-column: 2; margin: 0; font-size: 15px; line-height: 1.5; }
.detail-payment :deep(.deadline b)::before { content: 'Time left · '; font-size: 11px; font-weight: 400; }
.booking-detail-card .payment-hint { margin: 16px 0 0; font-size: 13px; line-height: 1.7; }
.booking-detail-card .detail-actions { margin: 24px 0 0; padding-top: 18px; gap: 10px; }
.booking-detail-card .detail-actions ion-button { margin: 0; min-height: 46px; font-size: 13px; }
:global(:root[data-theme="dark"]) .booking-detail-card .detail-status.unpaid.pending { color: #ffda8a; background: #33260f; }
@container passenger (max-width:380px) {
  .booking-detail-card { padding: 16px; }
  .booking-detail-card .row-heading h2 { font-size: 19px; }
  .booking-detail-card .detail-passengers > div { grid-template-columns: 34px minmax(0, 1fr); }
  .detail-person-fare { grid-column: 2; text-align: left; }
  .booking-detail-card .detail-person-fare small { display: inline; margin-left: 6px; }
  .detail-payment :deep(.deadline) { padding: 12px; }
  .detail-payment :deep(.deadline b) { font-size: 13px; }
}
/* Compact booking list, independent of the ticket and detail screens. */
.bookings-page .page-title { margin: 24px 0 20px; }
.bookings-page .page-title h1 { font-size: 26px; line-height: 1.3; }
.bookings-page .booking-filters { grid-template-columns: minmax(0, 1fr); gap: 12px; margin: 0 0 18px; }
.bookings-page .booking-filters label { min-width: 0; font-size: 11px; font-weight: 600; }
.bookings-page .booking-filters label:last-child { grid-template-columns: minmax(0, 1fr); gap: 7px; }
.bookings-page .booking-filters input, .bookings-page .booking-filters select { min-width: 0; min-height: 44px; border-radius: 10px; font-size: 14px; }
.bookings-page .booking-filters input::placeholder { font-size: 12px; font-weight: 400; }
.bookings-page .tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; margin: 0 0 18px; padding: 4px; border: 1px solid var(--line); border-radius: 11px; background: var(--surface-soft); overflow: visible; }
.bookings-page .tabs button { min-width: 0; min-height: 44px; padding: 7px 4px; border: 0; border-radius: 7px; background: transparent; color: var(--muted); font-size: 11px; font-weight: 600; line-height: 1.5; white-space: normal; }
.bookings-page .tabs button.selected { background: var(--action); color: #fff; border: 0; }
.bookings-page .booking-list { gap: 16px; }
.bookings-page .booking-card { display: block; padding: 18px; border-radius: 15px; background: var(--surface); }
.bookings-page .booking-copy { width: 100%; }
.bookings-page .booking-card .row-heading { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; margin: 0; }
.bookings-page .booking-card .row-heading h2 { margin: 0; font-size: 18px; line-height: 1.5; font-weight: 650; overflow-wrap: anywhere; }
.bookings-page .booking-card .row-heading h2 span { display: inline; margin-inline: 4px; color: var(--ocean); }
.bookings-page .booking-card .row-heading > b { padding: 5px 9px; border-radius: 7px; font-size: 10px; line-height: 1.5; letter-spacing: .02em; }
.bookings-page .row-heading > b.unpaid { background: #fff0d5; color: #8a5100; }
.bookings-page .row-heading > b.paid { background: var(--light-blue); color: var(--ocean); }
.bookings-page .row-heading > b.cancelled, .bookings-page .row-heading > b.expired { background: var(--surface-soft); color: var(--muted); }
.bookings-page .row-heading > b.refund_pending { background: #fff0d5; color: #8a5100; }
.bookings-page .booking-meta { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; margin: 16px 0; }
.bookings-page .booking-meta span { display: flex; align-items: flex-start; gap: 6px; min-width: 0; color: var(--muted); font-size: 11px; line-height: 1.7; overflow-wrap: anywhere; }
.bookings-page .booking-meta ion-icon { flex: none; margin-top: 3px; color: var(--ocean); font-size: 15px; }
.bookings-page .booking-fare-panel { padding: 13px 14px; border: 1px solid var(--line); border-radius: 11px; background: var(--surface-soft); }
.bookings-page .booking-total { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 14px; }
.bookings-page .booking-total span { color: var(--muted); font-size: 12px; }
.bookings-page .booking-total strong { color: var(--ink); font-size: 21px; line-height: 1.4; white-space: nowrap; }
.bookings-page .booking-accommodation { margin: 8px 0 0; color: var(--muted); font-size: 11px; line-height: 1.7; }
.bookings-page .booking-reference { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 16px 0; color: var(--muted); }
.bookings-page .booking-reference span { display: inline-flex; align-items: center; gap: 6px; min-width: 0; font-size: 11px; line-height: 1.6; overflow-wrap: anywhere; }
.bookings-page .booking-reference ion-icon { flex: none; color: var(--ocean); font-size: 15px; }
.bookings-page .booking-card :deep(.deadline) { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px 10px; margin: 16px 0; padding: 14px; }
.bookings-page .booking-card :deep(.deadline > ion-icon) { align-self: start; font-size: 21px; }
.bookings-page .booking-card :deep(.deadline strong) { font-size: 12px; line-height: 1.5; }
.bookings-page .booking-card :deep(.deadline small) { font-size: 11px; line-height: 1.6; }
.bookings-page .booking-card :deep(.deadline > b) { grid-column: 2; margin: 0; font-size: 14px; line-height: 1.5; }
.bookings-page .booking-card :deep(.deadline > b)::before { content: 'Time left · '; font-size: 11px; font-weight: 400; }
.bookings-page .booking-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); }
.bookings-page .booking-actions a, .bookings-page .booking-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; padding: 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface); color: var(--ocean); font-size: 12px; font-weight: 600; line-height: 1.5; text-align: center; }
.bookings-page .booking-actions a ion-icon { font-size: 17px; flex: none; }
.bookings-page .booking-actions .booking-ticket-link { background: var(--action); color: #fff; border-color: transparent; }
.bookings-page .booking-actions .booking-cancel-link { color: var(--danger); font-size: 11px; }
.bookings-page .booking-actions > :only-child { grid-column: 1 / -1; }
@container passenger (max-width: 380px) {
  .bookings-page .booking-card { padding: 16px; }
  .bookings-page .booking-meta { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .bookings-page .tabs button { font-size: 10px; }
  .bookings-page .booking-card .row-heading h2 { font-size: 17px; }
  .bookings-page .booking-actions { grid-template-columns: minmax(0, 1fr); }
}
/* E-ticket content stays within the passenger canvas at every screen size. */
.ticket-page { font-family: var(--ion-font-family); padding-bottom: calc(120px + env(safe-area-inset-bottom)); }
.ticket-page .page-title { margin: 28px 0 20px; }
.ticket-page .page-title h1 { font-size: 28px; letter-spacing: -.7px; }
.ticket-page .ticket-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0 0 18px; }
.ticket-page .ticket-actions button { width: 100%; min-width: 0; min-height: 44px; padding: 9px 8px; gap: 6px; font-family: inherit; font-size: 11px; line-height: 1.4; white-space: normal; }
.ticket-page .ticket-actions ion-icon { flex: none; font-size: 16px; }
.ticket-page .ticket-picker { display: grid; gap: 9px; margin: 0 0 20px; overflow: visible; padding: 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.ticket-picker > span { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; font-weight: 600; }
.ticket-page .ticket-picker small { margin: 0; color: var(--muted); font-size: 10px; font-weight: 400; }
.ticket-picker select { width: 100%; min-width: 0; min-height: 44px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-soft); color: var(--ink); font-family: inherit; font-size: 12px; text-overflow: ellipsis; }
.ticket-page .ticket { width: 100%; border-radius: 18px; background: var(--surface); }
.ticket-page .ticket-head { position: relative; display: block; padding: 22px 20px; }
.ticket-page .ticket-title { min-width: 0; }
.ticket-page .ticket-title small { padding-right: 65px; font-size: 9px; line-height: 1.6; letter-spacing: .06em; flex-wrap: wrap; }
.ticket-page .ticket-head h2 { display: grid; grid-template-columns: minmax(0, 1fr) 22px minmax(0, 1fr); align-items: center; gap: 10px; margin-top: 18px; font-family: inherit; font-size: 20px; line-height: 1.5; font-weight: 700; overflow-wrap: anywhere; }
.ticket-page .ticket-head h2 .route-port { color: inherit; }
.ticket-page .ticket-head h2 .route-arrow { display: grid; place-items: center; }
.ticket-page .ticket-head > b { position: absolute; top: 20px; right: 20px; display: inline-flex; align-items: center; gap: 4px; margin-top: 1px; padding: 6px 8px; font-size: 10px; font-weight: 600; white-space: nowrap; }
.ticket-page .ticket-head > b ion-icon { font-size: 14px; }
.ticket-page .ticket-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 14px; padding: 20px; }
.ticket-page .ticket-meta > div { min-width: 0; }
.ticket-page .ticket-meta > div:last-child { grid-column: 1 / -1; }
.ticket-page .ticket-meta small { font-size: 9px; letter-spacing: .04em; }
.ticket-page .ticket-meta strong { font-family: inherit; font-size: 12px; line-height: 1.7; }
.ticket-page .ticket-passengers { padding: 20px; }
.ticket-page .ticket-passengers h3 { font-size: 14px; margin-bottom: 14px; }
.ticket-page .ticket-pass { margin-top: 16px; padding-top: 4px; }
.ticket-page .ticket-person { gap: 9px; padding: 14px 0; }
.ticket-page .ticket-person strong { font-family: inherit; font-size: 13px; line-height: 1.6; }
.ticket-page .ticket-person small { font-size: 11px; line-height: 1.6; text-transform: capitalize; }
.ticket-page .ticket-person > b { font-size: 9px; }
.ticket-page .qr-block { display: grid; grid-template-columns: minmax(0, 1fr); justify-items: center; gap: 16px; margin-top: 4px; padding: 20px 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface-soft); text-align: center; }
.ticket-page .qr-block img { width: 280px; height: 280px; max-width: 100%; padding: 10px; border-radius: 12px; background: white; object-fit: contain; }
.ticket-page .qr-block > div { width: 100%; min-width: 0; }
.ticket-page .qr-block small { color: var(--ocean); font-size: 10px; letter-spacing: .08em; font-weight: 600; }
.ticket-page .qr-block code { display: block; margin: 10px 0; padding: 9px; border: 1px dashed var(--line); border-radius: 7px; color: var(--ink); font-size: 11px; line-height: 1.6; overflow-wrap: anywhere; }
.ticket-page .qr-block p { max-width: 280px; margin: 0 auto; font-size: 12px; line-height: 1.7; color: var(--muted); }
@container passenger (max-width: 380px) {
  .ticket-page .ticket-head { padding: 18px 16px; gap: 8px; }
  .ticket-page .ticket-head h2 { font-size: 18px; }
  .ticket-page .ticket-head > b { right: 16px; top: 16px; }
  .ticket-page .ticket-title small { font-size: 8px; }
  .ticket-page .ticket-meta, .ticket-page .ticket-passengers { padding: 16px; }
  .ticket-page .ticket-person { flex-wrap: wrap; }
  .ticket-page .ticket-person > b { margin-left: 45px; }
}
</style>
