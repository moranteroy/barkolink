<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <main class="walk-in-page">
        <header class="page-header">
          <div class="header-left">
            <router-link
              class="back-link"
              to="/staff/ticketing"
              aria-label="Back to ticketing"
              ><ion-icon :icon="arrowBackOutline" /></router-link
            ><BrandMark />
          </div>
          <div class="header-right">
            <span class="staff-label"
              ><ion-icon :icon="ticketOutline" /> Ticketing desk</span
            ><router-link class="queue-link" to="/staff/ticketing#queue"
              >Booking queue <ion-icon :icon="chevronForwardOutline"
            /></router-link>
          </div>
        </header>

        <section class="page-intro">
          <div>
            <p class="eyebrow">STAFF TICKETING / COUNTER SALE</p>
            <h1>{{ issued ? "Ticket issued" : "Walk-in ticket" }}</h1>
            <p>
              {{
                issued
                  ? "The booking is paid and the passenger ticket is ready to print."
                  : "Issue a ticket for a passenger without a BarkoLink account."
              }}
            </p>
          </div>
          <span v-if="!issued" class="intro-icon"
            ><ion-icon :icon="ticketOutline"
          /></span>
        </section>

        <div v-if="issued" class="receipt" aria-live="polite">
          <div class="receipt-top">
            <span class="success-icon"
              ><ion-icon :icon="checkmarkCircleOutline"
            /></span>
            <div>
              <p class="eyebrow">COUNTER SALE COMPLETE</p>
              <h2>Payment recorded. Ticket ready.</h2>
              <span>Give this receipt to the passenger for boarding.</span>
            </div>
          </div>
          <div class="receipt-body">
            <div class="receipt-route">
              <span class="route-icon"><ion-icon :icon="boatOutline" /></span>
              <div>
                <small>SAILING</small
                ><strong
                  >{{ issued.from }} <ion-icon :icon="arrowForwardOutline" />
                  {{ issued.to }}</strong
                ><span>{{ issued.departure }}</span>
              </div>
            </div>
            <dl class="receipt-grid">
              <div>
                <dt>Passenger</dt>
                <dd>{{ issued.name }}</dd>
              </div>
              <div>
                <dt>Cash paid</dt>
                <dd>PHP {{ issued.fare.toLocaleString() }}</dd>
              </div>
              <div>
                <dt>Booking reference</dt>
                <dd class="code">{{ issued.reference }}</dd>
              </div>
              <div>
                <dt>Ticket code</dt>
                <dd class="code">{{ issued.ticketCode }}</dd>
              </div>
            </dl>
            <p class="receipt-note">
              <ion-icon :icon="informationCircleOutline" /> Show this receipt
              and a valid ID to boarding staff.
            </p>
          </div>
          <div class="receipt-actions">
            <button type="button" class="print-button" @click="printReceipt">
              <ion-icon :icon="printOutline" /> Print receipt</button
            ><button type="button" class="secondary-button" @click="newTicket">
              Issue another ticket</button
            ><router-link to="/staff/ticketing#queue"
              >Back to booking queue</router-link
            >
          </div>
        </div>

        <template v-else>
          <div class="flow-strip" aria-label="Walk-in ticket steps">
            <span><b>1</b> Select sailing</span><i></i
            ><span><b>2</b> Passenger details</span><i></i
            ><span><b>3</b> Collect cash</span>
          </div>
          <div class="walk-in-layout">
            <div v-if="pendingSale" role="status" class="summary-card" style="grid-column: 1 / -1">
              <strong>Unresolved sale: {{ pendingSale.args.reference }}</strong>
              <p>{{ pendingSale.receipt.name }} · {{ pendingSale.receipt.from }} to {{ pendingSale.receipt.to }} · PHP {{ pendingSale.receipt.fare.toLocaleString() }}</p>
              <p>Check or retry this same sale before starting another. Do not collect cash again.</p>
              <button type="button" :disabled="busy" @click="retrySale">{{ busy ? 'Checking sale...' : 'Check / retry sale' }}</button>
              <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
            </div>
            <form
              id="walk-in-form"
              class="form-card"
              @submit.prevent="prepareTicket"
            >
              <fieldset :disabled="busy || !!pendingSale" style="display: contents">
              <div class="form-section">
                <div class="card-heading">
                  <span class="step-number"
                    ><ion-icon :icon="boatOutline"
                  /></span>
                  <div>
                    <small>STEP 01</small>
                    <h2>Choose a sailing</h2>
                    <p>Select an upcoming trip with available seats.</p>
                  </div>
                </div>
                <label class="field"
                  >Sailing<select v-model="form.sailingCode" required>
                    <option value="" disabled>
                      {{
                        loadingSailings
                          ? "Loading sailings…"
                          : "Select a sailing"
                      }}
                    </option>
                    <option
                      v-for="sailing in sailings"
                      :key="sailing.code"
                      :value="sailing.code"
                    >
                      {{ sailing.origin.name }} →
                      {{ sailing.destination.name }} ·
                      {{ formatDeparture(sailing.departureAt) }} ·
                      {{ sailing.availableSeats }} seats
                    </option>
                  </select></label
                >
                <p
                  v-if="!loadingSailings && !sailings.length && !errorMessage"
                  class="empty-sailings"
                >
                  No upcoming sailings with available seats.
                </p>
                <AccommodationPicker
                  v-model="form.accommodationId"
                  :options="selectedSailing?.accommodations || []"
                  :passenger-count="1"
                />
                <div v-if="selectedSailing" class="selected-sailing">
                  <ion-icon :icon="checkmarkCircleOutline" />
                  <div>
                    <strong
                      >{{ selectedSailing.origin.name }} to
                      {{ selectedSailing.destination.name }}</strong
                    ><span
                      >{{ formatDeparture(selectedSailing.departureAt) }} ·
                      {{ selectedSailing.availableSeats }} seats available</span
                    >
                  </div>
                </div>
              </div>

              <div class="form-section passenger-section">
                <div class="card-heading">
                  <span class="step-number"
                    ><ion-icon :icon="personOutline"
                  /></span>
                  <div>
                    <small>STEP 02</small>
                    <h2>Passenger details</h2>
                    <p>
                      Copy the details from the passenger's ID. No account is
                      required.
                    </p>
                  </div>
                </div>
                <div class="form-grid">
                  <label class="field full"
                    >Full name<input
                      v-model.trim="form.passengerName"
                      maxlength="120"
                      autocomplete="off"
                      placeholder="Name as shown on ID"
                      required
                  /></label>
                  <label class="field"
                    >Date of birth<input
                      v-model="form.birthDate"
                      type="date"
                      :max="today"
                      required
                  /></label>
                  <label class="field"
                    >Sex<select v-model="form.sex" required>
                      <option value="" disabled>Select sex</option>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Prefer not to say</option>
                    </select></label
                  >
                  <label class="field"
                    >Mobile number <span class="optional">optional</span
                    ><input
                      v-model.trim="form.passengerPhone"
                      maxlength="30"
                      type="tel"
                      autocomplete="off"
                      placeholder="09XX XXX XXXX"
                  /></label>
                  <label class="field"
                    >Nationality<input
                      v-model.trim="form.nationality"
                      maxlength="80"
                      autocomplete="off"
                      placeholder="Filipino"
                      required
                  /></label>
                  <label class="field full"
                    >Fare type<select v-model="form.passengerType">
                      <option value="REGULAR">Regular</option>
                      <option
                        v-for="discount in selectedSailing
                          ? passengerDiscountChoices(selectedSailing)
                          : []"
                        :key="discount.id"
                        :value="discount.name"
                      >
                        {{ discount.name }} ({{ discount.percentage }}% off)
                      </option>
                    </select></label
                  >
                </div>
              </div>

              <div v-if="needsDiscountVerification" class="form-section">
                <label
                  ><input v-model="form.discountVerified" type="checkbox" /> I
                  checked this passenger's discount eligibility.</label
                ><label class="field"
                  >Verification note<input
                    v-model.trim="form.verificationNote"
                    minlength="3"
                    maxlength="160"
                    placeholder="Supporting ID checked; do not copy ID numbers"
                    required
                /></label>
              </div>
              <div class="form-footer">
                <p v-if="errorMessage" class="error" role="alert">
                  {{ errorMessage }}
                </p>
                <button
                  class="issue-button"
                  type="submit"
                  :disabled="
                    busy || !selectedSailing || !form.passengerName.trim()
                  "
                >
                  <ion-icon :icon="cashOutline" />
                  {{ busy ? "Issuing ticket…" : "Review cash payment" }}
                  <ion-icon :icon="arrowForwardOutline" /></button
                ><span>Ticket is issued only after you confirm payment.</span>
              </div>
              </fieldset>
            </form>

            <aside class="summary-card glass-panel">
              <div class="summary-heading">
                <span class="summary-icon"
                  ><ion-icon :icon="receiptOutline"
                /></span>
                <div>
                  <p class="eyebrow">COUNTER SUMMARY</p>
                  <h2>Fare summary</h2>
                </div>
              </div>
              <div class="summary-route">
                <small>SAILING</small
                ><strong>{{
                  selectedSailing
                    ? `${selectedSailing.origin.name} → ${selectedSailing.destination.name}`
                    : "No sailing selected"
                }}</strong
                ><span>{{
                  selectedSailing
                    ? formatDeparture(selectedSailing.departureAt)
                    : "Choose a trip to see the fare."
                }}</span>
              </div>
              <div class="summary-row">
                <span>Passenger</span
                ><strong>{{ form.passengerName || "—" }}</strong>
              </div>
              <div class="summary-row">
                <span>Fare type</span><strong>{{ fareLabel }}</strong>
              </div>
              <div class="summary-row">
                <span>Passenger fare</span
                ><strong>PHP {{ fare.toLocaleString() }}</strong>
              </div>
              <div class="summary-row">
                <span
                  >Accommodation:
                  {{ selectedAccommodation?.name || "Standard" }}</span
                ><strong>PHP {{ accommodationFee.toLocaleString() }}</strong>
              </div>
              <div class="summary-total">
                <span>Cash to collect</span
                ><strong>PHP {{ payable.toLocaleString() }}</strong>
              </div>
              <p class="summary-note">
                <ion-icon :icon="informationCircleOutline" /> Confirm the cash
                amount before issuing the ticket.
              </p>
            </aside>
          </div>
        </template>

        <DialogRoot v-model:open="confirming">
          <DialogOverlay class="confirmation-overlay">
          <DialogContent
            class="confirmation-card"
            @close-auto-focus="restoreConfirmationFocus"
          >
            <span class="confirm-icon"><ion-icon :icon="cashOutline" /></span>
            <p class="eyebrow">FINAL CHECK</p>
            <DialogTitle as-child><h2>Confirm cash payment</h2></DialogTitle>
            <DialogDescription as-child><p>
              Have you received
              <strong>PHP {{ payable.toLocaleString() }}</strong> from
              <strong>{{ form.passengerName }}</strong
              >?
            </p></DialogDescription>
            <div class="confirm-details">
              <span
                >{{ selectedSailing?.origin.name }} to
                {{ selectedSailing?.destination.name }}</span
              ><strong>{{
                selectedSailing
                  ? formatDeparture(selectedSailing.departureAt)
                  : ""
              }}</strong>
            </div>
            <div class="confirm-actions">
              <button
                type="button"
                class="secondary-button"
                @click="confirming = false"
              >
                Go back</button
              ><button
                type="button"
                class="issue-button"
                :disabled="busy"
                @click="issueTicket"
              >
                {{ busy ? "Issuing ticket…" : "Cash received — issue ticket" }}
              </button>
            </div>
          </DialogContent>
          </DialogOverlay>
        </DialogRoot>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  passengerFare,
  passengerTypeCode,
  passengerDiscountChoices,
  type CustomDiscountFare,
} from "../../../data/fareSettings";
import AccommodationPicker from "../../../components/shared/AccommodationPicker.vue";
import type { Accommodation } from "../../../services/database/workspaces";
import { databaseRequestError } from "../../../data/databaseErrors";
import { computed, reactive, ref, watch } from "vue";
import { philippineDateKey, validBirthDate } from "../../../data/travelDate";
import { DialogRoot, DialogOverlay, DialogContent, DialogTitle, DialogDescription } from "reka-ui";
import { IonContent, IonIcon, IonPage, onIonViewWillEnter } from "@ionic/vue";
import {
  arrowBackOutline,
  arrowForwardOutline,
  boatOutline,
  cashOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  informationCircleOutline,
  personOutline,
  printOutline,
  receiptOutline,
  ticketOutline,
} from "ionicons/icons";
import BrandMark from "../../../components/shared/BrandMark.vue";
import {
  ticketingCreateGuestWalkIn,
  ticketingSailings,
  staffBookings,
  type TicketingCreateGuestWalkInVariables,
} from "../../../services/database/staff";
import { auth, staffDatabase } from "../../../services/session";

type Sailing = {
  passengerDiscounts?: CustomDiscountFare[] | null;
  customDiscounts?: CustomDiscountFare[];
  accommodations?: Accommodation[];
  code: string;
  departureAt: string;
  availableSeats: number;
  regularFare: number;
  studentFare: number;
  seniorFare: number;
  childFare: number;
  pwdFare: number;
  pregnantFare?: number;
  origin: { name: string };
  destination: { name: string };
};
type Receipt = {
  reference: string;
  name: string;
  from: string;
  to: string;
  departure: string;
  fare: number;
  ticketCode: string;
};
const sailings = ref<Sailing[]>([]);
const form = reactive({
  accommodationId: "",
  sailingCode: "",
  passengerName: "",
  birthDate: "",
  sex: "",
  passengerPhone: "",
  nationality: "Filipino",
  passengerType: "REGULAR",
  discountVerified: false,
  verificationNote: "",
});
const today = computed(() => philippineDateKey());
const busy = ref(false);
const confirming = ref(false);
let confirmationReturnFocus: HTMLElement | null = null;
function restoreConfirmationFocus(event: Event) {
  event.preventDefault();
  confirmationReturnFocus?.focus();
}
const loadingSailings = ref(false);
const errorMessage = ref("");
const issued = ref<Receipt | null>(null);
type SaleIntent = { ownerUid: string; args: TicketingCreateGuestWalkInVariables; receipt: Receipt };
const saleKey = "barkolink-pending-walk-in";
const pendingSale = ref<SaleIntent | null>(null);
try {
  const saved = JSON.parse(sessionStorage.getItem(saleKey) || "null");
  if (saved?.ownerUid === auth?.currentUser?.uid && saved.args?.reference && saved.receipt) pendingSale.value = saved;
} catch { sessionStorage.removeItem(saleKey); }
async function retrySale() {
  if (!staffDatabase || busy.value || !pendingSale.value) return;
  const intent = pendingSale.value;
  busy.value = true;
  errorMessage.value = "";
  const recover = async () => {
    const saved = (await staffBookings(staffDatabase!, { search: intent.args.reference, pageSize: 100 })).data.bookings.find(b => b.reference === intent.args.reference && b.status === "CONFIRMED" && b.paymentStatus === "PAID");
    if (!saved) return false;
    issued.value = { ...intent.receipt, fare: saved.total };
    return true;
  };
  try {
    if (!(await recover())) {
      await ticketingCreateGuestWalkIn(staffDatabase, intent.args);
      issued.value = intent.receipt;
      try { await recover(); } catch { /* The successful mutation already confirmed issuance. */ }
    }
    pendingSale.value = null;
    sessionStorage.removeItem(saleKey);
  } catch (error) {
    try {
      if (await recover()) { pendingSale.value = null; sessionStorage.removeItem(saleKey); return; }
    } catch { /* Keep the original intent while the result is uncertain. */ }
    errorMessage.value = `${databaseRequestError(error, "Could not confirm this sale.")} Retry this same sale when the connection is restored. Do not collect cash again.`;
  } finally { busy.value = false; }
}
const selectedSailing = computed(() =>
  sailings.value.find((item) => item.code === form.sailingCode),
);
const selectedAccommodation = computed(() =>
  selectedSailing.value?.accommodations?.find(
    (a) => a.id === form.accommodationId,
  ),
);
const accommodationFee = computed(
  () => selectedAccommodation.value?.surcharge || 0,
);
const payable = computed(() => fare.value + accommodationFee.value);
watch(
  () => form.sailingCode,
  () => {
    form.accommodationId = "";
    form.discountVerified = false;
    form.verificationNote = "";
  },
);
watch(
  () => form.passengerType,
  () => {
    form.discountVerified = false;
    form.verificationNote = "";
  },
);
watch(selectedSailing, (sailing) => {
  if (sailing && passengerFare(sailing, form.passengerType) <= 0)
    form.passengerType = "REGULAR";
});
const fareLabel = computed(
  () =>
    ({
      REGULAR: "Regular",
      STUDENT: "Student",
      SENIOR: "Senior citizen",
      CHILD: "Child",
      PWD: "PWD",
      PREGNANT: "Pregnant",
    })[
      form.passengerType as
        | "REGULAR"
        | "STUDENT"
        | "SENIOR"
        | "CHILD"
        | "PWD"
        | "PREGNANT"
    ] || form.passengerType,
);
const fare = computed(() => {
  const sailing = selectedSailing.value;
  if (!sailing) return 0;
  return passengerFare(sailing, form.passengerType);
});
const needsDiscountVerification = computed(
  () =>
    !!selectedSailing.value && fare.value < selectedSailing.value.regularFare,
);
const formatDeparture = (value: string) =>
  new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });

async function loadSailings() {
  if (!staffDatabase) {
    errorMessage.value = "Ticketing service is unavailable.";
    return;
  }
  loadingSailings.value = true;
  errorMessage.value = "";
  try {
    const result = await ticketingSailings(staffDatabase, {
      fetchPolicy: "SERVER_ONLY",
    });
    sailings.value = result.data.sailings;
  } catch (error) {
    errorMessage.value = databaseRequestError(
      error,
      "Could not load sailings.",
    );
  } finally {
    loadingSailings.value = false;
  }
}
onIonViewWillEnter(() => {
  void loadSailings();
});

function prepareTicket() {
  if (
    !selectedSailing.value ||
    !form.passengerName.trim() ||
    !form.birthDate ||
    !form.sex ||
    !form.nationality.trim() ||
    busy.value
  )
    return;
  if (fare.value <= 0) {
    errorMessage.value = "Choose an available passenger type.";
    return;
  }
  if (!validBirthDate(form.birthDate)) {
    errorMessage.value = "Enter a valid date of birth that is not in the future.";
    return;
  }
  if (
    needsDiscountVerification.value &&
    (!form.discountVerified || form.verificationNote.trim().length < 3)
  ) {
    errorMessage.value =
      "Verify the discount eligibility and add a note before collecting cash.";
    return;
  }
  errorMessage.value = "";
  confirmationReturnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement : null;
  confirming.value = true;
}
async function issueTicket() {
  if (pendingSale.value) { await retrySale(); return; }
  const sailing = selectedSailing.value;
  if (
    !staffDatabase ||
    !sailing ||
    !form.passengerName.trim() ||
    !form.birthDate ||
    !form.sex ||
    !form.nationality.trim() ||
    busy.value
  )
    return;
  confirming.value = false;
  busy.value = true;
  errorMessage.value = "";
  const reference = `BL-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const guestUid = `walkin:${crypto.randomUUID()}`;
  const ticketCode = crypto.randomUUID();
  try {
    const args: TicketingCreateGuestWalkInVariables = {
      sailingCode: sailing.code,
      accommodationId: form.accommodationId || undefined,
      guestUid,
      guestEmail: `${guestUid.slice(7)}@walkin.barkolink.invalid`,
      reference,
      ticketCode,
      passengerName: form.passengerName.trim(),
      passengerPhone: form.passengerPhone.trim() || null,
      birthDate: form.birthDate,
      sex: form.sex,
      nationality: form.nationality.trim(),
      passengerType: passengerTypeCode(form.passengerType),
      method: "CASH",
      discountVerified: form.discountVerified,
      verificationNote: form.verificationNote.trim(),
    };
    const receipt: Receipt = {
      reference,
      name: form.passengerName.trim(),
      from: sailing.origin.name,
      to: sailing.destination.name,
      departure: formatDeparture(sailing.departureAt),
      fare: payable.value,
      ticketCode,
    };
    pendingSale.value = { ownerUid: auth?.currentUser?.uid || "", args, receipt };
    sessionStorage.setItem(saleKey, JSON.stringify(pendingSale.value));
    busy.value = false;
    await retrySale();
  } catch (error) {
    errorMessage.value = databaseRequestError(
      error,
      "Could not issue the ticket.",
    );
  } finally {
    busy.value = false;
  }
}
function newTicket() {
  issued.value = null;
  form.passengerName = "";
  form.birthDate = "";
  form.sex = "";
  form.passengerPhone = "";
  form.nationality = "Filipino";
  form.passengerType = "REGULAR";
  form.discountVerified = false;
  form.verificationNote = "";
  errorMessage.value = "";
  void loadSailings();
}
function printReceipt() {
  window.print();
}
</script>

<style scoped>
.walk-in-page {
  max-width: 1180px;
  margin: 0 auto;
  padding: 26px 32px 80px;
  color: var(--ink);
}
.page-header,
.header-left,
.header-right {
  display: flex;
  align-items: center;
}
.page-header {
  justify-content: space-between;
  gap: 16px;
}
.header-left {
  gap: 14px;
}
.header-right {
  gap: 18px;
}
.back-link {
  display: grid;
  place-items: center;
  flex: none;
  width: 42px;
  height: 42px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: var(--surface);
  color: var(--ink);
  font-size: 20px;
}
.back-link:hover,
.queue-link:hover {
  color: var(--ocean);
}
.staff-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ocean);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.staff-label ion-icon {
  font-size: 14px;
}
.queue-link {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
  text-decoration: none;
}
.queue-link ion-icon {
  font-size: 14px;
}
.page-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin: 40px 0 23px;
}
.eyebrow {
  margin: 0;
  color: var(--ocean);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
}
.page-intro h1 {
  margin: 8px 0 6px;
  font-size: 34px;
  letter-spacing: -0.045em;
}
.page-intro p:last-child {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
.intro-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 58px;
  height: 58px;
  border-radius: 18px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 27px;
}
.flow-strip {
  display: flex;
  align-items: center;
  gap: 13px;
  margin-bottom: 20px;
  padding: 13px 17px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: var(--surface);
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
}
.flow-strip span {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.flow-strip b {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 10px;
}
.flow-strip i {
  width: 28px;
  height: 1px;
  background: var(--line);
}
.walk-in-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(285px, 0.9fr);
  gap: 20px;
  align-items: start;
}
.form-card,
.summary-card,
.receipt {
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: 0 12px 30px #102b4c0b;
}
.form-card {
  overflow: hidden;
}
.form-section {
  padding: 25px;
}
.passenger-section {
  border-top: 1px solid var(--line);
}
.card-heading {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  margin-bottom: 21px;
}
.step-number {
  display: grid;
  place-items: center;
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 20px;
}
.card-heading small {
  color: var(--ocean);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.09em;
}
.card-heading h2 {
  margin: 4px 0 3px;
  font-size: 19px;
  letter-spacing: -0.02em;
}
.card-heading p {
  margin: 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 17px 14px;
}
.form-grid .full {
  grid-column: 1/-1;
}
.field {
  display: block;
  min-width: 0;
  color: var(--ink);
  font-size: 11px;
  font-weight: 800;
}
.optional {
  color: var(--muted);
  font-weight: 500;
}
.field input,
.field select {
  display: block;
  width: 100%;
  height: 46px;
  margin-top: 8px;
  padding: 0 13px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
}
.field :is(input, select):focus {
  outline: 2px solid var(--ocean);
  outline-offset: 1px;
}
.field input::placeholder {
  color: var(--muted);
}
.empty-sailings {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 11px;
}
.selected-sailing {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 14px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--light-blue);
}
.selected-sailing > ion-icon {
  flex: none;
  margin-top: 1px;
  color: var(--ocean);
  font-size: 16px;
}
.selected-sailing strong,
.selected-sailing span {
  display: block;
}
.selected-sailing strong {
  font-size: 11px;
}
.selected-sailing span {
  margin-top: 4px;
  color: var(--muted);
  font-size: 10px;
}
.form-footer {
  display: grid;
  gap: 9px;
  padding: 22px 25px;
  border-top: 1px solid var(--line);
  background: var(--surface-soft);
}
.issue-button,
.print-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 46px;
  padding: 0 18px;
  border: 0;
  border-radius: 9px;
  background: var(--ocean);
  color: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.issue-button ion-icon,
.print-button ion-icon {
  font-size: 17px;
}
.issue-button ion-icon:last-child {
  margin-left: auto;
}
.issue-button:disabled {
  opacity: 0.55;
  cursor: default;
}
.form-footer > span {
  color: var(--muted);
  font-size: 10px;
  text-align: center;
}
.error {
  margin: 0;
  padding: 11px 12px;
  border-radius: 9px;
  background: #fff0ee;
  color: #a53e35;
  font-size: 11px;
}
.summary-card {
  position: sticky;
  top: 20px;
  overflow: hidden;
}
.summary-heading {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 21px 22px;
  border-bottom: 1px solid var(--line);
}
.summary-icon {
  display: grid;
  place-items: center;
  width: 39px;
  height: 39px;
  border-radius: 11px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 20px;
}
.summary-heading h2 {
  margin: 4px 0 0;
  font-size: 17px;
}
.summary-route {
  display: grid;
  gap: 6px;
  margin: 20px 22px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-soft);
}
.summary-route small {
  color: var(--ocean);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.summary-route strong {
  font-size: 13px;
}
.summary-route span {
  color: var(--muted);
  font-size: 11px;
}
.summary-row,
.summary-total {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 0 22px;
  padding: 11px 0;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 11px;
}
.summary-row strong {
  max-width: 55%;
  color: var(--ink);
  text-align: right;
  overflow-wrap: anywhere;
}
.summary-total {
  align-items: center;
  margin-top: 7px;
  border: 0;
  color: var(--ink);
  font-weight: 800;
}
.summary-total strong {
  color: var(--ocean);
  font-size: 21px;
}
.summary-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 15px 22px 22px;
  padding: 12px;
  border-radius: 9px;
  background: var(--light-blue);
  color: var(--muted);
  font-size: 10px;
  line-height: 1.45;
}
.summary-note ion-icon {
  flex: none;
  color: var(--ocean);
  font-size: 15px;
}
.receipt {
  max-width: 760px;
  margin: 0 auto;
  overflow: hidden;
}
.receipt-top {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 24px;
  background: var(--light-blue);
}
.success-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--surface);
  color: var(--ocean);
  font-size: 28px;
}
.receipt-top h2 {
  margin: 5px 0;
  font-size: 20px;
}
.receipt-top span:last-child {
  color: var(--muted);
  font-size: 11px;
}
.receipt-body {
  padding: 23px 25px;
}
.receipt-route {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--line);
}
.route-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 11px;
  background: var(--light-blue);
  color: var(--ocean);
}
.route-icon ion-icon {
  width: 24px;
  height: 24px;
}
.receipt-route small,
.receipt-grid dt {
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
}
.receipt-route strong,
.receipt-route > div > span {
  display: block;
}
.receipt-route strong {
  margin: 5px 0;
  font-size: 17px;
}
.receipt-route strong ion-icon {
  margin: 0 5px;
  color: var(--ocean);
  font-size: 13px;
}
.receipt-route > div > span {
  color: var(--muted);
  font-size: 11px;
}
.receipt-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin: 0;
  padding: 20px 0;
}
.receipt-grid dd {
  margin: 6px 0 0;
  font-size: 13px;
  font-weight: 800;
  overflow-wrap: anywhere;
}
.receipt-grid .code {
  color: var(--ocean);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}
.receipt-note {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  padding: 12px;
  border-radius: 9px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 11px;
}
.receipt-note ion-icon {
  color: var(--ocean);
  font-size: 16px;
}
.receipt-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 18px 25px;
  border-top: 1px solid var(--line);
}
.receipt-actions a,
.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
  color: var(--ocean);
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}
.confirmation-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 18px;
  background: #071629b8;
}
.confirmation-card {
  width: min(100%, 440px);
  padding: 26px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: 0 25px 70px #0004;
}
.confirm-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-bottom: 17px;
  border-radius: 13px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 25px;
}
.confirmation-card h2 {
  margin: 7px 0;
  font-size: 23px;
}
.confirmation-card > p:not(.eyebrow) {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.55;
}
.confirmation-card > p strong {
  color: var(--ink);
}
.confirm-details {
  display: grid;
  gap: 5px;
  margin: 20px 0;
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
  font-size: 11px;
}
.confirm-details strong {
  color: var(--muted);
  font-weight: 500;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.confirm-actions .issue-button {
  font-size: 11px;
}
.walk-in-page :is(button, a):focus-visible {
  outline: 2px solid var(--ocean);
  outline-offset: 3px;
}
@media (max-width: 780px) {
  .walk-in-page {
    padding: 20px 16px 60px;
  }
  .page-intro {
    margin: 32px 0 20px;
  }
  .walk-in-layout {
    grid-template-columns: 1fr;
  }
  .summary-card {
    position: static;
    order: 1;
  }
  .summary-route {
    margin-bottom: 12px;
  }
  .summary-note {
    margin-top: 12px;
  }
}
@media (max-width: 540px) {
  .staff-label,
  .intro-icon {
    display: none;
  }
  .header-right {
    gap: 0;
  }
  .queue-link {
    font-size: 10px;
  }
  .flow-strip {
    gap: 7px;
    padding: 10px;
    font-size: 9px;
  }
  .flow-strip i {
    width: 12px;
  }
  .flow-strip span {
    gap: 5px;
  }
  .flow-strip b {
    width: 18px;
    height: 18px;
  }
  .form-section {
    padding: 20px;
  }
  .form-grid {
    gap: 14px 10px;
  }
  .form-footer {
    padding: 18px 20px;
  }
  .receipt-grid {
    grid-template-columns: 1fr 1fr;
  }
  .receipt-actions .print-button {
    width: 100%;
  }
}
@media (max-width: 410px) {
  .page-header :deep(.brand-copy small) {
    display: none;
  }
  .page-intro h1 {
    font-size: 29px;
  }
  .flow-strip span {
    white-space: normal;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .form-grid .full {
    grid-column: auto;
  }
  .receipt-grid {
    grid-template-columns: 1fr;
  }
  .confirm-actions {
    flex-direction: column;
  }
  .confirm-actions button {
    width: 100%;
  }
}
@media print {
  .page-header,
  .page-intro,
  .flow-strip,
  .receipt-actions,
  .confirmation-overlay {
    display: none;
  }
  .walk-in-page {
    padding: 0;
  }
  .receipt {
    visibility: visible;
    position: absolute;
    inset: 0 auto auto 0;
    width: 100%;
    margin: 0;
    color: #103658;
    background: white;
    max-width: none;
    border: 0;
    box-shadow: none;
  }
  .receipt :deep(*) {
    visibility: visible;
    color: #103658;
  }
  .receipt-top,
  .receipt-body {
    background: white;
  }
  .receipt-body {
    padding: 18px 0;
  }
  .receipt-top {
    padding: 18px 0;
  }
}
</style>
