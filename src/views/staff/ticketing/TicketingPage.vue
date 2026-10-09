<template>
  <ion-page>
    <ion-content ref="contentRef" :fullscreen="true">
      <main class="staff-shell design-workspace" :class="{ 'ticketing-workspace': !isBoarding, 'ticketing-bookings': isBookingsPage, 'ticketing-dashboard': !isBoarding && !isBookingsPage }">
        <button
          v-if="menuOpen"
          class="staff-scrim"
          aria-label="Close navigation"
          @click="menuOpen = false"
        ></button>
        <aside
          id="staff-sidebar"
          class="staff-sidebar"
          :class="{ 'mobile-open': menuOpen }"
        >
          <BrandMark /><StaffNavigation
            role="ticketing"
            @navigate="menuOpen = false"
          />
        </aside>
        <section class="staff-main">
          <StaffWorkspaceHeader :role="String(route.params.role)" navigation :menu-open="menuOpen" @toggle-menu="menuOpen = !menuOpen" />
          <main id="overview" class="content">
            <div class="heading">
              <div>
                <p class="kicker">{{ staff.eyebrow }}</p>
                <h1>{{ staff.greeting }}</h1>
                <p>{{ staff.description }}</p>
              </div>
              <ion-button
                v-if="isBoarding && !portBlocked"
                class="primary"
                :disabled="busy"
                @click="showScanner = true"
                ><ion-icon slot="start" :icon="staff.actionIcon" />{{
                  staff.action
                }}</ion-button
              ><router-link v-if="!portBlocked && !isBoarding && !isBookingsPage" class="dashboard-walk-in" to="/staff/ticketing/walk-in"><ion-icon :icon="ticketOutline" aria-hidden="true" /> New walk-in ticket</router-link><button
                class="staff-refresh"
                type="button"
                :disabled="busy || loading"
                @click="refreshQueues"
              >
                <ion-icon :icon="refreshOutline" aria-hidden="true" />
                {{ loading ? "Refreshing..." : "Refresh" }}
              </button>
            </div>
            <StaffPortRequired v-if="portBlocked" />
            <template v-else>
            <p v-if="loadError" class="staff-note error" role="alert">
              {{ loadError }}
            </p>
            <label v-if="isBoarding" class="sailing-picker"
              >Sailing<select v-model="activeSailing">
                <option
                  v-for="sailing in activeSailings"
                  :key="sailing.code"
                  :value="sailing.code"
                >
                  {{ sailing.code }} - {{ sailing.origin.name }} to
                  {{ sailing.destination.name }} -
                  {{ new Date(sailing.departureAt).toLocaleString() }}
                </option>
              </select></label
            >
            <section v-if="!isBookingsPage" class="metric-grid">
              <article v-for="metric in staff.metrics" :key="metric.label">
                <span :class="metric.tone"
                  ><ion-icon :icon="metric.icon"
                /></span>
                <div>
                  <small>{{ metric.label }}</small
                  ><strong>{{ !isBoarding && loading ? '—' : metric.value }}</strong
                  ><em>{{ metric.note }}</em>
                </div>
              </article>
            </section>
            <section class="workspace-grid">
              <article id="queue" class="panel queue-panel" :aria-busy="loading">
                <div class="panel-heading">
                  <div>
                    <p class="kicker">{{ staff.queueEyebrow }}</p>
                    <h2>{{ staff.queueTitle }}</h2>
                  </div>
                  <div v-if="isBookingsPage" class="queue-filters">
                  <label><span><ion-icon :icon="searchOutline" aria-hidden="true" /> Find a reservation</span><input
                    v-model="searchText"
                    class="queue-search"
                    type="search"
                    placeholder="Search reference, passenger, route"
                    aria-label="Search bookings"
                  /></label><label><span><ion-icon :icon="walletOutline" aria-hidden="true" /> Payment / booking status</span><select
                    v-model="statusFilter"
                    aria-label="Filter reservation status"
                  >
                    <option value="ALL">All statuses</option>
                    <option value="AWAITING_VERIFICATION">Awaiting staff verification</option>
                    <option value="UNPAID">Awaiting payment</option>
                    <option value="PAID">Paid</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="REFUND_PENDING">Refund pending</option>
                    <option value="REFUNDED">Refunded</option></select></label>
                  </div><router-link v-else-if="!isBoarding" class="all-bookings-link" to="/staff/ticketing/bookings"><ion-icon :icon="ticketOutline" aria-hidden="true" /> View all bookings</router-link><span v-else class="filter">{{
                    activeSailing || "No sailing selected"
                  }}</span>
                </div>
                <div v-if="isBookingsPage" class="reservation-tools"><span><ion-icon :icon="ticketOutline" aria-hidden="true" /> Online reservations &amp; walk-in tickets</span><button v-if="searchText || statusFilter !== 'ALL'" :disabled="loading || !!busy" @click="searchText = ''; statusFilter = 'ALL'">Reset filters</button></div>
                <p v-if="!isBoarding" class="queue-result-count">{{ loading ? 'Loading reservations...' : `${queueItems.length} shown / ${queueTotal} ${isBookingsPage ? 'matching reservations' : 'payments requiring action'}` }}</p>
                <div class="queue-list">
                  <div
                    v-for="item in queueItems"
                    :key="item.passengerId || item.reference || item.name"
                    class="queue-item"
                  >
                    <span
                      class="person-avatar"
                      :class="isBoarding ? item.tone : 'blue'"
                      >{{
                        isBoarding
                          ? item.initials
                          : initialsFor(bookingName(item))
                      }}</span
                    >
                    <div class="queue-person">
                      <strong>{{
                        isBoarding ? item.name : bookingName(item)
                      }}</strong>
                      <p v-if="isBoarding">{{ item.detail }}</p>
                      <template v-else>
                        <small class="queue-reference">{{ item.reference }}</small>
                        <p class="queue-route">{{ item.sailing.origin.name }} to {{ item.sailing.destination.name }}</p>
                        <p class="queue-departure"><ion-icon :icon="calendarOutline" aria-hidden="true" /> {{ formatQueueDeparture(item.sailing.departureAt) }}</p>
                        <p class="dashboard-queue-facts"><span><ion-icon :icon="peopleOutline" aria-hidden="true" />{{ item.passengerCount }} {{ item.passengerCount === 1 ? 'passenger' : 'passengers' }}</span><strong>PHP {{ Number(item.total).toLocaleString() }}</strong></p>
                        <small v-if="isBookingsPage" class="reservation-channel">{{ item.bookingChannel === 'WALK_IN' ? 'Walk-in ticket' : 'Online reservation' }}</small>
                        <p class="queue-payment">Payment method: <strong>{{ paymentMethodLabel(item) }}</strong></p>
                      </template>
                    </div>
                    <span
                      class="status"
                      :class="
                        itemStatus(item)
                          .toLowerCase()
                          .replace('_', '-')
                          .replace(' ', '-')
                      "
                      ><ion-icon v-if="!isBoarding" :icon="queueStatusIcon(item)" aria-hidden="true" />{{ !isBoarding ? readableQueueStatus(item) : itemStatus(item) }}</span
                    ><button
                      class="queue-update"
                      :aria-label="
                        queueActionLabel(item) +
                        ': ' +
                        (isBoarding ? item.name : item.reference)
                      "
                      :title="queueActionLabel(item)"
                      :disabled="isQueueItemComplete(item) || busy"
                      @click="processItem(item)"
                    >
                      {{ !isBoarding ? 'Review booking' : queueActionLabel(item) }}<ion-icon v-if="!isBoarding" :icon="arrowForwardOutline" aria-hidden="true" />
                    </button>
                  </div>
                  <div v-if="!isBoarding && !isBookingsPage && !queueItems.length" class="dashboard-empty" role="status"><ion-icon :icon="loading ? timeOutline : loadError ? informationCircleOutline : checkmarkCircle" aria-hidden="true" /><h3>{{ loading ? 'Loading payment queue' : loadError ? 'Queue unavailable' : 'No payments requiring action' }}</h3><p>{{ loading ? 'Checking the latest reservations.' : loadError ? 'Use Refresh to try loading the queue again.' : 'Reservations awaiting payment or staff verification will appear here.' }}</p><router-link v-if="!loading && !loadError" to="/staff/ticketing/bookings">View all bookings</router-link></div>
                  <div v-else-if="isBookingsPage && !queueItems.length" class="reservation-empty" role="status"><ion-icon :icon="loading ? timeOutline : loadError ? informationCircleOutline : searchOutline" aria-hidden="true" /><h3>{{ loading ? 'Loading reservations' : loadError ? 'Reservations unavailable' : searchText || statusFilter !== 'ALL' ? 'No matching reservations' : 'No reservations yet' }}</h3><p>{{ loading ? 'Checking the latest booking records.' : loadError ? 'Use Refresh to try again.' : searchText || statusFilter !== 'ALL' ? 'Try another reference, passenger name, route or status.' : 'New online reservations and walk-in tickets will appear here.' }}</p><button v-if="!loading && !loadError && (searchText || statusFilter !== 'ALL')" @click="searchText = ''; statusFilter = 'ALL'">Clear filters</button></div>
                  <p v-else-if="!queueItems.length" class="empty-state">
                    {{
                      searchText
                        ? "No reservations match your search."
                        : "No records found."
                    }}
                  </p>
                </div>
<WorkspacePagination v-if="isBookingsPage && queueTotal > 0" label="Reservation pages" :page="queuePage" :total="queueTotal" :page-size="pageSize" :disabled="!!busy || loading" @change="queuePage = $event"><span>{{ queueItems.length ? queuePage * pageSize + 1 : 0 }}–{{ queueItems.length ? queuePage * pageSize + queueItems.length : 0 }} of {{ queueTotal.toLocaleString() }} reservations</span></WorkspacePagination>
              </article>
              <aside v-if="isBoarding" class="panel shift-panel">
                <p class="kicker">SELECTED SAILING</p>
                <h2>{{ activeSailing || "Choose a sailing" }}</h2>
                <p class="muted">
                  Boarding records and ticket status are read live from the
                  database.
                </p>
              </aside>
              <TicketingGuide v-else-if="!isBookingsPage" />
            </section>
            <section v-if="isBoarding" id="activity" class="panel activity-panel">
              <div class="panel-heading">
                <div>
                  <p class="kicker">
                    {{
                      isBoarding ? "BOARDING ACTIVITY" : "RECENT RESERVATIONS"
                    }}
                  </p>
                  <h2>
                    {{
                      isBoarding ? "Activity log" : "Latest database records"
                    }}
                  </h2>
                </div>
                <span class="activity-count"
                  >{{ recentEvents.length }} records</span
                >
              </div>
              <div class="activity-list">
                <article
                  v-for="(event, index) in recentEvents"
                  :key="`${event.title}-${index}`"
                  class="activity-item"
                >
                  <span class="activity-icon"
                    ><ion-icon :icon="event.icon" aria-hidden="true"
                  /></span>
                  <div>
                    <strong>{{ event.title }}</strong>
                    <p>{{ event.detail }}</p>
                  </div>
                  <small>{{ event.time }}</small>
                </article>
                <p v-if="!recentEvents.length" class="empty-state">
                  No recent records found.
                </p>
              </div>
            </section>
            <div class="staff-note">
              <ion-icon :icon="informationCircleOutline" /><span
                >Confirm cash payment before issuing tickets. Give walk-in
                passengers their printed reference and ticket code.</span
              >
            </div>
            </template>
          </main>
        </section>
        <ion-modal
          :is-open="showScanner"
          @didDismiss="
            showScanner = false;
            stopCamera();
          "
          ><div class="modal-card">
            <button
              class="close"
              aria-label="Close"
              @click="showScanner = false"
            >
              <ion-icon :icon="closeOutline" /></button
            ><template
              ><span class="scan-icon"><ion-icon :icon="scanOutline" /></span>
              <p class="kicker">GATE CHECK-IN</p>
              <h2>Scan passenger ticket</h2>
              <p>
                Enter the ticket code printed on the e-ticket to load its live
                boarding record.
              </p>
              <video
                ref="scannerVideo"
                class="scanner-video"
                autoplay
                playsinline
                muted
              ></video
              ><button class="camera-action" type="button" @click="startCamera">
                Scan QR with camera
              </button>
              <p v-if="scanError" class="scan-error" role="alert">
                {{ scanError }}
              </p>
              <label class="modal-field"
                >Ticket code<input
                  v-model="ticketLookup"
                  autocomplete="off"
                  placeholder="Paste ticket code" /></label
              ><ion-button
                expand="block"
                class="primary"
                :disabled="!ticketLookup.trim() || scanBusy"
                @click="lookupTicket"
                >{{scanBusy ? 'Verifying…' : 'Verify ticket'}}</ion-button
              ></template
            >
            <section v-if="scannedTicket" class="verified-ticket-review">
              <h3>Verified ticket details</h3><strong>{{scannedTicket.fullName}}</strong>
              <p>Vessel: {{scannedTicket.booking.sailing.vessel.name}}</p>
              <p>Departure: {{ticketDeparture(scannedTicket.booking.sailing.departureAt)}}</p>
              <p>{{scannedTicket.booking.sailing.origin.name}} to {{scannedTicket.booking.sailing.destination.name}}</p>
              <p>{{scannedTicket.booking.reference}} · Paid · {{scannedTicket.ticketStatus.replaceAll('_',' ')}}</p>
              <p>Match the passenger's ID to this name before confirming.</p>
              <ion-button v-if="['ISSUED','CHECKED_IN'].includes(scannedTicket.ticketStatus)" :disabled="busy || scanBusy" @click="confirmScannedTicket">{{scannedTicket.ticketStatus==='ISSUED' ? 'Confirm check-in' : 'Confirm boarding'}}</ion-button>
              <p v-else>This ticket has already been boarded. Do not admit it again.</p>
            </section>
          </div></ion-modal
        ><ion-modal
          class="booking-payment-modal"
          :is-open="!!selectedBooking"
          @didDismiss="selectedBooking = null"
          ><div class="modal-card ticket-list-modal booking-dialog">
            <header class="booking-dialog-heading">
            <button
              class="close"
              aria-label="Close tickets"
              @click="selectedBooking = null"
            >
              <ion-icon :icon="closeOutline" />
            </button>
            <div><p class="kicker">{{ selectedBooking?.reference }}</p>
            <h2>Booking and payment</h2>
            </div></header>
            <div class="booking-dialog-body">
            <section class="booking-amount">
              <span>
              {{
                selectedBookingCancelled
                  ? "Original booking amount"
                  : selectedBooking?.paymentStatus === 'PAID'
                    ? "Amount paid"
                    : "Amount due"
              }}</span>
              <strong
                >PHP
                {{
                  Number(selectedBooking?.total || 0).toLocaleString()
                }}</strong
              >
              <b>
              {{
                selectedBookingExpired
                  ? "Expired"
                  : selectedBooking?.paymentStatus === "REFUND_PENDING"
                    ? "Refund pending"
                    : selectedBooking?.paymentStatus === "REFUNDED"
                      ? "Refunded"
                      : selectedBookingCancelled
                        ? "Cancelled"
                        : selectedBookingNeedsVerification ? 'Awaiting staff verification' : selectedBookingPaid
                          ? "Paid"
                          : "Awaiting payment"
              }}
              </b>
            </section>
            <p
              v-if="selectedBookingCancelled"
              class="cancellation-notice"
              role="status"
            >
              {{
                selectedBookingExpired
                  ? "This reservation expired. Its seats were released. No payment is due."
                  : "This reservation is cancelled. No payment is due and tickets cannot be issued."
              }}
            </p>
            <dl class="booking-payment-details">
              <div><dt>Payment method</dt><dd>{{ paymentMethodLabel(selectedBooking) }}</dd></div>
              <div v-if="selectedBooking?.paidAt"><dt>Payment recorded</dt><dd>{{ formatQueueDeparture(selectedBooking.paidAt) }}</dd></div>
            </dl>
            <p v-if="selectedBooking?.voucherCode" class="transaction-reference">Voucher: {{selectedBooking.voucherCode}} ? Discount PHP {{selectedBooking.voucherDiscount}}</p>
            <p v-if="selectedBooking?.paymentTransactionId" class="transaction-reference">Transaction ID: {{ selectedBooking.paymentTransactionId }}</p>
            <p v-if="selectedBooking?.paymentVerifiedAt">Staff verified: {{ formatQueueDeparture(selectedBooking.paymentVerifiedAt) }}</p>
            <section class="dialog-sailing"><h3>
              {{ selectedBooking?.sailing.origin.name }} to
              {{ selectedBooking?.sailing.destination.name }}</h3>
              <p><ion-icon :icon="calendarOutline" aria-hidden="true" />{{ formatQueueDeparture(selectedBooking?.sailing.departureAt || new Date().toISOString()) }}</p>
              <p><ion-icon :icon="boatOutline" aria-hidden="true" />{{ selectedBooking?.sailing.vessel.name }}</p>
            </section>
            <p v-if="selectedBooking?.accommodationName">
              {{ selectedBooking.accommodationName }} accommodation · PHP
              {{
                Number(selectedBooking.serviceFee || 0).toLocaleString()
              }}
              additional fare
            </p>
            <h3 class="dialog-section-title">Passengers ({{ selectedBooking?.bookingPassengers_on_booking.length || 0 }})</h3>
            <article
              v-for="person in selectedBooking?.bookingPassengers_on_booking ||
              []"
              :key="person.ticketCode"
              class="ticket-record"
            >
              <div>
                <strong>{{ person.fullName }}</strong
                ><small
                  >{{ person.passengerType }} ·
                  {{
                    selectedBookingExpired
                      ? "Expired"
                      : selectedBookingCancelled
                        ? "Cancelled"
                        : selectedBookingNeedsVerification ? 'Awaiting staff verification' : selectedBookingPaid
                          ? person.ticketStatus
                          : "Awaiting payment"
                  }}</small
                >
              </div>
              <span class="dialog-person-fare">PHP {{ Number(person.fare).toLocaleString() }}</span>
              <small v-if="selectedBookingCancelled">{{
                selectedBookingExpired
                  ? "Ticket not issued - reservation expired"
                  : "Ticket unavailable - reservation cancelled"
              }}</small
              ><code v-else-if="selectedBookingPaid">{{
                person.ticketCode
              }}</code
              ><small v-else>{{ selectedBookingNeedsVerification ? 'Ticket issued after staff verification' : 'Ticket issued after payment' }}</small
              ><DiscountVerification
                v-if="
                  selectedBookingCanPay &&
                  person.fare < selectedBooking.sailing.regularFare
                "
                :key="person.id"
                :passenger-id="person.id"
                :verified="!!person.discountVerifiedAt"
                @verified="refreshQueues"
              />
            </article>
            <p v-if="selectedBookingCanPay && selectedBooking.paymentDeadline">
              Pay before
              {{
                new Date(selectedBooking.paymentDeadline).toLocaleString(
                  "en-PH",
                )
              }}.
            </p>
            <p v-if="selectedBooking?.cancellationReason">
              Reason: {{ selectedBooking.cancellationReason }}
            </p>
            <RefundActions
              v-if="selectedBooking?.paymentStatus === 'REFUND_PENDING' && selectedBooking?.paymentMethod !== 'PAYMONGO_TEST'"
              :key="selectedBooking.id"
              :booking-id="selectedBooking.id"
              :amount="Number(selectedBooking.total)"
              @refunded="refreshQueues"
            />
            <p v-if="selectedBooking?.paymentStatus === 'REFUND_PENDING' && selectedBooking?.paymentMethod === 'PAYMONGO_TEST'" class="cancellation-notice">Online payment requires operator review. Do not issue a cash refund.</p>
            <p v-if="loadError" class="scan-error" role="alert">
              {{ loadError }}
            </p>
            <p
              v-if="
                !selectedBookingCancelled &&
                !selectedBookingPaid &&
                selectedBookingDeparted
              "
              class="scan-error"
            >
              This sailing has departed. The booking remains for history;
              payment cannot be recorded here.
            </p>
            <div v-if="selectedBookingNeedsVerification" class="payment-actions online-verification">
              <p>Online payment received via {{ paymentMethodLabel(selectedBooking) }}. Verify this transaction to release the e-ticket. No cash collection is needed.</p>
              <ion-button expand="block" class="primary" :disabled="busy || selectedBookingDeparted" @click="verifyPayment">{{ busy ? 'Verifying…' : 'Verify online payment and issue tickets' }}</ion-button>
            </div>
            <div v-if="selectedBookingCanPay" class="payment-actions">
              <p v-if="!selectedDiscountsVerified">
                Verify discounted passengers before collecting cash.
              </p>
              <label class="modal-field"
                >Payment method<select v-model="paymentMethod">
                  <option value="CASH">Cash</option>
                </select></label
              ><ion-button
                expand="block"
                class="primary"
                :disabled="busy || !selectedDiscountsVerified"
                @click="collectPayment"
                >{{
                  busy ? "Recording…" : "Record payment and issue tickets"
                }}</ion-button
              >
            </div>
          </div></div></ion-modal
        >
      </main>
    </ion-content>
  </ion-page>
</template>
<script setup lang="ts">
import StaffPortRequired from '../../../components/staff/StaffPortRequired.vue';
import { useStaffPortGate } from '../../../composables/staffPortGate';
const { portBlocked } = useStaffPortGate(refreshQueues);
import { paymentMethodLabel } from '../../../data/paymentMethod';
import { awaitingPaymentVerification, bookingTicketReady } from '../../../data/paymentVerification';
import { verifyOnlinePayment } from '../../../services/payments';
import WorkspacePagination from "../../../components/shared/WorkspacePagination.vue";
import StaffWorkspaceHeader from "../../../components/staff/StaffWorkspaceHeader.vue";
import StaffNavigation from "../../../components/staff/StaffNavigation.vue";
import { staffDashboard } from "../../../services/database/workspaces";
import { confirmAction } from "../../../composables/confirmation";
import DiscountVerification from "../../../components/staff/ticketing/DiscountVerification.vue";
import RefundActions from "../../../components/staff/ticketing/RefundActions.vue";
import { useQueueRefresh } from "../../../composables/queueRefresh";
import TicketingGuide from "../../../components/staff/ticketing/TicketingGuide.vue";
import { databaseRequestError } from "../../../data/databaseErrors";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonModal,
  IonPage,
  onIonViewDidEnter,
  onIonViewWillEnter,
} from "@ionic/vue";
import {
  boatOutline,
  checkmarkCircle,
  closeOutline,
  informationCircleOutline,
  peopleOutline,
  scanOutline,
  searchOutline,
  refreshOutline,
  calendarOutline,
  ticketOutline,
  walletOutline,
  timeOutline,
  arrowForwardOutline,
} from "ionicons/icons";
import BrandMark from "../../../components/shared/BrandMark.vue";
import {
  boardingActivity,
  boardingManifest,
  boardingSailings,
  boardTicket,
  checkInTicket,
  collectBookingPayment,
  staffBookings,
} from "../../../services/database/staff";
import { auth, staffDatabase } from "../../../services/session";
import { verifyTicketQr, type VerifiedTicket } from "../../../services/ticketQr";
const route = useRoute();
const contentRef = ref<any>(null);
const showScanner = ref(false);
const scanBusy=ref(false),scannedTicket=ref<VerifiedTicket|null>(null);
const ticketDeparture=(at:string)=>new Date(at).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
const menuOpen = ref(false);
const activeSection = ref("overview");
const loading = ref(false);
const busy = ref(false);
const loadError = ref("");
const searchText = ref("");
const statusFilter = ref("ALL");
const queuePage = ref(0);
const queueTotal = ref(0);
const pageSize = 30;
const isBookingsPage = computed(() => route.path === "/staff/ticketing/bookings");
const ticketLookup = ref("");
const scannerVideo = ref<HTMLVideoElement | null>(null);
const scanError = ref("");
let scannerStream: MediaStream | null = null;
let scanFrame = 0;
const selectedBooking = ref<any>(null);
const selectedBookingCancelled = computed(() =>
  ["CANCELLED", "EXPIRED"].includes(selectedBooking.value?.status),
);
const selectedBookingExpired = computed(
  () => selectedBooking.value?.status === "EXPIRED",
);
const selectedDiscountsVerified = computed(() =>
  (selectedBooking.value?.bookingPassengers_on_booking || []).every(
    (p: any) =>
      p.passengerType === "REGULAR" ||
      p.fare >= selectedBooking.value.sailing.regularFare ||
      !!p.discountVerifiedAt,
  ),
);
const selectedBookingPaid = computed(
  () => bookingTicketReady(selectedBooking.value),
);
const selectedBookingNeedsVerification = computed(() => awaitingPaymentVerification(selectedBooking.value));
const selectedBookingDeparted = computed(
  () =>
    !!selectedBooking.value &&
    new Date(selectedBooking.value.sailing.departureAt) <= new Date(),
);
const selectedBookingCanPay = computed(
  () =>
    !!selectedBooking.value &&
    ["PENDING", "CONFIRMED"].includes(selectedBooking.value.status) &&
    selectedBooking.value.paymentStatus === "UNPAID" &&
    (!selectedBooking.value.paymentDeadline ||
      new Date(selectedBooking.value.paymentDeadline) > new Date()) &&
    new Date(selectedBooking.value.sailing.departureAt) > new Date(),
);
const paymentMethod = ref("CASH");
const activeSailing = ref("");
type QueueItem = {
  passengerId?: string;
  ticketCode?: string;
  reference?: string;
  name: string;
  initials: string;
  detail: string;
  status: string;
  tone: string;
};
const dashboardCounts = ref<{
  bookings: number;
  paid: number;
  unpaid: number;
  awaitingVerification?: number;
  trips: number;
} | null>(null);
const ticketingQueue = ref<any[]>([]);
const boardingQueue = ref<QueueItem[]>([]);
const boardingEvents = ref<any[]>([]);
function bookingName(item: any) {
  return item.bookingChannel === "WALK_IN"
    ? item.bookingPassengers_on_booking?.[0]?.fullName || "Walk-in passenger"
    : item.owner?.fullName || "Passenger";
}
const recentEvents = computed(() =>
  isBoarding.value
    ? boardingEvents.value.map((item) => ({
        title:
          item.eventType === "BOARDED"
            ? "Passenger boarded"
            : "Passenger checked in",
        detail: `${item.passenger.fullName} · ${item.passenger.booking.reference}`,
        time: new Date(item.createdAt).toLocaleString(),
        icon: boatOutline,
      }))
    : ticketingQueue.value
        .slice(0, 5)
        .map((item) => ({
          title:
            item.status === "EXPIRED"
              ? "Reservation expired"
              : item.paymentStatus === "REFUND_PENDING"
                ? "Refund pending"
                : item.paymentStatus === "REFUNDED"
                  ? "Refund recorded"
                  : item.status === "CANCELLED"
                    ? "Reservation cancelled"
                    : item.paymentStatus === "PAID"
                      ? "Payment recorded"
                      : "Awaiting payment",
          detail: `${item.reference} · ${bookingName(item)} · ${item.passengerCount} passenger(s)`,
          time: new Date(item.createdAt).toLocaleString(),
          icon: ticketOutline,
        })),
);
const activeSailings = ref<
  Array<{
    code: string;
    status: string;
    departureAt: string;
    origin: { name: string };
    destination: { name: string };
    vessel: { name: string };
  }>
>([]);
const sailingReadyToBoard = computed(
  () =>
    activeSailings.value.find((sailing) => sailing.code === activeSailing.value)
      ?.status === "BOARDING",
);
const ticketing = {
  name: "Ticketing Staff",
  role: "Ticketing Staff",
  eyebrow: "TICKETING DESK",
  greeting: "Booking queue",
  description: "Collect payment for reservations and issue walk-in tickets.",
  action: "Walk-in ticket",
  actionIcon: ticketOutline,
  queueIcon: ticketOutline,
  queueLabel: "Booking queue",
  queueEyebrow: "BOOKING QUEUE",
  queueTitle: "Reservations",
  metrics: [
    {
      label: "Reservations",
      value: "—",
      note: "Live records",
      tone: "blue",
      icon: ticketOutline,
    },
    {
      label: "Paid",
      value: "—",
      note: "Ready for sailing",
      tone: "mint",
      icon: checkmarkCircle,
    },
    {
      label: "Awaiting payment",
      value: "—",
      note: "At ticketing desk",
      tone: "amber",
      icon: peopleOutline,
    },
  ],
};
const boarding = {
  name: "Boarding Staff",
  role: "Boarding Staff",
  eyebrow: "BOARDING DESK",
  greeting: "Boarding queue",
  description: "Check in valid tickets and record passengers as they board.",
  action: "Find ticket",
  actionIcon: searchOutline,
  queueIcon: scanOutline,
  queueLabel: "Boarding queue",
  queueEyebrow: "LIVE BOARDING",
  queueTitle: "Passengers on selected sailing",
  metrics: [
    {
      label: "Tickets",
      value: "—",
      note: "Sailing manifest",
      tone: "blue",
      icon: ticketOutline,
    },
    {
      label: "Checked in",
      value: "—",
      note: "Gate status",
      tone: "mint",
      icon: scanOutline,
    },
    {
      label: "Boarded",
      value: "—",
      note: "Boarding status",
      tone: "amber",
      icon: boatOutline,
    },
  ],
};
const isBoarding = computed(() => route.params.role === "boarding");
function formatQueueDeparture(value: string) {
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
const isWorkspaceRoute = computed(
  () =>
    route.path === "/staff/ticketing" ||
    route.path === "/staff/ticketing/bookings",
);
const staff = computed(() => {
  const source = isBoarding.value ? boarding : ticketing;
  const items = isBoarding.value ? boardingQueue.value : ticketingQueue.value;
  const metrics = isBoarding.value
    ? [
        { ...source.metrics[0], value: String(items.length) },
        {
          ...source.metrics[1],
          value: String(
            items.filter(
              (x) => x.status === "CHECKED-IN" || x.status === "BOARDED",
            ).length,
          ),
        },
        {
          ...source.metrics[2],
          value: String(items.filter((x) => x.status === "BOARDED").length),
        },
      ]
    : [
        {
          ...source.metrics[0],
          note: "All reservations",
          value: String(dashboardCounts.value?.bookings ?? queueTotal.value),
        },
        {
          ...source.metrics[1],
          note: "Paid confirmed reservations",
          value: String(dashboardCounts.value?.paid ?? 0),
        },
        {
          ...source.metrics[2],
          icon: walletOutline,
          note: "Active unpaid reservations",
          value: String(dashboardCounts.value?.unpaid ?? 0),
        },
        { ...source.metrics[1], label: 'Awaiting verification', icon: timeOutline, note: 'Online payments to approve', tone: 'amber', value: String(dashboardCounts.value?.awaitingVerification ?? 0) },
      ];
  return {
    ...source,
    greeting: isBookingsPage.value ? "Bookings" : "Dashboard",
    description: !isBoarding.value && isBookingsPage.value ? "Find reservations, review payments and manage booking records." : source.description,
    queueEyebrow: !isBoarding.value && !isBookingsPage.value ? "PAYMENT QUEUE" : source.queueEyebrow,
    queueTitle: !isBoarding.value && !isBookingsPage.value ? "Payments requiring action" : source.queueTitle,
    name:
      auth?.currentUser?.displayName ||
      auth?.currentUser?.email?.split("@")[0] ||
      source.name,
    metrics,
  };
});
const queueItems = computed(() =>
  isBoarding.value
    ? boardingQueue.value
    : (isBookingsPage.value ? ticketingQueue.value : ticketingQueue.value.slice(0, 6)).filter((item) =>
        `${item.reference} ${bookingName(item)} ${item.bookingChannel} ${item.sailing.origin.name} ${item.sailing.destination.name}`
          .toLowerCase()
          .includes(searchText.value.toLowerCase().trim()),
      ),
);
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(isBookingsPage, () => {
  searchText.value = "";
  statusFilter.value = "ALL";
  queuePage.value = 0;
  selectedBooking.value = null;
  menuOpen.value = false;
  if (isWorkspaceRoute.value) void refreshQueues();
});
watch([searchText, statusFilter], () => {
  queuePage.value = 0;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void refreshQueues();
  }, 300);
});
watch(queuePage, () => {
  void refreshQueues();
});
useQueueRefresh(refreshQueues, () => isWorkspaceRoute.value && !busy.value);
watch(
  () => [route.params.role, activeSailing.value],
  () => {
    if (isWorkspaceRoute.value) void refreshQueues();
  },
);
onIonViewWillEnter(() => {
  if (isWorkspaceRoute.value) void refreshQueues();
});
onIonViewDidEnter(() => {
  if (route.hash) void scrollToSection(route.hash.slice(1));
});
let refreshToken = 0;
async function refreshQueues() {
  if (!isWorkspaceRoute.value) return;
  const requestId = ++refreshToken;
  loading.value = true;
  loadError.value = "";
  if (!staffDatabase) {
    loading.value = false;
    ticketingQueue.value = [];
    boardingQueue.value = [];
    loadError.value =
      "Supabase is not configured. Add the project URL and publishable key to .env.local.";
    return;
  }
  try {
    if (isBoarding.value) {
      const sailings = await boardingSailings(staffDatabase, {
        fetchPolicy: "SERVER_ONLY",
      });
      if (requestId !== refreshToken) return;
      activeSailings.value = sailings.data.sailings.filter(
        (sailing) =>
          sailing.status === "BOARDING" ||
          new Date(sailing.departureAt) > new Date(),
      );
      if (
        !activeSailings.value.some(
          (sailing) => sailing.code === activeSailing.value,
        )
      )
        activeSailing.value = activeSailings.value[0]?.code || "";
      if (!activeSailing.value) {
        boardingQueue.value = [];
        boardingEvents.value = [];
        return;
      }
      const sailingCode = activeSailing.value;
      const [result, activity] = await Promise.all([
        boardingManifest(
          staffDatabase,
          { sailingCode },
          { fetchPolicy: "SERVER_ONLY" },
        ),
        boardingActivity(
          staffDatabase,
          { sailingCode },
          { fetchPolicy: "SERVER_ONLY" },
        ),
      ]);
      if (requestId !== refreshToken || sailingCode !== activeSailing.value)
        return;
      boardingEvents.value = activity.data.boardingEvents;
      boardingQueue.value = result.data.bookings.flatMap((booking) =>
        booking.bookingPassengers_on_booking.map((person) => ({
          passengerId: person.id,
          ticketCode: person.ticketCode,
          reference: booking.reference,
          name: person.fullName,
          initials: person.fullName
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
          detail:
            booking.reference +
            " - " +
            sailingCode +
            " - " +
            person.passengerType,
          status: person.ticketStatus.replace("_", "-"),
          tone: person.ticketStatus === "BOARDED" ? "mint" : "blue",
        })),
      );
    } else {
      const [result, counts] = await Promise.all([
        staffBookings(staffDatabase, {
          fetchPolicy: "SERVER_ONLY",
          page: isBookingsPage.value ? queuePage.value : 0,
          pageSize: isBookingsPage.value ? pageSize : 6,
          status: isBookingsPage.value ? statusFilter.value : "ACTION_REQUIRED",
          search: isBookingsPage.value ? searchText.value.trim() : "",
        }),
        staffDashboard(staffDatabase),
      ]);
      if (requestId !== refreshToken) return;
      dashboardCounts.value = counts.data;
      ticketingQueue.value = result.data.bookings;
      queueTotal.value = result.data.totalCount ?? result.data.bookings.length;
      if (selectedBooking.value)
        selectedBooking.value =
          result.data.bookings.find((b) => b.id === selectedBooking.value.id) ||
          null;
    }
  } catch (error) {
    if (requestId === refreshToken) {
      loadError.value = databaseRequestError(
        error,
        "Could not load operations. Try refreshing again.",
      );
    }
  } finally {
    if (requestId === refreshToken) loading.value = false;
  }
}
function itemStatus(item: QueueItem) {
  if (isBoarding.value) return item.status;
  const booking = item as any;
  if (awaitingPaymentVerification(booking)) return 'AWAITING STAFF VERIFICATION';
  return booking.paymentStatus === "REFUND_PENDING"
    ? "REFUND PENDING"
    : booking.paymentStatus === "REFUNDED"
      ? "REFUNDED"
      : ["CANCELLED", "EXPIRED"].includes(booking.status)
        ? booking.status
        : booking.paymentStatus === "PAID"
          ? "PAID"
          : new Date(booking.sailing.departureAt) <= new Date()
            ? "PAST DUE"
            : "AWAITING PAYMENT";
}
function queueStatusIcon(item: any) {
  if (awaitingPaymentVerification(item)) return timeOutline;
  if (['CANCELLED', 'EXPIRED'].includes(item.status)) return closeOutline;
  return item.paymentStatus === 'PAID' ? checkmarkCircle : walletOutline;
}
function readableQueueStatus(item: QueueItem) {
  return String(itemStatus(item)).toLowerCase().replace(/(^| )\S/g, letter => letter.toUpperCase());
}
function isQueueItemComplete(item: QueueItem) {
  return (
    isBoarding.value &&
    (item.status === "BOARDED" ||
      (item.status === "CHECKED-IN" && !sailingReadyToBoard.value) ||
      (item.status !== "ISSUED" && item.status !== "CHECKED-IN"))
  );
}
function queueActionLabel(item: QueueItem) {
  return isBoarding.value
    ? item.status === "ISSUED"
      ? "Check in"
      : item.status === "CHECKED-IN"
        ? sailingReadyToBoard.value
          ? "Board"
          : "Await boarding"
        : item.status === "BOARDED"
          ? "Boarded"
          : "Not ready"
    : "Details";
}
async function processItem(item: QueueItem) {
  if (!isBoarding.value) {
    selectedBooking.value = item;
    return;
  }
  if (
    !item.passengerId ||
    !staffDatabase ||
    (item.status !== "ISSUED" && item.status !== "CHECKED-IN")
  )
    return;
  if (item.status === "CHECKED-IN" && !sailingReadyToBoard.value) {
    loadError.value =
      "Admin must set this sailing to BOARDING before passengers can board.";
    return;
  }
  busy.value = true;
  loadError.value = "";
  try {
    if (item.status === "ISSUED")
      await checkInTicket(staffDatabase, { passengerId: item.passengerId });
    else await boardTicket(staffDatabase, { passengerId: item.passengerId });
    await refreshQueues();
  } catch (error) {
    loadError.value = databaseRequestError(
      error,
      "Could not update ticket status.",
    );
  } finally {
    busy.value = false;
  }
}
async function lookupTicket() {
  if(!staffDatabase || scanBusy.value)return;
  const code=activeSailing.value,raw=ticketLookup.value;
  scannedTicket.value=null;scanError.value='';scanBusy.value=true;
  try{
    const {data}=await verifyTicketQr(staffDatabase,raw,code);
    if(code===activeSailing.value && showScanner.value && raw===ticketLookup.value)scannedTicket.value=data.passenger;
  }catch(cause){scanError.value=databaseRequestError(cause,'Could not verify this ticket. Check your connection and try again.');}
  finally{scanBusy.value=false;}
}
async function confirmScannedTicket(){
  const ticket=scannedTicket.value;
  if(!ticket || ticket.booking.sailing.code!==activeSailing.value)return;
  await processItem({passengerId:ticket.id,ticketCode:ticket.ticketCode,reference:ticket.booking.reference,name:ticket.fullName,
    initials:ticket.fullName.slice(0,2).toUpperCase(),detail:ticket.booking.sailing.code,status:ticket.ticketStatus.replace('_','-'),tone:'blue'});
  scannedTicket.value=null;showScanner.value=false;ticketLookup.value='';
}
watch(ticketLookup,()=>{scannedTicket.value=null;});
watch(showScanner,()=>{scannedTicket.value=null;scanError.value='';});
watch(activeSailing,()=>{scannedTicket.value=null;});
function stopCamera() {
  if (scanFrame) cancelAnimationFrame(scanFrame);
  scanFrame = 0;
  scannerStream?.getTracks().forEach((track) => track.stop());
  scannerStream = null;
  if (scannerVideo.value) scannerVideo.value.srcObject = null;
}
async function startCamera() {
  scanError.value = "";
  const Detector = (window as any).BarcodeDetector;
  if (!Detector) {
    scanError.value =
      "Camera QR scanning is unavailable in this browser. Enter the ticket code instead.";
    return;
  }
  try {
    stopCamera();
    await nextTick();
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    if (!scannerVideo.value) {
      stopCamera();
      return;
    }
    scannerVideo.value.srcObject = scannerStream;
    await scannerVideo.value.play();
    const detector = new Detector({ formats: ["qr_code"] });
    const scan = async () => {
      if (!scannerStream || !scannerVideo.value) return;
      try {
        const codes = await detector.detect(scannerVideo.value);
        if (codes[0]?.rawValue) {
          ticketLookup.value = String(codes[0].rawValue);
          stopCamera();
          await lookupTicket();
          return;
        }
      } catch {
        /* Keep scanning until the camera closes. */
      }
      scanFrame = requestAnimationFrame(scan);
    };
    scanFrame = requestAnimationFrame(scan);
  } catch (error) {
    stopCamera();
    scanError.value = databaseRequestError(
      error,
      "Could not start camera. Enter the ticket code instead.",
    );
  }
}
onBeforeUnmount(() => {
  stopCamera();
  if (searchTimer) clearTimeout(searchTimer);
});
async function collectPayment() {
  if (
    !staffDatabase ||
    !selectedBookingCanPay.value ||
    !selectedDiscountsVerified.value ||
    busy.value
  )
    return;
  if (
    !(await confirmAction({
      title: "Confirm payment received?",
      message: `Confirm cash received: PHP ${Number(selectedBooking.value.total).toLocaleString()} for ${selectedBooking.value.reference}?`,
      confirmText: "Confirm cash received",
      danger: false,
    }))
  )
    return;
  busy.value = true;
  loadError.value = "";
  try {
    await collectBookingPayment(staffDatabase, {
      bookingId: selectedBooking.value.id,
      method: paymentMethod.value,
    });
    selectedBooking.value = null;
    await refreshQueues();
  } catch (error) {
    loadError.value = databaseRequestError(error, "Could not record payment.");
  } finally {
    busy.value = false;
  }
}
async function verifyPayment() {
  if (!selectedBookingNeedsVerification.value || busy.value || selectedBookingDeparted.value) return;
  const booking = selectedBooking.value;
  if (!(await confirmAction({ title: 'Verify online payment?', message: `Verify ${paymentMethodLabel(booking)} payment of PHP ${Number(booking.total).toLocaleString()} for ${booking.reference}? This issues the passenger e-ticket.`, confirmText: 'Verify and issue ticket', danger: false }))) return;
  busy.value = true; loadError.value = '';
  try {
    await verifyOnlinePayment(booking.id);
    selectedBooking.value = null;
    await refreshQueues();
  } catch (cause) { loadError.value = databaseRequestError(cause, 'Could not verify payment.'); }
  finally { busy.value = false; }
}
function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
async function scrollToSection(id: string) {
  activeSection.value = id;
  const content = await contentRef.value?.$el.getScrollElement();
  const target = document.getElementById(id);
  if (content && target)
    await contentRef.value?.$el.scrollToPoint(
      0,
      Math.max(
        0,
        target.getBoundingClientRect().top -
          content.getBoundingClientRect().top +
          content.scrollTop,
      ),
      350,
    );
}

</script>
<style scoped>
.transaction-reference { overflow-wrap: anywhere; font-size: 12px; color: var(--muted); }
.staff-shell {
  display: flex;
  min-height: 100vh;
  background: var(--cloud);
}
.staff-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: 235px;
  display: flex;
  flex-direction: column;
  padding: 26px 16px;
  background: var(--deep);
  color: #fff;
}
.staff-sidebar :deep(.brand-copy strong),
.staff-sidebar :deep(.brand-copy b) {
  color: #fff;
}
.staff-sidebar :deep(.brand-copy small) {
  color: #8eb8cc;
}
.staff-sidebar :deep(.brand-symbol) {
  background: var(--ocean);
}
.role-card {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 42px 5px 25px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.role-avatar,
.mini-avatar {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #d9edf8;
  color: var(--ocean);
  font-size: 10px;
  font-weight: 800;
}
.role-card > div {
  display: grid;
}
.role-card small {
  color: #6f91a4;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.role-card strong {
  margin-top: 4px;
  font-size: 11px;
}
.role-card em {
  margin-top: 3px;
  color: #7cc4e5;
  font-size: 9px;
  font-style: normal;
}
nav {
  display: grid;
  gap: 4px;
}
nav p {
  margin: 16px 8px 5px;
  color: #6e8b9d;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
}
nav a,
.logout {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  color: #a8c0cf;
  text-decoration: none;
  font-size: 11px;
}
nav a ion-icon,
.logout ion-icon {
  font-size: 17px;
}
nav a.active,
nav a:hover {
  background: #14355a;
  color: #fff;
}
.logout {
  margin-top: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding-top: 18px;
}
.staff-main {
  width: calc(100% - 235px);
  margin-left: 235px;
}
.topbar {
  display: flex;
  align-items: center;
  height: 73px;
  padding: 0 35px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
  color: var(--muted);
  font-size: 12px;
}
.breadcrumbs span {
  padding: 0 8px;
  color: #c4ccd5;
}
.breadcrumbs strong {
  color: var(--ink);
}
.top-actions {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-left: auto;
  font-size: 18px;
}
.mini-avatar {
  font-size: 10px;
}
.content {
  padding: 40px 35px;
}
.heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  margin-bottom: 28px;
}
.heading h1 {
  margin: 7px 0 5px;
  font-size: 29px;
  letter-spacing: -1px;
}
.heading p:last-child {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}
.kicker {
  margin: 0;
  color: var(--ocean);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.11em;
}
.primary {
  --background: var(--ocean);
  --box-shadow: none;
  --border-radius: 9px;
  height: 42px;
  text-transform: none;
  font-weight: 800;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}
.metric-grid article,
.panel {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
}
.metric-grid article {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}
.metric-grid article > span {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  font-size: 19px;
}
.metric-grid .blue {
  background: var(--light-blue);
  color: var(--ocean);
}
.metric-grid .mint {
  background: #def7f0;
  color: #078a72;
}
.metric-grid .amber {
  background: #fff1d2;
  color: #b77700;
}
.metric-grid small,
.metric-grid strong,
.metric-grid em {
  display: block;
}
.metric-grid small {
  color: var(--muted);
  font-size: 10px;
}
.metric-grid strong {
  margin: 4px 0 2px;
  font-size: 23px;
}
.metric-grid em {
  color: #078a72;
  font-size: 9px;
  font-style: normal;
}
.workspace-grid {
  display: grid;
  grid-template-columns: 1.6fr 0.85fr;
  gap: 20px;
}
.panel {
  padding: 20px;
}
.panel-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  margin-bottom: 14px;
}
.panel-heading h2,
.shift-panel h2 {
  margin: 5px 0 0;
  font-size: 18px;
}
.filter {
  display: flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 7px 9px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 10px;
}
.queue-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 0;
  border-top: 1px solid var(--line);
}
.person-avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 800;
}
.person-avatar.blue {
  background: var(--light-blue);
  color: var(--ocean);
}
.person-avatar.mint {
  background: #def7f0;
  color: #078a72;
}
.person-avatar.amber {
  background: #fff1d2;
  color: #b77700;
}
.queue-item > div {
  flex: 1;
}
.queue-item strong {
  font-size: 12px;
}
.queue-item p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 10px;
}
.queue-item > ion-icon {
  color: var(--muted);
}
.status {
  padding: 5px 7px;
  border-radius: 5px;
  background: #e6f7ef;
  color: #117a52;
  font-size: 8px;
  font-weight: 800;
}
.status.pending,
.status.waiting {
  background: #fff1d2;
  color: #9a5b00;
}
.status.checked-in {
  background: var(--light-blue);
  color: var(--ocean);
}
.shift-panel {
  height: max-content;
}
.shift-time {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 27px 0 12px;
  color: var(--ocean);
}
.shift-time strong {
  font-size: 16px;
}
.shift-time span {
  color: var(--muted);
  font-size: 10px;
}
.shift-line {
  display: flex;
  align-items: center;
  gap: 5px;
}
.shift-line span {
  width: 7px;
  height: 7px;
  border: 2px solid var(--ocean);
  border-radius: 50%;
}
.shift-line i {
  height: 1px;
  flex: 1;
  background: var(--line);
}
.shift-panel .muted {
  margin: 13px 0 18px;
  color: var(--muted);
  font-size: 10px;
}
.shift-panel ion-button {
  --color: var(--ocean);
  --border-color: #bcd9e9;
  --border-radius: 8px;
  text-transform: none;
  font-weight: 800;
}
.staff-note {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 20px;
  color: var(--muted);
  font-size: 10px;
}
.staff-note ion-icon {
  color: var(--ocean);
}
.modal-card {
  position: relative;
  width: min(90vw, 400px);
  margin: 20vh auto 0;
  padding: 28px;
  border-radius: 16px;
  background: var(--surface);
  color: var(--ink);
  text-align: center;
}
.close {
  position: absolute;
  right: 16px;
  top: 16px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 20px;
}
.scan-icon {
  display: grid;
  place-items: center;
  width: 55px;
  height: 55px;
  margin: 0 auto 15px;
  border-radius: 14px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 27px;
}
.modal-card h2 {
  margin: 0;
  font-size: 20px;
}
.modal-field {
  display: grid;
  gap: 6px;
  margin-top: 14px;
  color: var(--ink);
  text-align: left;
  font-size: 11px;
  font-weight: 700;
}
.modal-field input,
.modal-field select {
  width: 100%;
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
  color: var(--ink);
  font: inherit;
}
.queue-update {
  width: auto;
  min-width: 68px;
  padding: 0 9px;
  font-size: 9px;
  font-weight: 800;
  white-space: nowrap;
}
.queue-update:disabled {
  cursor: default;
  opacity: 0.55;
}
.modal-card p {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
.scan-box {
  display: grid;
  gap: 7px;
  place-items: center;
  margin: 20px 0;
  padding: 25px;
  border: 1px dashed #9fcbe2;
  border-radius: 12px;
  color: var(--ocean);
  font-size: 11px;
}
.scan-box ion-icon {
  font-size: 38px;
}
.queue-panel,
.activity-panel {
  scroll-margin-top: 20px;
}
.queue-item > div {
  min-width: 0;
}
.queue-item p {
  overflow-wrap: anywhere;
}
.queue-update {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-soft);
  color: var(--ocean);
  cursor: pointer;
}
.queue-update:hover {
  background: var(--light-blue);
}
.activity-panel {
  margin-top: 20px;
}
.activity-count {
  padding: 5px 8px;
  border-radius: 20px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 9px;
  font-weight: 800;
}
.activity-list {
  display: grid;
}
.activity-item {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  padding: 12px 0;
  border-top: 1px solid var(--line);
}
.activity-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--light-blue);
  color: var(--ocean);
}
.activity-icon ion-icon {
  font-size: 17px;
}
.activity-item > div {
  min-width: 0;
}
.activity-item strong {
  font-size: 11px;
}
.activity-item p {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 10px;
  overflow-wrap: anywhere;
}
.activity-item > small {
  color: var(--muted);
  font-size: 9px;
  white-space: nowrap;
}
#overview,
#queue,
#activity {
  scroll-margin-top: 20px;
}
@media (max-width: 800px) {
  .staff-sidebar {
    display: none;
  }
  .staff-main {
    width: 100%;
    margin: 0;
  }
  .content {
    padding: 25px 16px;
  }
  .heading {
    align-items: start;
    flex-direction: column;
    gap: 17px;
  }
  .metric-grid {
    grid-template-columns: 1fr;
  }
  .workspace-grid {
    grid-template-columns: 1fr;
  }
  .topbar {
    padding: 0 17px;
  }
  .status {
    display: none;
  }
  .activity-item {
    grid-template-columns: 34px minmax(0, 1fr);
  }
  .activity-item > small {
    grid-column: 2;
  }
  .queue-item {
    gap: 8px;
  }
  .queue-item p {
    font-size: 9px;
  }
}
.staff-sidebar {
  z-index: 20;
}
.staff-sidebar nav {
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #36516a transparent;
}
.staff-sidebar nav::-webkit-scrollbar {
  width: 5px;
}
.staff-sidebar nav::-webkit-scrollbar-thumb {
  border-radius: 8px;
  background: #36516a;
}
.staff-sidebar nav a {
  min-height: 39px;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}
.staff-sidebar nav a.active {
  box-shadow: inset 3px 0 0 var(--primary);
}
.staff-profile-chip {
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 4px 10px 4px 4px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--ink);
}
.staff-profile-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--light-blue);
  color: var(--ocean);
}
.staff-profile-icon ion-icon {
  font-size: 17px;
}
.staff-profile-copy {
  display: grid;
  gap: 2px;
}
.staff-profile-copy strong {
  font-size: 10px;
}
.staff-profile-copy small {
  color: var(--muted);
  font-size: 8px;
}
.top-actions > ion-icon {
  color: var(--muted);
  font-size: 18px;
}
.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 6px;
}
.breadcrumbs > ion-icon {
  color: var(--ocean);
  font-size: 14px;
}
.metric-grid article,
.panel {
  box-shadow: 0 8px 24px #0b1f3a0a;
}
.metric-grid article {
  min-height: 92px;
}
.panel {
  border-radius: 16px;
}
.panel-heading .kicker {
  display: inline-flex;
  min-height: 22px;
  align-items: center;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--light-blue);
  font-size: 9px;
}
.queue-item {
  transition: background-color 0.15s ease;
}
.queue-item:hover {
  background: var(--surface-soft);
}
.queue-update {
  transition:
    background-color 0.15s ease,
    transform 0.15s ease;
}
.queue-update:hover {
  transform: translateX(2px);
}
.shift-panel {
  background: var(--surface);
}
.staff-menu,
.staff-scrim {
  display: none;
}
.queue-panel,
.activity-panel,
#overview {
  scroll-margin-top: 20px;
}
:root[data-theme="dark"] .metric-grid .mint {
  background: #12342f;
  color: #57c6aa;
}
:root[data-theme="dark"] .metric-grid .amber {
  background: #3b2e17;
  color: #edbd5e;
}
:root[data-theme="dark"] .person-avatar.mint {
  background: #12342f;
  color: #57c6aa;
}
:root[data-theme="dark"] .person-avatar.amber {
  background: #3b2e17;
  color: #edbd5e;
}
:root[data-theme="dark"] .status {
  background: #12342f;
  color: #57c6aa;
}
:root[data-theme="dark"] .status.pending,
:root[data-theme="dark"] .status.waiting {
  background: #3b2e17;
  color: #edbd5e;
}
@media (max-width: 800px) {
  .staff-sidebar {
    display: none;
  }
  .staff-sidebar.mobile-open {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 31;
    display: flex;
    width: min(84vw, 300px);
    padding: 22px 15px;
    background: var(--deep);
    box-shadow: 12px 0 36px #020b1880;
  }
  .staff-scrim {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    background: #061222a8;
  }
  .staff-sidebar.mobile-open nav {
    padding-right: 5px;
  }
  .staff-menu {
    display: grid;
    place-items: center;
    flex: none;
    width: 36px;
    height: 36px;
    margin-right: 9px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--surface);
    color: var(--ink);
    font-size: 19px;
  }
  .topbar {
    gap: 9px;
  }
  .breadcrumbs {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .top-actions {
    gap: 12px;
  }
  .metric-grid article {
    min-height: 82px;
  }
  .status {
    display: inline-flex;
    white-space: nowrap;
    font-size: 7px;
  }
  .queue-item {
    gap: 7px;
  }
  .queue-item p {
    line-height: 1.4;
  }
  .panel {
    padding: 17px;
  }
}
@media (max-width: 460px) {
  .staff-profile-chip {
    padding: 3px;
    border: 0;
    background: transparent;
  }
  .staff-profile-copy {
    display: none;
  }
  .top-actions {
    gap: 10px;
  }
  .topbar {
    padding: 0 12px;
  }
  .content {
    padding: 21px 12px;
  }
  .queue-item {
    gap: 6px;
  }
  .person-avatar {
    width: 30px;
    height: 30px;
  }
  .status {
    padding: 4px 5px;
    font-size: 6px;
  }
  .queue-update {
    width: 26px;
    height: 26px;
  }
}
.workspace-grid {
  align-items: stretch;
}
.shift-panel {
  height: auto;
  display: flex;
  flex-direction: column;
}
.shift-panel > ion-button {
  margin-top: auto;
}
.shift-modal .kicker {
  margin: 0 0 6px;
}
.shift-modal h2 {
  margin: 0;
  font-size: 21px;
}
.shift-modal-date {
  margin: 5px 0 18px;
}
.shift-modal-time {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18px 0;
  padding: 16px 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-soft);
  color: var(--ocean);
}
.shift-modal-time strong {
  font-size: 16px;
}
.shift-modal-time span {
  color: var(--muted);
  font-size: 11px;
}
.shift-modal-location {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: var(--light-blue);
  color: var(--ocean);
}
.shift-modal-location > ion-icon {
  font-size: 20px;
}
.shift-modal-location span,
.shift-modal-location strong,
.shift-modal-location small {
  display: block;
}
.shift-modal-location strong {
  color: var(--ink);
  font-size: 12px;
}
.shift-modal-location small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 10px;
}
.shift-modal > ion-button {
  margin-top: 5px;
}
@media (max-width: 800px) {
  .workspace-grid > .queue-panel,
  .workspace-grid > .shift-panel {
    height: auto;
  }
  .shift-panel > ion-button {
    margin-top: 18px;
  }
}
ion-modal.shift-detail-modal {
  --width: min(92vw, 480px);
  --height: min(88vh, 430px);
  --border-radius: 20px;
  --background: var(--surface);
  --box-shadow: 0 24px 70px #020b1866;
}
ion-modal.shift-detail-modal::part(content) {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--surface);
}
.shift-modal {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  justify-content: center;
  gap: 0;
  overflow: auto;
  padding: 30px;
  background: var(--surface);
  color: var(--ink);
}
.shift-modal .close {
  z-index: 1;
  top: 16px;
  right: 16px;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
  font-size: 18px;
}
.shift-modal-heading {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-right: 32px;
}
.shift-modal-heading .scan-icon {
  width: 48px;
  height: 48px;
  flex: none;
  margin: 0;
  border-radius: 13px;
  font-size: 23px;
}
.shift-modal-heading .kicker {
  margin-bottom: 5px;
}
.shift-modal-heading h2 {
  margin: 0;
  color: var(--ink);
  font-size: 21px;
  letter-spacing: -0.4px;
}
.shift-modal-date {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.45;
}
.shift-modal-time {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  margin: 24px 0 14px;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-soft);
  color: var(--ink);
}
.shift-modal-time > div:last-child {
  text-align: right;
}
.shift-modal-time small,
.shift-modal-location small {
  display: block;
  color: var(--muted);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.shift-modal-time strong {
  display: block;
  margin-top: 6px;
  color: var(--ocean);
  font-size: 19px;
  white-space: nowrap;
}
.shift-modal-arrow {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--light-blue);
  color: var(--ocean);
}
.shift-modal-arrow ion-icon {
  font-size: 14px;
}
.shift-modal-location {
  display: flex;
  align-items: center;
  gap: 11px;
  margin: 0;
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--light-blue);
  color: var(--ink);
}
.shift-location-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--surface);
  color: var(--ocean);
}
.shift-location-icon ion-icon {
  font-size: 19px;
}
.shift-modal-location > div {
  min-width: 0;
  flex: 1;
}
.shift-modal-location strong,
.shift-modal-location > div > span {
  display: block;
}
.shift-modal-location strong {
  margin-top: 4px;
  font-size: 12px;
}
.shift-modal-location > div > span {
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
}
.location-trailing {
  color: var(--ocean);
  font-size: 15px;
}
.shift-modal-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 13px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.45;
}
.shift-modal-note ion-icon {
  flex: none;
  color: var(--ocean);
  font-size: 15px;
}
.shift-modal .shift-done {
  width: 100%;
  height: 44px;
  margin: 20px 0 0;
  --border-radius: 10px;
}
@media (max-width: 480px) {
  ion-modal.shift-detail-modal {
    --width: calc(100vw - 24px);
    --height: min(84vh, 410px);
  }
  .shift-modal {
    padding: 24px 19px;
  }
  .shift-modal-heading {
    gap: 11px;
  }
  .shift-modal-heading h2 {
    font-size: 19px;
  }
  .shift-modal-time {
    gap: 6px;
    margin: 20px 0 12px;
    padding: 14px 11px;
  }
  .shift-modal-time strong {
    font-size: 17px;
  }
  .shift-modal-time small {
    font-size: 7px;
  }
  .shift-modal-note {
    font-size: 9px;
  }
  .shift-modal .shift-done {
    margin-top: 16px;
  }
}
.logout {
  width: 100%;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.logout:hover {
  color: #fff;
  background: #14355a;
}
.queue-search {
  width: min(100%, 260px);
  min-height: 36px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-soft);
  color: var(--ink);
  font: inherit;
  font-size: 11px;
}
.queue-search::placeholder {
  color: var(--muted);
}
.ticket-list-modal {
  text-align: left;
  margin: 12vh auto 0;
}
.ticket-list-modal h2 {
  margin: 7px 0;
}
.ticket-record {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 10px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
}
.ticket-record > div {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.ticket-record strong {
  font-size: 12px;
}
.ticket-record small {
  color: var(--muted);
  font-size: 10px;
}
.ticket-record code {
  max-width: 56%;
  overflow-wrap: anywhere;
  color: var(--ocean);
  font-size: 10px;
}
.empty-state {
  padding: 18px 0;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}
@media (max-width: 600px) {
  .panel-heading {
    gap: 10px;
    flex-wrap: wrap;
  }
  .queue-search {
    width: 100%;
    order: 1;
  }
  .queue-item {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .queue-item > div {
    flex-basis: calc(100% - 56px);
  }
  .queue-item .status {
    margin-left: 42px;
  }
  .queue-update {
    margin-left: auto;
  }
  .ticket-record {
    align-items: flex-start;
    flex-direction: column;
  }
  .ticket-record code {
    max-width: 100%;
  }
}
.queue-update {
  width: auto;
  min-width: 72px;
  min-height: 32px;
  padding: 0 10px;
}
.status.awaiting-payment {
  background: #fff1d2;
  color: #9a5b00;
}
.status.past-due {
  background: #ffebe7;
  color: #a53e33;
}
.ticket-list-modal {
  max-height: 78vh;
  overflow-y: auto;
}
.payment-actions {
  display: grid;
  gap: 12px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.payment-actions ion-button,
.ticket-list-modal form ion-button {
  margin-top: 10px;
}
.cancellation-notice {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
  color: var(--ink);
  line-height: 1.5;
}
.scanner-video {
  width: 100%;
  max-height: 220px;
  object-fit: cover;
  border-radius: 12px;
  background: #071d31;
}
.camera-action {
  margin: 12px 0 4px;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--light-blue);
  color: var(--ocean);
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.scan-error {
  color: #d36a68 !important;
}
.staff-refresh {
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--ocean);
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.staff-refresh:disabled {
  opacity: 0.5;
}
.ticketing-guide {
  gap: 0;
  background: linear-gradient(145deg, var(--surface), var(--surface-soft));
}
.ticketing-guide h2 {
  margin-bottom: 12px;
}
.ticketing-guide ol {
  display: grid;
  gap: 14px;
  margin: 4px 0 24px;
  padding-left: 20px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.55;
}
.ticketing-guide li::marker {
  color: var(--ocean);
  font-weight: 800;
}
.walk-in-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  margin-top: auto;
  padding: 0 12px;
  border-radius: 9px;
  background: var(--ocean);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  text-decoration: none;
}
.walk-in-link:hover {
  filter: brightness(1.08);
}
.walk-in-link ion-icon {
  font-size: 16px;
}
.staff-note.error {
  padding: 11px 13px;
  border-radius: 9px;
  background: #fff0ee;
  color: #a53e35;
}
.staff-note.error ion-icon {
  color: inherit;
}
@media (max-width: 600px) {
  .ticketing-guide ol {
    margin-bottom: 18px;
  }
  .walk-in-link {
    width: 100%;
  }
  .queue-update {
    min-width: 64px;
  }
  .queue-item .status {
    margin-left: 40px;
  }
}
.ticket-record:has(.discount-verification) {
  flex-wrap: wrap;
}
.status.cancelled,
.status.expired {
  background: #ffebe7;
  color: #a53e33;
}
.ticketing-workspace .content { padding: 28px 32px 40px; }
.ticketing-workspace .heading { align-items: center; gap: 16px; margin-bottom: 24px; }
.ticketing-workspace .heading h1 { font-size: 28px; line-height: 1.3; }
.ticketing-workspace .heading p:last-child { font-size: 13px; line-height: 1.7; }
.ticketing-workspace .staff-refresh { display: inline-flex; align-items: center; gap: 7px; min-height: 44px; font-weight: 600; }
.ticketing-workspace .staff-refresh ion-icon { font-size: 17px; }
.ticketing-workspace .metric-grid { gap: 16px; margin-bottom: 24px; }
.ticketing-workspace .metric-grid article { min-width: 0; min-height: 116px; padding: 20px; border-radius: 14px; background: var(--surface); }
.ticketing-workspace .metric-grid article > span { width: 42px; height: 42px; border-radius: 12px; flex: none; }
.ticketing-workspace .metric-grid small { font-size: 12px; line-height: 1.6; }
.ticketing-workspace .metric-grid strong { font-size: 28px; line-height: 1.3; margin: 4px 0; }
.ticketing-workspace .metric-grid em { color: var(--muted); font-size: 11px; font-style: normal; line-height: 1.6; }
.ticketing-workspace .workspace-grid { grid-template-columns: minmax(0, 1fr) 290px; align-items: start; gap: 20px; }
.ticketing-workspace .queue-panel { min-width: 0; padding: 22px; border-radius: 15px; background: var(--surface); }
.ticketing-workspace .queue-panel .panel-heading { display: block; margin: 0; }
.ticketing-workspace .queue-panel h2 { margin: 7px 0 0; font-size: 20px; line-height: 1.4; }
.ticketing-workspace .queue-filters { display: grid; grid-template-columns: minmax(0, 1fr) 180px; align-items: end; gap: 12px; margin-top: 18px; }
.ticketing-workspace .queue-filters label { display: grid; gap: 7px; min-width: 0; color: var(--muted); font-size: 11px; font-weight: 500; }
.ticketing-workspace .queue-filters input, .ticketing-workspace .queue-filters select { width: 100%; min-width: 0; height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); color: var(--ink); font-size: 12px; font-weight: 400; }
.ticketing-workspace .queue-search::placeholder { font-size: 11px; }
.ticketing-workspace .queue-result-count { margin: 14px 0; color: var(--muted); font-size: 11px; line-height: 1.7; }
.ticketing-workspace .queue-list { display: grid; gap: 10px; }
.ticketing-workspace .queue-item { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; gap: 10px 12px; align-items: start; padding: 16px; border: 1px solid var(--line); border-radius: 11px; background: var(--surface-soft); }
.ticketing-workspace .person-avatar { grid-column: 1; grid-row: 1 / 3; width: 36px; height: 36px; font-size: 11px; }
.ticketing-workspace .queue-person { grid-column: 2; grid-row: 1 / 3; min-width: 0; }
.ticketing-workspace .queue-person strong { font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.ticketing-workspace .queue-reference { display: block; margin-top: 3px; color: var(--muted); font-size: 10px; line-height: 1.6; overflow-wrap: anywhere; }
.ticketing-workspace .queue-person .queue-route { margin: 5px 0 0; color: var(--ink); font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }
.ticketing-workspace .queue-person .queue-departure { display: flex; align-items: flex-start; gap: 5px; margin: 5px 0 0; color: var(--muted); font-size: 11px; line-height: 1.7; }
.ticketing-workspace .queue-departure ion-icon { flex: none; margin-top: 3px; color: var(--ocean); font-size: 13px; }
.ticketing-workspace .queue-item .status { grid-column: 3; grid-row: 1; justify-self: end; margin: 0; max-width: 120px; padding: 5px 8px; border-radius: 7px; font-size: 9px; line-height: 1.5; text-align: center; white-space: normal; }
.ticketing-workspace .queue-item .status.awaiting-payment, .ticketing-workspace .queue-item .status.refund-pending { color: #8a5100; background: #fff0d5; }
.ticketing-workspace .queue-item .status.paid { color: #167252; background: #e0f4eb; }
.ticketing-workspace .queue-item .status.cancelled, .ticketing-workspace .queue-item .status.expired, .ticketing-workspace .queue-item .status.refunded { color: var(--muted); background: var(--surface); }
.ticketing-workspace .queue-update { grid-column: 3; grid-row: 2; justify-self: end; min-height: 40px; min-width: 80px; margin: 0; padding: 8px 12px; font-size: 11px; font-weight: 600; border-radius: 8px; }
@media (max-width: 1199px) {
  .ticketing-workspace .workspace-grid { grid-template-columns: minmax(0, 1fr); }
  .ticketing-workspace .queue-filters { grid-template-columns: minmax(0, 1fr) minmax(150px, .6fr); }
}
@media (max-width: 600px) {
  .ticketing-workspace .content { padding: 22px 16px 32px; }
  .ticketing-workspace .heading { flex-wrap: wrap; }
  .ticketing-workspace .metric-grid { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .ticketing-workspace .metric-grid article { min-height: 90px; padding: 16px; }
  .ticketing-workspace .queue-panel { padding: 16px; }
  .ticketing-workspace .queue-filters { grid-template-columns: minmax(0, 1fr); }
  .ticketing-workspace .queue-item { grid-template-columns: 30px minmax(0, 1fr); gap: 8px; padding: 13px; }
  .ticketing-workspace .person-avatar { width: 30px; height: 30px; grid-row: 1; }
  .ticketing-workspace .queue-person { grid-row: 1; }
  .ticketing-workspace .queue-item .status { grid-column: 2; grid-row: 2; justify-self: start; }
  .ticketing-workspace .queue-update { grid-column: 1 / -1; grid-row: 3; width: 100%; justify-self: stretch; min-height: 44px; }
}

/* Dense reservation rows keep large queues easy to scan. */
.ticketing-workspace .queue-list { gap: 6px; }
.ticketing-workspace .queue-panel { padding: 18px; }
.ticketing-workspace .metric-grid article { min-height: 90px; padding: 16px; }
.ticketing-workspace .queue-item { grid-template-columns: 30px minmax(0, 1fr) auto 70px; align-items: center; gap: 8px 10px; padding: 10px 12px; border-radius: 9px; }
.ticketing-workspace .person-avatar { width: 30px; height: 30px; grid-row: 1; }
.ticketing-workspace .queue-person { grid-row: 1; }
.ticketing-workspace .queue-person strong { display: inline; font-size: 13px; line-height: 1.5; }
.ticketing-workspace .queue-reference { display: inline; margin: 0 0 0 8px; font-size: 10px; }
.ticketing-workspace .queue-person .queue-route { margin: 2px 0 0; font-size: 11px; line-height: 1.5; }
.ticketing-workspace .queue-person .queue-departure { margin: 2px 0 0; font-size: 10px; line-height: 1.5; }
.ticketing-workspace .queue-departure ion-icon { margin-top: 1px; font-size: 12px; }
.ticketing-workspace .queue-item .status { grid-column: 3; grid-row: 1; }
.ticketing-workspace .queue-update { grid-column: 4; grid-row: 1; min-width: 0; width: 70px; min-height: 40px; padding: 8px; }
.booking-payment-modal { --width: min(660px, calc(100vw - 32px)); --height: min(820px, 90vh); --border-radius: 18px; }
.booking-payment-modal .booking-dialog { box-sizing: border-box; width: 100%; height: 100%; max-height: none; margin: 0; padding: 0; border: 0; display: block; overflow-y: auto; text-align: left; background: var(--surface); color: var(--ink); }
.booking-dialog .booking-dialog-heading { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 24px; border-bottom: 1px solid var(--line); background: var(--surface); }
.booking-dialog-heading > div { min-width: 0; }
.booking-dialog-heading .kicker { margin: 0 0 5px; overflow-wrap: anywhere; }
.booking-dialog-heading h2 { margin: 0; font-size: 21px; line-height: 1.4; }
.booking-dialog-heading .close { position: static; order: 2; flex: none; display: grid; place-items: center; width: 40px; height: 40px; margin: 0; padding: 0; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); color: var(--ink); }
.booking-dialog .booking-dialog-body { display: grid; gap: 14px; padding: 22px 24px; }
.booking-dialog-body > p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.7; }
.booking-dialog .booking-amount { display: grid; grid-template-columns: 1fr auto; gap: 5px 12px; padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); }
.booking-amount > span { font-size: 12px; color: var(--muted); }
.booking-amount > strong { grid-column: 1; font-size: 27px; line-height: 1.3; }
.booking-amount > b { grid-column: 2; grid-row: 1 / 3; align-self: center; max-width: 130px; padding: 7px 10px; border-radius: 8px; background: var(--light-blue); color: var(--ocean); font-size: 11px; text-align: center; }
.dialog-sailing h3 { margin: 0 0 8px; font-size: 17px; line-height: 1.5; }
.dialog-sailing p { display: flex; align-items: center; gap: 8px; margin: 5px 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
.dialog-sailing ion-icon { color: var(--ocean); flex: none; font-size: 16px; }
.booking-dialog .dialog-section-title { margin: 3px 0 0; font-size: 14px; }
.booking-dialog .ticket-record { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; margin: 0; padding: 12px 14px; border-radius: 10px; background: var(--surface-soft); }
.booking-dialog .ticket-record > div { min-width: 0; }
.booking-dialog .ticket-record strong { font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
.booking-dialog .ticket-record small { display: block; font-size: 10px; line-height: 1.7; color: var(--muted); }
.booking-dialog .ticket-record > small, .booking-dialog .ticket-record > code, .booking-dialog .ticket-record > div:not(:first-child) { grid-column: 1 / -1; overflow-wrap: anywhere; }
.dialog-person-fare { font-size: 12px; font-weight: 600; align-self: start; white-space: nowrap; }
.booking-dialog .payment-actions { margin-top: 0; padding-top: 18px; }
.booking-dialog .payment-actions ion-button { margin: 0; min-height: 46px; font-size: 13px; letter-spacing: 0; }
@media (max-width: 600px) {
 .ticketing-workspace .queue-item { grid-template-columns: 26px minmax(0, 1fr) 62px; gap: 6px 8px; padding: 10px; }
 .ticketing-workspace .person-avatar { width: 26px; height: 26px; align-self: start; }
 .ticketing-workspace .queue-person { grid-row: 1; }
 .ticketing-workspace .queue-reference { display: block; margin: 2px 0 0; }
 .ticketing-workspace .queue-item .status { grid-column: 2; grid-row: 2; justify-self: start; }
 .ticketing-workspace .queue-update { grid-column: 3; grid-row: 1 / 3; width: 62px; min-height: 44px; }
 .booking-payment-modal { --width: calc(100vw - 24px); --height: 90vh; --border-radius: 14px; }
 .booking-dialog .booking-dialog-heading { padding: 16px; }
 .booking-dialog-heading h2 { font-size: 18px; }
 .booking-dialog .booking-dialog-body { padding: 16px; }
 .booking-amount > strong { font-size: 23px; }
 .booking-amount > b { max-width: 100px; }
}


.ticketing-bookings .workspace-grid { grid-template-columns: minmax(0, 1fr); }
.ticketing-workspace .all-bookings-link { display: inline-flex; align-items: center; gap: 7px; margin-top: 12px; min-height: 40px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; color: var(--ocean); text-decoration: none; font-size: 12px; }
.all-bookings-link ion-icon { font-size: 16px; }

.booking-payment-details { display: grid; gap: 12px; margin: 16px 0; padding: 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); }
.booking-payment-details div { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.booking-payment-details dt { color: var(--muted); font-size: 12px; }
.booking-payment-details dd { margin: 0; color: var(--ink); font-size: 12px; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
.queue-person .queue-payment { font-size: 11px; color: var(--muted); }
.queue-payment strong { color: var(--ink); font-size: inherit; }
</style>

<style scoped>
.ticketing-dashboard .heading { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
.ticketing-dashboard .heading > div { flex: 1; min-width: 240px; }
.ticketing-dashboard .heading h1 { font-size: 30px; }
.ticketing-dashboard .dashboard-walk-in { display: inline-flex; justify-content: center; align-items: center; gap: 8px; min-height: 44px; padding: 10px 14px; border-radius: 10px; background: var(--action); color: #fff; font-size: 12px; font-weight: 600; text-decoration: none; }
.ticketing-dashboard .dashboard-walk-in ion-icon { font-size: 18px; }
.ticketing-dashboard .staff-refresh { margin: 0; min-height: 44px; }
.ticketing-dashboard .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 24px; }
.ticketing-dashboard .metric-grid article { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 12px; align-items: start; padding: 20px 16px; min-width: 0; border-radius: 16px; box-shadow: none; }
.ticketing-dashboard .metric-grid article > span { margin-top: 3px; }
.ticketing-dashboard .metric-grid small { font-size: 12px; line-height: 1.5; }
.ticketing-dashboard .metric-grid strong { font-size: 30px; line-height: 1.3; margin: 6px 0; }
.ticketing-dashboard .metric-grid em { font-size: 11px; line-height: 1.7; overflow-wrap: anywhere; }
.ticketing-dashboard .workspace-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; align-items: start; }
.ticketing-dashboard .queue-panel { padding: 22px; border-radius: 18px; }
.ticketing-dashboard .panel-heading { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.ticketing-dashboard .panel-heading h2 { font-size: 21px; line-height: 1.5; }
.ticketing-dashboard .panel-heading .kicker { background: transparent; padding: 0; margin-bottom: 6px; }
.ticketing-dashboard .all-bookings-link { min-height: 44px; background: var(--surface-soft); padding: 9px 12px; border-radius: 9px; font-size: 11px; }
.ticketing-dashboard .queue-result-count { margin: 14px 0; font-size: 11px; color: var(--muted); }
.ticketing-dashboard .queue-list { display: grid; gap: 12px; }
.ticketing-dashboard .queue-item { display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; gap: 10px 12px; align-items: start; padding: 18px; border-radius: 14px; background: var(--surface-soft); border: 1px solid var(--line); }
.ticketing-dashboard .person-avatar { grid-column: 1; grid-row: 1 / 3; width: 38px; height: 38px; font-size: 12px; border-radius: 11px; }
.ticketing-dashboard .queue-person { grid-column: 2; grid-row: 1 / 3; min-width: 0; }
.ticketing-dashboard .queue-person > strong { display: block; font-size: 14px; line-height: 1.5; }
.ticketing-dashboard .queue-person .queue-reference { display: block; margin: 4px 0 8px; font-size: 10px; }
.ticketing-dashboard .queue-person .queue-route { font-size: 12px; line-height: 1.7; color: var(--ink); }
.ticketing-dashboard .queue-person .queue-departure { display: flex; align-items: center; gap: 5px; font-size: 11px; margin-top: 6px; line-height: 1.7; }
.ticketing-dashboard .queue-person .queue-departure ion-icon { flex: none; color: var(--ocean); }
.ticketing-dashboard .dashboard-queue-facts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin: 10px 0 8px; }
.ticketing-dashboard .dashboard-queue-facts span { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; }
.ticketing-dashboard .dashboard-queue-facts strong { font-size: 14px; }
.ticketing-dashboard .queue-person .queue-payment { margin-top: 8px; font-size: 11px; line-height: 1.7; }
.ticketing-dashboard .queue-item .status { grid-column: 3; display: inline-flex; align-items: center; gap: 5px; justify-self: end; text-transform: none; white-space: normal; max-width: 180px; padding: 6px 9px; font-size: 10px; line-height: 1.6; border-radius: 7px; }
.ticketing-dashboard .queue-item .status ion-icon { flex: none; font-size: 14px; }
.ticketing-dashboard .queue-update { grid-column: 3; grid-row: 2; display: inline-flex; justify-content: center; align-items: center; gap: 8px; width: auto; min-width: 0; max-width: 100%; white-space: normal; min-height: 44px; margin: 0; padding: 10px 12px; border-radius: 9px; background: var(--light-blue); color: var(--ocean); font-size: 11px; justify-self: end; }
.ticketing-dashboard .queue-update ion-icon { flex: none; font-size: 16px; }
.ticketing-dashboard .queue-panel .panel-heading { display: flex; flex-direction: row; align-items: center; }
.ticketing-dashboard .queue-item .status.awaiting-staff { background: #fff0d5; color: #8a5100; }
:global(:root[data-theme="dark"]) .ticketing-dashboard .queue-item .status.awaiting-staff { background: #392b13; color: #ffd17b; }
.ticketing-dashboard .dashboard-empty { display: grid; justify-items: center; padding: 32px 20px; text-align: center; background: var(--surface-soft); border: 1px dashed var(--line); border-radius: 14px; }
.ticketing-dashboard .dashboard-empty > ion-icon { font-size: 30px; color: var(--ocean); padding: 12px; border-radius: 14px; background: var(--light-blue); }
.ticketing-dashboard .dashboard-empty h3 { margin: 16px 0 8px; font-size: 17px; }
.ticketing-dashboard .dashboard-empty p { margin: 0; max-width: 330px; font-size: 12px; line-height: 1.8; color: var(--muted); }
.ticketing-dashboard .dashboard-empty a { display: inline-flex; align-items: center; min-height: 44px; margin-top: 10px; color: var(--ocean); font-size: 12px; }
.ticketing-dashboard a:focus-visible, .ticketing-dashboard button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
@media (max-width: 1200px) {
  .ticketing-dashboard .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ticketing-dashboard .workspace-grid { grid-template-columns: minmax(0, 1fr); }
  .ticketing-dashboard .queue-item .status { max-width: 200px; }
}
@media (max-width: 600px) {
  .ticketing-dashboard .heading > div { flex-basis: 100%; min-width: 0; }
  .ticketing-dashboard .metric-grid { gap: 10px; }
  .ticketing-dashboard .metric-grid article { grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 14px; }
  .ticketing-dashboard .metric-grid strong { font-size: 27px; }
  .ticketing-dashboard .queue-panel { padding: 16px; }
  .ticketing-dashboard .queue-item { grid-template-columns: 34px minmax(0, 1fr); padding: 14px; gap: 10px; }
  .ticketing-dashboard .person-avatar { grid-row: 1; width: 34px; height: 34px; }
  .ticketing-dashboard .queue-person { grid-row: 1; }
  .ticketing-dashboard .queue-item .status { grid-column: 2; grid-row: 2; justify-self: start; }
  .ticketing-dashboard .queue-update { grid-column: 2; grid-row: 3; justify-self: stretch; }
}
</style>

<style scoped>
.ticketing-bookings .heading { align-items: center; gap: 14px; }
.ticketing-bookings .heading h1 { font-size: 30px; }
.ticketing-bookings .staff-refresh { min-height: 44px; }
.ticketing-bookings .queue-panel { padding: 24px; border-radius: 18px; }
.ticketing-bookings .queue-panel .panel-heading { display: block; }
.ticketing-bookings .panel-heading h2 { font-size: 21px; margin: 8px 0 20px; }
.ticketing-bookings .panel-heading .kicker { padding: 0; background: transparent; }
.ticketing-bookings .queue-filters { display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, .4fr); gap: 16px; width: 100%; margin: 0; padding: 18px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface-soft); }
.ticketing-bookings .queue-filters label { min-width: 0; display: grid; gap: 9px; font-size: 12px; font-weight: 500; }
.ticketing-bookings .queue-filters label > span { display: flex; align-items: center; gap: 7px; }
.ticketing-bookings .queue-filters label ion-icon { color: var(--ocean); font-size: 16px; }
.ticketing-bookings .queue-filters input, .ticketing-bookings .queue-filters select { min-width: 0; min-height: 46px; background-color: var(--surface); border-radius: 10px; font-size: 13px; }
.ticketing-bookings .queue-filters input::placeholder { font-size: 12px; }
.ticketing-bookings .reservation-tools { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin: 12px 0; }
.ticketing-bookings .reservation-tools > span { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 11px; }
.ticketing-bookings .reservation-tools ion-icon { color: var(--ocean); font-size: 14px; flex: none; }
.ticketing-bookings .reservation-tools button { min-height: 40px; padding: 7px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--light-blue); color: var(--ocean); font: inherit; font-size: 11px; }
.ticketing-bookings .queue-result-count { margin: 16px 0 12px; font-size: 12px; }
.ticketing-bookings .queue-list { gap: 12px; }
.ticketing-bookings .queue-item { display: grid; grid-template-columns: 40px minmax(0, 1fr) minmax(180px, .32fr); align-items: start; gap: 10px 14px; padding: 18px; border-radius: 14px; background: var(--surface-soft); }
.ticketing-bookings .person-avatar { grid-column: 1; grid-row: 1 / 3; width: 40px; height: 40px; border-radius: 11px; font-size: 12px; }
.ticketing-bookings .queue-person { grid-column: 2; grid-row: 1 / 3; min-width: 0; }
.ticketing-bookings .queue-person > strong { display: block; font-size: 14px; line-height: 1.6; }
.ticketing-bookings .queue-person .queue-reference { display: block; margin: 3px 0 8px; font-size: 10px; color: var(--muted); }
.ticketing-bookings .queue-person .queue-route { margin-top: 6px; font-size: 13px; line-height: 1.7; color: var(--ink); }
.ticketing-bookings .queue-person .queue-departure { display: flex; align-items: center; gap: 6px; font-size: 11px; line-height: 1.7; margin-top: 6px; }
.ticketing-bookings .queue-departure ion-icon { color: var(--ocean); flex: none; font-size: 14px; }
.ticketing-bookings .dashboard-queue-facts { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; margin: 10px 0 8px; }
.ticketing-bookings .dashboard-queue-facts span { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; }
.ticketing-bookings .dashboard-queue-facts strong { font-size: 15px; color: var(--ink); }
.ticketing-bookings .queue-person .reservation-channel { display: inline-block; margin: 0; padding: 3px 6px; border: 1px solid var(--line); border-radius: 5px; background: var(--surface); font-size: 10px; color: var(--muted); }
.ticketing-bookings .queue-person .queue-payment { margin: 7px 0 0; font-size: 11px; line-height: 1.7; }
.ticketing-bookings .queue-person .queue-payment strong { font-size: inherit; }
.ticketing-bookings .queue-item .status { grid-column: 3; grid-row: 1; display: inline-flex; align-items: center; gap: 5px; justify-self: end; max-width: 100%; text-transform: none; white-space: normal; text-align: left; border-radius: 7px; padding: 6px 9px; font-size: 11px; line-height: 1.6; }
.ticketing-bookings .queue-item .status ion-icon { flex: none; font-size: 14px; }
.ticketing-bookings .queue-item .status.awaiting-staff { color: #8a5100; background: #fff0d5; }
.ticketing-bookings .queue-update { grid-column: 3; grid-row: 2; display: inline-flex; justify-self: end; align-items: center; justify-content: center; gap: 7px; width: auto; max-width: 100%; min-width: 0; min-height: 44px; padding: 10px 12px; margin: 0; white-space: normal; background: var(--light-blue); color: var(--ocean); border-radius: 9px; font-size: 12px; }
.ticketing-bookings .queue-update ion-icon { font-size: 16px; flex: none; }
.ticketing-bookings .reservation-empty { display: grid; justify-items: center; text-align: center; padding: 36px 20px; background: var(--surface-soft); border: 1px dashed var(--line); border-radius: 14px; }
.ticketing-bookings .reservation-empty > ion-icon { padding: 12px; border-radius: 14px; background: var(--light-blue); color: var(--ocean); font-size: 28px; }
.ticketing-bookings .reservation-empty h3 { font-size: 18px; margin: 16px 0 8px; }
.ticketing-bookings .reservation-empty p { margin: 0; max-width: 360px; font-size: 12px; line-height: 1.8; color: var(--muted); }
.ticketing-bookings .reservation-empty button { min-height: 44px; margin-top: 16px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 9px; background: var(--light-blue); color: var(--ocean); font: inherit; font-size: 12px; }
.ticketing-bookings :deep(.workspace-pagination) { margin-top: 18px; padding: 18px 0 0; gap: 12px; background: transparent; }
.ticketing-bookings :deep(.pagination-controls) { gap: 10px; }
.ticketing-bookings :deep(.workspace-pagination button) { min-height: 44px; border-radius: 9px; }
.ticketing-bookings button:focus-visible, .ticketing-bookings input:focus-visible, .ticketing-bookings select:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
.ticketing-bookings .reservation-tools button:disabled { opacity: .5; }
@media (max-width: 1000px) {
  .ticketing-bookings .queue-filters { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 600px) {
  .ticketing-bookings .queue-panel { padding: 16px; }
  .ticketing-bookings .queue-filters { padding: 14px; gap: 14px; }
  .ticketing-bookings .reservation-tools { flex-wrap: wrap; }
  .ticketing-bookings .queue-item { grid-template-columns: 34px minmax(0, 1fr); gap: 10px; padding: 14px; }
  .ticketing-bookings .person-avatar { grid-row: 1; width: 34px; height: 34px; }
  .ticketing-bookings .queue-person { grid-row: 1; }
  .ticketing-bookings .queue-item .status { grid-column: 2; grid-row: 2; justify-self: start; }
  .ticketing-bookings .queue-update { grid-column: 2; grid-row: 3; width: 100%; justify-self: stretch; }
  .ticketing-bookings :deep(.pagination-controls) { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; width: 100%; }
  .ticketing-bookings :deep(.workspace-pagination button) { padding: 9px 10px; font-size: 11px; }
  .ticketing-bookings :deep(.pagination-position) { text-align: center; font-size: 10px; }
}
</style>

<style scoped>
/* Dense reservation rows keep names and payment actions easy to scan. */
.ticketing-workspace .queue-list { gap: 6px; }
.ticketing-workspace .queue-item { grid-template-columns: 30px minmax(0, 1fr) auto; align-items: center; padding: 10px 12px; gap: 4px 10px; border-radius: 9px; }
.ticketing-workspace .person-avatar { width: 30px; height: 30px; border-radius: 8px; font-size: 10px; grid-row: 1 / 3; }
.ticketing-workspace .queue-person { display: flex; flex-wrap: wrap; align-items: center; gap: 3px 10px; grid-row: 1 / 3; }
.ticketing-workspace .queue-person > strong { display: inline; font-size: 13px; line-height: 1.5; }
.ticketing-workspace .queue-person .queue-reference { display: inline; margin: 0; font-size: 10px; overflow-wrap: anywhere; }
.ticketing-workspace .queue-person .queue-route { flex-basis: 100%; margin: 0; font-size: 12px; line-height: 1.5; }
.ticketing-workspace .queue-person .queue-departure { display: inline-flex; margin: 0; font-size: 10px; line-height: 1.5; }
.ticketing-workspace .dashboard-queue-facts { display: inline-flex; margin: 0; gap: 8px; }
.ticketing-workspace .dashboard-queue-facts span { font-size: 10px; }
.ticketing-workspace .dashboard-queue-facts strong { font-size: 12px; }
.ticketing-workspace .queue-person .queue-payment { margin: 0; font-size: 10px; line-height: 1.5; }
.ticketing-workspace .queue-person .reservation-channel { padding: 0; border: 0; background: transparent; font-size: 10px; }
.ticketing-workspace .queue-item .status { grid-column: 3; grid-row: 1; font-size: 10px; padding: 3px 7px; line-height: 1.5; max-width: 170px; }
.ticketing-workspace .queue-update { grid-column: 3; grid-row: 2; min-height: 36px; padding: 6px 9px; font-size: 11px; }
.ticketing-dashboard .metric-grid article { padding: 12px 14px; gap: 10px; border-radius: 12px; }
.ticketing-dashboard .metric-grid strong { font-size: 26px; margin: 2px 0; }
.ticketing-dashboard .metric-grid em { line-height: 1.4; }
.ticketing-workspace .queue-panel { padding: 18px; }
.ticketing-bookings .queue-filters { padding: 12px; gap: 12px; }
@media (max-width: 600px) {
 .ticketing-workspace .queue-panel { padding: 12px; }
 .ticketing-workspace .queue-item { grid-template-columns: 26px minmax(0, 1fr); padding: 10px; gap: 6px 8px; }
 .ticketing-workspace .person-avatar { width: 26px; height: 26px; grid-row: 1; align-self: start; }
 .ticketing-workspace .queue-person { grid-row: 1; gap: 3px 8px; }
 .ticketing-workspace .queue-item .status { grid-column: 2; grid-row: 2; justify-self: start; max-width: 100%; }
 .ticketing-workspace .queue-update { grid-column: 2; grid-row: 3; width: auto; min-height: 44px; justify-self: start; }
 .ticketing-dashboard .metric-grid article { padding: 10px; gap: 5px; }
}
</style>
