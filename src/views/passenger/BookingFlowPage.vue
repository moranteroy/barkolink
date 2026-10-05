<template>
  <ion-page
    ><ion-content
      :fullscreen="true"
      :class="{ 'passenger-content': flow === 'passengers' }"
      ><main
        class="booking-page"
        :class="{ 'passenger-info-page': flow === 'passengers' }"
      >
        <header class="booking-header glass-toolbar">
          <router-link
            to="/search"
            class="back-link"
            aria-label="Back to sailings"
            title="Back to sailings"
            ><ion-icon
              :icon="arrowBackOutline"
              aria-hidden="true" /></router-link
          ><BrandMark /><span class="secure">Secure reservation</span>
        </header>
        <nav class="progress" aria-label="Booking steps">
          <div
            v-for="(step, index) in steps"
            :key="step"
            :class="[
              'step',
              { active: index <= activeStep, current: index === activeStep },
            ]"
          >
            <span>{{ index + 1 }}</span
            ><b>{{ step }}</b>
          </div>
        </nav>

        <AdvisoryBanner :sailing-code="trip.id" />
        <section v-if="flow === 'details'" class="flow-layout details-flow">
          <div>
            <p class="kicker">TRIP DETAILS</p>
            <h1>{{ trip.from }} <span>to</span> {{ trip.to }}</h1>
            <p class="muted">
              {{ trip.date }} | {{ trip.passengerCount }} passenger{{
                trip.passengerCount === 1 ? "" : "s"
              }}
            </p>
            <article class="journey-card glass-panel">
              <div class="journey-time">
                <div>
                  <small>DEPARTURE</small><strong>{{ trip.departure }}</strong
                  ><span>{{ trip.originPortName || trip.from + " Port" }}</span>
                </div>
                <div class="journey-line">
                  <span class="route-mark"
                    ><ion-icon :icon="boatOutline" aria-hidden="true" /></span
                  ><i></i><b>{{ trip.duration }}</b
                  ><i></i><span>TRIP</span>
                </div>
                <div class="right">
                  <small>ARRIVAL</small><strong>{{ trip.arrival }}</strong
                  ><span>{{
                    trip.destinationPortName || trip.to + " Port"
                  }}</span>
                </div>
              </div>
              <div class="vessel-detail">
                <span class="boat-badge"
                  ><ion-icon :icon="boatOutline" aria-hidden="true"
                /></span>
                <div>
                  <strong>{{ trip.vessel }}</strong>
                  <p>Passenger ferry | Trip {{ trip.id }}</p>
                </div>
                <span class="available"
                  >{{ trip.available }} slots available</span
                >
              </div>
            </article>
            <AccommodationPicker
              v-model="accommodationId"
              :options="classOptions"
              :passenger-count="passengers.length"
            />
            <div class="info-grid">
              <article>
                <small>Duration</small><strong>{{ trip.duration }}</strong
                ><span>Direct crossing</span>
              </article>
              <article>
                <small>Available</small
                ><strong>{{ trip.available }} seats</strong
                ><span>Remaining on this sailing</span>
              </article>
              <article>
                <small>Ticket type</small><strong>Mobile e-ticket</strong
                ><span>Issued after payment at the terminal</span>
              </article>
            </div>
          </div>
          <aside class="flow-aside glass-panel">
            <p class="kicker">FARE ESTIMATE</p>
            <div class="fare-breakdown">
              <div class="fare-row">
                <span
                  >Passenger fares<small
                    >{{ passengers.length }} passenger{{
                      passengers.length === 1 ? "" : "s"
                    }}</small
                  ></span
                ><b>PHP {{ total.toLocaleString() }}</b>
              </div>
              <div class="fare-row">
                <span
                  >Accommodation<small>{{
                    selectedAccommodation?.name || "Standard"
                  }}</small></span
                ><b>PHP {{ serviceFee }}</b>
              </div>
            </div>
            <div class="total">
              <span
                >Estimated total<small
                  >Pay the fare at the ticketing desk</small
                ></span
              ><strong>PHP {{ (total + serviceFee).toLocaleString() }}</strong>
            </div>
            <ion-button
              expand="block"
              class="continue"
              :disabled="classOptions.length > 0 && !selectedAccommodation"
              @click="go('passengers')"
              >Continue to passengers</ion-button
            >
            <p class="hint">
              Your fare is based on passenger type. Review the details before
              confirming.
            </p>
          </aside>
          <PortLocationMap class="trip-port-map" :ports="tripPorts" />
        </section>

        <section
          v-else-if="flow === 'passengers'"
          class="flow-layout passenger-flow"
        >
          <div>
            <p class="kicker">PASSENGER INFORMATION</p>
            <h1>Who is sailing?</h1>
            <p class="muted">
              Enter each passenger name exactly as shown on their ID.
            </p>
            <form @submit.prevent="go('summary')">
              <article
                v-for="(person, index) in passengers"
                :key="person.id"
                class="passenger-card"
              >
                <div class="passenger-heading">
                  <strong>PASSENGER {{ index + 1 }}</strong
                  ><button
                    v-if="passengers.length > 1"
                    type="button"
                    class="remove"
                    @click="removePassenger(index)"
                  >
                    Remove
                  </button>
                </div>
                <SavedTravelerPicker
                  @select="
                    person.name = $event.fullName;
                    person.birthDate = $event.birthDate;
                    person.sex =
                      $event.sex === 'MALE'
                        ? 'Male'
                        : $event.sex === 'FEMALE'
                          ? 'Female'
                          : 'Prefer not to say';
                    person.phone = $event.phone;
                    person.nationality = $event.nationality;
                  "
                />
                <div class="form-grid">
                  <label
                    >Full name<input
                      v-model.trim="person.name"
                      required
                      autocomplete="name"
                      placeholder="Juan Dela Cruz" /></label
                  ><label
                    >Passenger type<select v-model="person.type">
                      <option>Regular</option>
                      <option
                        v-for="discount in selectedTrip
                          ? passengerDiscountChoices(selectedTrip)
                          : []"
                        :key="discount.id"
                        :value="discount.name"
                      >
                        {{ discount.name }} ({{ discount.percentage }}% off)
                      </option>
                    </select></label
                  ><label
                    >Date of birth<input
                      v-model="person.birthDate"
                      type="date"
                      required /></label
                  ><label
                    >Sex<select v-model="person.sex" required>
                      <option disabled value="">Select</option>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Prefer not to say</option>
                    </select></label
                  ><label
                    >Mobile number<input
                      v-model.trim="person.phone"
                      type="tel"
                      required
                      placeholder="09XX XXX XXXX" /></label
                  ><label
                    >Nationality<input
                      v-model.trim="person.nationality"
                      required
                      placeholder="Filipino"
                  /></label>
                </div>
              </article>
              <button
                class="add-passenger"
                type="button"
                :disabled="passengers.length >= maxPassengers"
                @click="addPassenger"
              >
                + Add passenger
              </button>
              <div class="passenger-actions">
                <router-link
                  to="/trip-details"
                  class="icon-back"
                  aria-label="Back to trip details"
                  title="Back to trip details"
                  ><ion-icon
                    :icon="arrowBackOutline"
                    aria-hidden="true" /></router-link
                ><ion-button class="continue" type="submit"
                  >Review booking</ion-button
                >
              </div>
            </form>
          </div>
          <aside class="flow-aside glass-panel sticky trip-summary">
            <p class="kicker">YOUR TRIP</p>
            <div class="trip-route">
              <strong>{{ trip.from }}</strong
              ><span>to</span><strong>{{ trip.to }}</strong>
            </div>
            <p class="trip-date">{{ trip.date }} | {{ trip.departure }}</p>
            <div class="trip-vessel">
              <span class="boat-badge"
                ><ion-icon :icon="boatOutline" aria-hidden="true"
              /></span>
              <div>
                <small>FERRY</small><strong>{{ trip.vessel }}</strong>
              </div>
            </div>
            <div class="total">
              <span>Passengers</span><strong>{{ passengers.length }}</strong>
            </div>
            <p class="hint">
              Discounts are subject to eligibility verification at ticketing.
              Pregnant fares follow the operator policy.
            </p>
          </aside>
        </section>

        <section
          v-else-if="flow === 'summary'"
          class="flow-layout summary-flow"
        >
          <div>
            <p class="kicker">REVIEW & CONFIRM</p>
            <h1>Ready to sail?</h1>
            <p class="muted">
              Check the trip and passenger details before placing your
              reservation.
            </p>
            <article class="summary-card glass-panel">
              <div class="summary-heading">
                <strong>Trip details</strong
                ><router-link to="/trip-details">Edit</router-link>
              </div>
              <div class="summary-route">
                <strong>{{ trip.from }}</strong
                ><span> to </span><strong>{{ trip.to }}</strong
                ><small
                  >{{ trip.date }} | {{ trip.departure }} |
                  {{ trip.vessel }}</small
                >
              </div>
              <div class="summary-heading">
                <strong>Passengers ({{ passengers.length }})</strong
                ><router-link to="/passenger-info">Edit</router-link>
              </div>
              <div
                v-for="(person, index) in passengers"
                :key="person.id"
                class="passenger-row"
              >
                <span class="initial">{{
                  initials(person.name || `Passenger ${index + 1}`)
                }}</span>
                <div>
                  <strong>{{ person.name || `Passenger ${index + 1}` }}</strong
                  ><small
                    >{{ person.type }} passenger<span v-if="person.phone">
                      | {{ person.phone }}</span
                    ><span v-else> | Contact details not added</span></small
                  >
                </div>
                <span class="checked">Done</span>
              </div>
            </article>
          </div>
          <aside class="flow-aside glass-panel">
            <p class="kicker">FARE SUMMARY</p>
            <div v-for="row in fareRows" :key="row.label" class="fare-row">
              <span>{{ row.label }}</span
              ><b>PHP {{ row.amount.toLocaleString() }}</b>
            </div>
            <div class="fare-row">
              <span
                >Accommodation:
                {{ selectedAccommodation?.name || "Standard" }}</span
              ><b>PHP {{ serviceFee }}</b>
            </div>
            <div class="total">
              <span>Total to pay</span
              ><strong>PHP {{ (total + serviceFee).toLocaleString() }}</strong>
            </div>
            <p v-if="errorMessage" class="form-message" role="alert">
              {{ errorMessage }}
            </p>
            <ion-button
              expand="block"
              class="continue"
              :disabled="saving"
              @click="confirm"
              >{{
                saving ? "Saving reservation…" : "Confirm reservation"
              }}</ion-button
            >
            <p class="hint">
              Your fare and seat allocation are saved with your reservation.
            </p>
          </aside>
        </section>

        <section v-else class="confirmed-page">
          <div class="success-icon" aria-hidden="true">
            <ion-icon :icon="checkmarkOutline" />
          </div>
          <p class="kicker">SEAT RESERVED</p>
          <h1>
            {{
              !booking.tripId
                ? "Checking your reservation"
                : ["CANCELLED", "EXPIRED"].includes(booking.status)
                  ? "Reservation " + booking.status.toLowerCase()
                  : booking.paymentStatus === "PAID"
                    ? "Payment recorded."
                    : "Pay at the ticketing desk."
            }}
          </h1>
          <p class="muted">
            {{
              !booking.tripId
                ? "Loading your booking from the reservation database."
                : ["CANCELLED", "EXPIRED"].includes(booking.status)
                  ? "This reservation is closed. View your bookings for details."
                  : booking.paymentStatus === "PAID"
                    ? "Your e-ticket is available in My bookings."
                    : "Show this booking reference at the ticketing desk and pay before the deadline to receive your e-ticket."
            }}
          </p>
          <p v-if="errorMessage" class="form-message" role="alert">
            {{ errorMessage }}
          </p>
          <div v-if="booking.reference" class="reference">
            <div>
              <small>BOOKING REFERENCE</small
              ><strong>{{ booking.reference }}</strong>
            </div>
            <button @click="copyReference">
              {{ copied ? "Copied" : "Copy" }}
            </button>
          </div>
          <article v-if="booking.tripId" class="confirmed-card glass-panel">
            <div>
              <small
                ><ion-icon :icon="locationOutline" aria-hidden="true" />
                ROUTE</small
              ><strong>{{ booking.from }} to {{ booking.to }}</strong>
            </div>
            <div>
              <small
                ><ion-icon :icon="calendarOutline" aria-hidden="true" />
                DEPARTURE</small
              ><strong>{{ booking.date }} | {{ booking.departure }}</strong>
            </div>
            <div>
              <small
                ><ion-icon :icon="boatOutline" aria-hidden="true" />
                VESSEL</small
              ><strong>{{ booking.vessel }}</strong>
            </div>
            <div>
              <small
                ><ion-icon :icon="peopleOutline" aria-hidden="true" />
                PASSENGERS</small
              ><strong
                >{{ booking.passengers.length }} passenger{{
                  booking.passengers.length === 1 ? "" : "s"
                }}</strong
              >
            </div>
          </article>
          <p
            v-if="
              booking.paymentDeadline &&
              booking.paymentStatus === 'UNPAID' &&
              ['PENDING', 'CONFIRMED'].includes(booking.status)
            "
            class="hint"
          >
            Pay before
            {{ new Date(booking.paymentDeadline).toLocaleString("en-PH") }}.
          </p>
          <div class="confirmation-actions">
            <ion-button
              v-if="booking.tripId"
              class="continue"
              :router-link="`/booking-details?reference=${encodeURIComponent(booking.reference)}`"
              >View reservation</ion-button
            ><ion-button fill="outline" router-link="/bookings"
              >My bookings</ion-button
            >
          </div>
        </section>
      </main></ion-content
    ></ion-page
  >
</template>

<script setup lang="ts">
import {
  passengerFare,
  passengerTypeCode,
  passengerDiscountChoices,
} from "../../data/fareSettings";
import AccommodationPicker from "../../components/shared/AccommodationPicker.vue";
import type { Accommodation } from "../../services/database/workspaces";
import AdvisoryBanner from "../../components/passenger/AdvisoryBanner.vue";
import SavedTravelerPicker from "../../components/passenger/SavedTravelerPicker.vue";
import { databaseRequestError } from "../../data/databaseErrors";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  onIonViewWillEnter,
} from "@ionic/vue";
import {
  arrowBackOutline,
  boatOutline,
  calendarOutline,
  checkmarkOutline,
  locationOutline,
  peopleOutline,
} from "ionicons/icons";
import PortLocationMap from "../../components/shared/PortLocationMap.vue";
import BrandMark from "../../components/shared/BrandMark.vue";
import {
  browseSailings,
  myBookings,
  reserveSailing1,
  reserveSailing2,
  reserveSailing3,
  reserveSailing4,
  reserveSailing5,
  reserveSailing6,
  reserveSailing7,
  reserveSailing8,
} from "../../services/database/passenger";
import { auth, database } from "../../services/session";

type Passenger = {
  id: string;
  name: string;
  type: string;
  birthDate: string;
  sex: string;
  phone: string;
  nationality: string;
};
type Booking = {
  paymentDeadline?: string | null;
  paymentStatus?: string;
  reference: string;
  from: string;
  to: string;
  date: string;
  departure: string;
  arrival: string;
  duration: string;
  vessel: string;
  tripId: string;
  passengers: Passenger[];
  total: number;
  status: string;
  createdAt: string;
  draftKey?: string;
};
const route = useRoute();
const router = useRouter();
const steps = ["Sailing", "Passengers", "Review", "Reserved"];
const flow = computed(() => String(route.name || "details"));
const activeStep = computed(() =>
  Math.max(
    0,
    ["details", "passengers", "summary", "confirmed"].indexOf(flow.value),
  ),
);
function readSelectedTrip() {
  try {
    return JSON.parse(
      localStorage.getItem("barkolink-selected-trip") || "null",
    );
  } catch {
    return null;
  }
}
const selectedTrip = ref(readSelectedTrip());
const trip = computed(() => {
  const selected = selectedTrip.value || {
    id: "",
    from: "",
    to: "",
    date: "",
    departure: "",
    arrival: "",
    vessel: "",
    available: 0,
    duration: "",
    regularFare: 0,
  };
  return { ...selected, passengerCount: passengers.value.length };
});
const tripPorts = computed(() =>
  [
    {
      id: "origin",
      name: trip.value.originPortName || `${trip.value.from} Port`,
      city: trip.value.from,
    },
    {
      id: "destination",
      name: trip.value.destinationPortName || `${trip.value.to} Port`,
      city: trip.value.to,
    },
  ].filter((port) => port.city),
);
const makePassenger = (): Passenger => ({
  id: crypto.randomUUID(),
  name: "",
  type: "Regular",
  birthDate: "",
  sex: "",
  phone: "",
  nationality: "Filipino",
});
const maxPassengers = computed(() =>
  Math.max(1, Math.min(8, Number(selectedTrip.value?.available) || 8)),
);
const passengerCount = Math.max(
  1,
  Math.min(
    maxPassengers.value,
    Number(selectedTrip.value?.passengerCount) ||
      Number(localStorage.getItem("barkolink-search-passengers")) ||
      2,
  ),
);
const draftStorageKey = "barkolink-booking-draft";
function readDraft(
  sailingCode: string,
  selectionId: string,
  fallbackCount: number,
): Passenger[] {
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftStorageKey) || "null");
    if (
      draft?.ownerUid === auth?.currentUser?.uid &&
      draft?.sailingCode === sailingCode &&
      draft?.selectionId === selectionId &&
      Array.isArray(draft.passengers) &&
      draft.passengers.length
    ) {
      return draft.passengers
        .slice(0, 8)
        .map((person: Partial<Passenger>) => ({
          ...makePassenger(),
          ...person,
          id: person.id || crypto.randomUUID(),
        }));
    }
  } catch {
    /* Discard an invalid local draft. */
  }
  return Array.from({ length: fallbackCount }, makePassenger);
}
const passengers = ref<Passenger[]>(
  readDraft(
    selectedTrip.value?.id || "",
    selectedTrip.value?.selectionId || "",
    passengerCount,
  ),
);
watch(
  passengers,
  (value) => {
    if (selectedTrip.value?.id && auth?.currentUser?.uid)
      sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          ownerUid: auth.currentUser.uid,
          sailingCode: selectedTrip.value.id,
          selectionId: selectedTrip.value.selectionId || "",
          passengers: value,
        }),
      );
  },
  { deep: true },
);
const fareFor = (type: string) =>
  selectedTrip.value ? passengerFare(selectedTrip.value, type) : 0;
const fareRows = computed(() =>
  passengers.value.map((p, i) => ({
    label: `${p.name || `Passenger ${i + 1}`} - ${p.type}`,
    amount: fareFor(p.type),
  })),
);
const total = computed(() =>
  fareRows.value.reduce((sum, row) => sum + row.amount, 0),
);
const classOptions = computed<Accommodation[]>(
  () => selectedTrip.value?.accommodations || [],
);
const accommodationId = computed({
  get: () => String(selectedTrip.value?.accommodationId || ""),
  set: (id: string) => {
    selectedTrip.value = { ...selectedTrip.value, accommodationId: id };
    localStorage.setItem(
      "barkolink-selected-trip",
      JSON.stringify(selectedTrip.value),
    );
    sessionStorage.removeItem(bookingIntentKey);
  },
});
const selectedAccommodation = computed(() =>
  classOptions.value.find((a) => a.id === accommodationId.value),
);
const serviceFee = computed(
  () =>
    Number(selectedAccommodation.value?.surcharge || 0) *
    passengers.value.length,
);
const booking = ref<Booking>({
  reference: "",
  from: "",
  to: "",
  date: "",
  departure: "",
  arrival: "",
  duration: "",
  vessel: "",
  tripId: "",
  passengers: [],
  total: 0,
  status: "PENDING",
  createdAt: "",
});
const copied = ref(false);
const saving = ref(false);
const errorMessage = ref("");
function addPassenger() {
  if (passengers.value.length < maxPassengers.value)
    passengers.value.push(makePassenger());
}
function removePassenger(index: number) {
  if (passengers.value.length > 1) passengers.value.splice(index, 1);
}
function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "P"
  );
}
function go(name: string) {
  if (
    name === "passengers" &&
    classOptions.value.length &&
    !selectedAccommodation.value
  ) {
    errorMessage.value = "Choose an accommodation to continue.";
    return;
  }
  router.push({ name });
}
const bookingIntentKey = "barkolink-booking-intent";
type BookingIntent = {
  ownerUid: string;
  sailingCode: string;
  selectionId: string;
  reference: string;
};
function readBookingIntent(): BookingIntent | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(bookingIntentKey) || "null",
    ) as BookingIntent | null;
    return value?.ownerUid === auth?.currentUser?.uid &&
      value?.sailingCode === trip.value.id &&
      value?.selectionId === (selectedTrip.value?.selectionId || "")
      ? value
      : null;
  } catch {
    return null;
  }
}
async function findExistingBooking(reference: string) {
  if (!database) return false;
  const result = await myBookings(database, { fetchPolicy: "SERVER_ONLY" });
  return result.data.bookings.some((item) => item.reference === reference);
}
function passengerSignature(people: Array<{ name: string; type: string }>) {
  return people
    .map(
      (person) =>
        `${person.name.trim().replace(/\s+/g, " ").toLowerCase()}|${passengerTypeCode(person.type)}`,
    )
    .sort()
    .join(";");
}
async function confirm() {
  if (saving.value) return;
  errorMessage.value = "";
  if (!selectedTrip.value?.id || !auth?.currentUser) {
    errorMessage.value = "Choose a sailing and sign in before confirming.";
    return;
  }
  if (
    passengers.value.some(
      (person) =>
        !person.name.trim() ||
        !person.birthDate ||
        !person.sex ||
        !person.phone.trim() ||
        !person.nationality.trim(),
    )
  ) {
    errorMessage.value = "Complete every passenger field before confirming.";
    return;
  }
  if (!database) {
    errorMessage.value =
      "Supabase is not configured. Add your Supabase project settings to .env.local.";
    return;
  }
  saving.value = true;
  const existingIntent = readBookingIntent();
  const reference =
    existingIntent?.reference ||
    `BL-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  try {
    const liveSailings = await browseSailings(database, {
      fetchPolicy: "SERVER_ONLY",
    });
    const live = liveSailings.data.sailings.find(
      (item) => item.code === trip.value.id,
    );
    if (!live || live.availableSeats < passengers.value.length)
      throw new Error(
        "This sailing no longer has enough seats. Search again to choose another sailing.",
      );
    const oldTotal = total.value + serviceFee.value;
    selectedTrip.value = {
      ...selectedTrip.value,
      accommodations: live.accommodations || [],
      passengerDiscounts: live.passengerDiscounts,
      customDiscounts: live.customDiscounts || [],
      regularFare: live.regularFare,
      studentFare: live.studentFare,
      seniorFare: live.seniorFare,
      childFare: live.childFare,
      pwdFare: live.pwdFare,
      pregnantFare: live.pregnantFare ?? live.regularFare,
      available: live.availableSeats,
    };
    localStorage.setItem(
      "barkolink-selected-trip",
      JSON.stringify(selectedTrip.value),
    );
    if (
      passengers.value.some((person) => passengerFare(live, person.type) <= 0)
    )
      throw new Error(
        "A selected discount is unavailable for this trip. Please choose another passenger type.",
      );
    if (classOptions.value.length && !selectedAccommodation.value)
      throw new Error(
        "Choose an accommodation on the trip details page before confirming.",
      );
    if (
      selectedAccommodation.value &&
      (selectedAccommodation.value.availableSeats ?? 0) <
        passengers.value.length
    )
      throw new Error(
        "The selected accommodation no longer has enough seats. Choose another class or sailing.",
      );
    if (total.value + serviceFee.value !== oldTotal) {
      errorMessage.value =
        "The fare changed. Review the updated total and confirm again.";
      return;
    }
    if (existingIntent) {
      try {
        if (await findExistingBooking(reference)) {
          await router.push({ name: "confirmed", query: { reference } });
          return;
        }
      } catch {
        /* Keep the same unique reference for a safe retry. */
      }
    } else {
      const result = await myBookings(database, { fetchPolicy: "SERVER_ONLY" });
      const requestedPassengers = passengerSignature(passengers.value);
      const duplicate = result.data.bookings.find(
        (item) =>
          ["PENDING", "CONFIRMED"].includes(item.status) &&
          item.sailing.code === trip.value.id &&
          (item.accommodationId || "") === accommodationId.value &&
          item.passengerCount === passengers.value.length &&
          passengerSignature(
            item.bookingPassengers_on_booking.map((person) => ({
              name: person.fullName,
              type: person.passengerType,
            })),
          ) === requestedPassengers,
      );
      if (duplicate) {
        await router.push({
          name: "confirmed",
          query: { reference: duplicate.reference },
        });
        return;
      }
    }
    sessionStorage.setItem(
      bookingIntentKey,
      JSON.stringify({
        ownerUid: auth.currentUser.uid,
        sailingCode: trip.value.id,
        selectionId: selectedTrip.value.selectionId || "",
        reference,
      }),
    );
    const variables: Record<string, unknown> = {
      sailingCode: trip.value.id,
      reference,
      accommodationId: accommodationId.value || undefined,
    };
    passengers.value.forEach((person, index) => {
      const n = index + 1;
      variables[`passenger${n}Name`] = person.name.trim();
      variables[`passenger${n}Type`] = passengerTypeCode(person.type);
      variables[`passenger${n}BirthDate`] = person.birthDate;
      variables[`passenger${n}Sex`] = person.sex;
      variables[`passenger${n}Phone`] = person.phone.trim();
      variables[`passenger${n}Nationality`] = person.nationality.trim();
    });
    const operations = [
      reserveSailing1,
      reserveSailing2,
      reserveSailing3,
      reserveSailing4,
      reserveSailing5,
      reserveSailing6,
      reserveSailing7,
      reserveSailing8,
    ];
    await (
      operations[passengers.value.length - 1] as unknown as (
        dc: typeof database,
        vars: Record<string, unknown>,
      ) => Promise<unknown>
    )(database, variables);
    booking.value = {
      reference,
      from: trip.value.from,
      to: trip.value.to,
      date: trip.value.date,
      departure: trip.value.departure,
      arrival: trip.value.arrival,
      duration: trip.value.duration,
      vessel: trip.value.vessel,
      tripId: trip.value.id,
      passengers: passengers.value.map((person) => ({ ...person })),
      total: total.value + serviceFee.value,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };
    sessionStorage.removeItem(draftStorageKey);
    await router.push({ name: "confirmed", query: { reference } });
  } catch (error) {
    try {
      if (await findExistingBooking(reference)) {
        await router.push({ name: "confirmed", query: { reference } });
        return;
      }
    } catch {
      /* The reservation may exist even when its status cannot be checked. */
    }
    errorMessage.value = `${databaseRequestError(error, "Could not complete the reservation.")} If you already confirmed, check My Bookings before trying again.`;
  } finally {
    saving.value = false;
  }
}
async function copyReference() {
  if (!booking.value) return;
  await navigator.clipboard?.writeText(booking.value.reference);
  copied.value = true;
  window.setTimeout(() => (copied.value = false), 1800);
}
async function loadConfirmedBooking() {
  const reference = String(route.query.reference || "");
  if (!reference || !database) {
    errorMessage.value = "No booking reference was provided.";
    return;
  }
  booking.value.reference = reference;
  try {
    const result = await myBookings(database, { fetchPolicy: "SERVER_ONLY" });
    const saved = result.data.bookings.find(
      (item) => item.reference === reference,
    );
    if (!saved)
      throw new Error(
        "This reservation was not found in your account. Check My Bookings or contact support with the reference above.",
      );
    booking.value = {
      reference: saved.reference,
      from: saved.sailing.origin.name,
      to: saved.sailing.destination.name,
      date: new Date(saved.sailing.departureAt).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      departure: new Date(saved.sailing.departureAt).toLocaleTimeString(
        "en-PH",
        { hour: "numeric", minute: "2-digit" },
      ),
      arrival: new Date(saved.sailing.arrivalAt).toLocaleTimeString("en-PH", {
        hour: "numeric",
        minute: "2-digit",
      }),
      duration: "",
      vessel: saved.sailing.vessel.name,
      tripId: saved.sailing.code,
      passengers: saved.bookingPassengers_on_booking.map((person) => ({
        id: person.id,
        name: person.fullName,
        type: person.passengerType,
        birthDate: "",
        sex: "",
        phone: "",
        nationality: "",
      })),
      paymentDeadline: saved.paymentDeadline,
      paymentStatus: saved.paymentStatus,
      total: saved.total,
      status: saved.status,
      createdAt: saved.createdAt,
    };
    errorMessage.value = "";
  } catch (error) {
    errorMessage.value = databaseRequestError(
      error,
      "Could not load your reservation. Open My Bookings to try again.",
    );
  }
}
onMounted(() => {
  if (!selectedTrip.value && flow.value !== "confirmed")
    router.replace("/search");
  if (flow.value === "confirmed") void loadConfirmedBooking();
});
onIonViewWillEnter(() => {
  if (flow.value === "confirmed") {
    if (booking.value.reference !== String(route.query.reference || ""))
      void loadConfirmedBooking();
    return;
  }
  const latestTrip = readSelectedTrip();
  if (!latestTrip?.id) {
    router.replace("/search");
    return;
  }
  if (
    selectedTrip.value?.id !== latestTrip.id ||
    selectedTrip.value?.selectionId !== latestTrip.selectionId
  ) {
    selectedTrip.value = latestTrip;
    const count = Math.max(
      1,
      Math.min(maxPassengers.value, Number(latestTrip.passengerCount) || 1),
    );
    passengers.value = readDraft(
      latestTrip.id,
      latestTrip.selectionId || "",
      count,
    );
  } else {
    selectedTrip.value = latestTrip;
    passengers.value = readDraft(
      latestTrip.id,
      latestTrip.selectionId || "",
      passengers.value.length,
    );
  }
});
watch(
  () => route.name,
  (name) => {
    if (name === "passengers" && passengers.value.length < 1)
      passengers.value.push(makePassenger());
  },
);
</script>

<style scoped>
.details-flow > .trip-port-map {
  grid-column: 1/-1;
  margin-top: 0;
  order: 3;
}
.booking-page {
  max-width: 1060px;
  margin: auto;
  padding: 28px 34px 72px;
  color: var(--ink);
}
.booking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.back-link {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: var(--surface);
  color: var(--ink);
  font-size: 19px;
  text-decoration: none;
}
.icon-back {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ocean);
  font-size: 19px;
  text-decoration: none;
}
.secure {
  color: #087b68;
  font-size: 11px;
  font-weight: 700;
}
.progress {
  display: flex;
  justify-content: center;
  gap: 0;
  margin: 44px auto 42px;
}
.step {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 74px;
  color: #a5afbb;
  font-size: 11px;
}
.step:last-child {
  padding: 0;
}
.step:not(:last-child):after {
  position: absolute;
  content: "";
  height: 1px;
  width: 50px;
  right: 13px;
  background: var(--line);
}
.step span {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--surface);
}
.step.active {
  color: var(--ocean);
}
.step.active span {
  border-color: var(--ocean);
  background: var(--ocean);
  color: white;
}
.flow-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 360px);
  gap: 26px;
  align-items: start;
}
.details-flow {
  align-items: start;
}
.details-flow > .flow-aside {
  display: flex;
  flex-direction: column;
  align-self: start;
}
.details-flow > .flow-aside .hint {
  margin-top: auto;
  padding-top: 15px;
}
.kicker {
  margin: 0;
  color: var(--ocean);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
}
.flow-layout h1,
.confirmed-page h1 {
  margin: 8px 0 5px;
  font-size: 32px;
  letter-spacing: -1px;
}
.flow-layout h1 span {
  color: var(--muted);
  font-weight: 400;
}
.muted {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}
.journey-card,
.passenger-card,
.summary-card,
.flow-aside,
.confirmed-card {
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
}
.journey-card {
  margin-top: 22px;
  padding: 22px;
}
.journey-time {
  display: grid;
  grid-template-columns: 1fr 1.3fr 1fr;
  align-items: center;
}
.journey-time small,
.journey-time span {
  display: block;
  color: var(--muted);
  font-size: 10px;
}
.journey-time strong {
  display: block;
  margin: 6px 0;
  font-size: 24px;
}
.journey-time .right {
  text-align: right;
}
.journey-line {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--ocean);
}
.journey-line i {
  height: 1px;
  flex: 1;
  background: var(--line);
}
.journey-line b {
  color: var(--muted);
  font-size: 10px;
  white-space: nowrap;
}
.route-mark {
  display: grid;
  place-items: center;
  color: var(--ocean);
}
.route-mark ion-icon {
  font-size: 20px;
}
.vessel-detail {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.boat-badge {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: var(--light-blue);
  color: var(--ocean);
}
.boat-badge ion-icon {
  font-size: 20px;
}
.vessel-detail p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11px;
}
.available {
  margin-left: auto;
  color: #087b68;
  font-size: 10px;
  font-weight: 700;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 12px;
}
.info-grid article {
  display: flex;
  flex-direction: column;
  min-height: 102px;
  padding: 15px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink);
}
.info-grid small,
.info-grid strong,
.info-grid span {
  display: block;
}
.info-grid small {
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
}
.info-grid strong {
  margin-top: 8px;
  color: var(--ink);
  font-size: 14px;
}
.info-grid span {
  margin-top: 4px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.4;
}
.flow-aside {
  width: 100%;
  min-width: 0;
  padding: 26px 24px;
  align-self: start;
  box-shadow: 0 14px 36px #102b4c0d;
}
.fare-row,
.total {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 13px 0;
  color: var(--muted);
  font-size: 12px;
}
.fare-row span,
.total span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.fare-row span small,
.total span small {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 400;
  line-height: 1.4;
}
.fare-row b {
  color: var(--ink);
  white-space: nowrap;
  text-align: right;
}
.total {
  margin-top: 8px;
  border-top: 1px solid var(--line);
  color: var(--ink);
}
.total strong {
  font-size: 21px;
}
.continue {
  --background: var(--ocean);
  --box-shadow: none;
  --border-radius: 10px;
  height: 46px;
  margin-top: 15px;
  text-transform: none;
  font-weight: 800;
}
.hint {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.5;
  text-align: center;
}
.passenger-card {
  margin-top: 18px;
  padding: 20px;
}
.passenger-heading,
.summary-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.passenger-heading {
  color: var(--ocean);
  font-size: 10px;
  letter-spacing: 0.1em;
}
.remove {
  border: 0;
  background: none;
  color: #c34d40;
  font: inherit;
  cursor: pointer;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 17px;
}
.form-grid label {
  display: grid;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
}
.form-grid input,
.form-grid select {
  width: 100%;
  height: 43px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: #fbfcfe;
  color: var(--ink);
  font: inherit;
  font-size: 12px;
}
.form-grid input:focus,
.form-grid select:focus {
  outline: 2px solid #8cc6e4;
  outline-offset: 1px;
}
.add-passenger {
  margin-top: 13px;
  border: 0;
  background: none;
  color: var(--ocean);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.add-passenger:disabled {
  opacity: 0.5;
}
.passenger-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
}
.passenger-actions a,
.summary-heading a {
  color: var(--ocean);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}
.passenger-actions .continue {
  margin: 0;
}
.sticky {
  position: sticky;
  top: 20px;
}
.trip-summary {
  margin-top: 103px;
  border-top: 3px solid var(--ocean);
}
.trip-route {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 13px;
}
.trip-route strong {
  font-size: 16px;
  color: var(--ink);
}
.trip-route span {
  font-size: 11px;
  color: var(--muted);
}
.trip-date {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 11px;
}
.trip-vessel {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 17px;
  padding: 13px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.trip-vessel .boat-badge {
  flex: none;
  margin: 0;
}
.trip-vessel small,
.trip-vessel strong {
  display: block;
}
.trip-vessel small {
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.trip-vessel strong {
  margin-top: 3px;
  font-size: 12px;
  color: var(--ink);
}
.trip-summary .total {
  margin-top: 8px;
  padding-top: 6px;
  border: 0;
}
.summary-flow > .flow-aside {
  margin-top: 103px;
  align-self: start;
  display: flex;
  flex-direction: column;
}
.summary-flow > .flow-aside .hint {
  margin-top: auto;
  padding-top: 12px;
}
.summary-card {
  margin-top: 20px;
  padding: 20px;
}
.summary-heading {
  margin: 6px 0 12px;
  font-size: 14px;
}
.summary-route {
  display: grid;
  grid-template-columns: 1fr 30px 1fr;
  align-items: center;
  padding: 14px 0 20px;
  border-bottom: 1px solid var(--line);
}
.summary-route strong {
  font-size: 17px;
}
.summary-route span {
  text-align: center;
  color: var(--ocean);
}
.summary-route small {
  grid-column: 1/-1;
  margin-top: 7px;
  color: var(--muted);
  font-size: 11px;
}
.passenger-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
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
.passenger-row strong,
.passenger-row small {
  display: block;
}
.passenger-row strong {
  font-size: 12px;
}
.passenger-row small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 10px;
}
.checked {
  margin-left: auto;
  color: #078a72;
}
.confirmed-page {
  max-width: 600px;
  margin: 25px auto;
  text-align: center;
}
.success-icon {
  display: grid;
  place-items: center;
  width: 66px;
  height: 66px;
  margin: 0 auto 18px;
  border-radius: 50%;
  background: #def7f0;
  color: #078a72;
  font-size: 34px;
}
.reference {
  display: flex;
  align-items: center;
  margin: 25px 0 14px;
  padding: 15px 18px;
  border: 1px dashed #9fcbe2;
  border-radius: 12px;
  background: var(--light-blue);
  text-align: left;
}
.reference small,
.confirmed-card small {
  display: block;
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.reference strong {
  display: block;
  margin-top: 4px;
  color: var(--ocean);
  font-size: 16px;
}
.reference button {
  margin-left: auto;
  border: 0;
  background: none;
  color: var(--ocean);
  font-weight: 800;
  cursor: pointer;
}
.confirmed-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 17px;
  padding: 20px;
  text-align: left;
}
.confirmed-card strong {
  display: block;
  margin-top: 5px;
  font-size: 12px;
}
.confirmation-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}
.confirmation-actions ion-button {
  --border-radius: 9px;
  --box-shadow: none;
  text-transform: none;
  font-weight: 800;
}
.success-icon ion-icon {
  display: block;
  font-size: 34px;
}
.confirmed-card > div {
  min-width: 0;
}
.confirmed-card small {
  display: flex;
  align-items: center;
  gap: 6px;
}
.confirmed-card small ion-icon {
  flex: none;
  color: var(--ocean);
  font-size: 14px;
}
.confirmed-card strong {
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.confirmation-actions ion-button {
  min-width: 150px;
}
.reference button {
  min-height: 38px;
  padding: 0 4px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
@media (min-width: 801px) {
  .details-flow > .flow-aside {
    margin-top: 103px;
    padding: 18px;
    align-self: start;
  }
  .details-flow .fare-row,
  .details-flow .total {
    padding: 8px 0;
  }
  .details-flow .fare-row span small,
  .details-flow .total span small {
    display: none;
  }
  .details-flow .continue {
    height: 44px;
    margin-top: 10px;
  }
  .details-flow .hint {
    padding-top: 8px;
    font-size: 9px;
    line-height: 1.35;
  }
}
@media (min-width: 801px) {
  .summary-flow {
    align-items: stretch;
  }
  .summary-flow > div {
    display: flex;
    flex-direction: column;
  }
  .summary-flow > div > .summary-card {
    flex: 1;
  }
  .summary-flow > .flow-aside {
    height: auto;
  }
}
@container passenger (max-width:800px) {
  .booking-page {
    padding: 20px 16px 45px;
  }
  .passenger-flow > .trip-summary {
    order: -1;
    margin-top: 0;
  }
  .trip-summary {
    position: static;
  }
  .secure {
    display: none;
  }
  .progress {
    justify-content: space-between;
    margin: 32px 0;
  }
  .step {
    padding-right: 0;
  }
  .step:after {
    display: none;
  }
  .step b {
    display: none;
  }
  .flow-layout {
    grid-template-columns: 1fr;
  }
  .flow-aside {
    order: 2;
  }
  .summary-flow > .flow-aside {
    margin-top: 0;
    align-self: start;
  }
  .summary-flow > .flow-aside .hint {
    margin-top: 12px;
    padding-top: 0;
  }
  .sticky {
    position: static;
  }
  .form-grid,
  .info-grid {
    grid-template-columns: 1fr;
  }
  .confirmed-card {
    grid-template-columns: 1fr;
  }
  .confirmation-actions {
    flex-direction: column;
  }
  .flow-layout h1,
  .confirmed-page h1 {
    font-size: 27px;
  }
}
@container passenger (max-width:480px) {
  .booking-page {
    padding: 14px 12px 34px;
  }
  .booking-header :deep(.brand-copy small) {
    display: none;
  }
  .booking-header :deep(.brand-copy strong) {
    font-size: 14px;
  }
  .back-link {
    width: 36px;
    height: 36px;
  }
  .progress {
    justify-content: space-between;
    gap: 4px;
    margin: 22px auto 25px;
    max-width: 100%;
  }
  .step {
    flex-direction: column;
    gap: 4px;
    padding-right: 0;
    text-align: center;
    font-size: 9px;
  }
  .step:not(:last-child):after {
    display: none;
  }
  .step span {
    width: 25px;
    height: 25px;
  }
  .step b {
    display: block;
    font-size: 9px;
  }
  .summary-flow > div > .summary-card {
    padding: 16px;
  }
  .summary-flow > .flow-aside {
    padding: 20px 16px;
  }
  .summary-flow .passenger-row {
    gap: 8px;
  }
  .summary-flow .passenger-row > div {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .summary-flow .passenger-row small {
    line-height: 1.4;
  }
  .passenger-flow {
    gap: 17px;
  }
  .passenger-flow > .trip-summary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 10px;
    row-gap: 0;
    margin-top: 0;
    padding: 13px 14px;
  }
  .passenger-flow > .trip-summary > .kicker {
    grid-column: 1;
    grid-row: 1;
  }
  .passenger-flow > .trip-summary > .trip-route {
    grid-column: 1;
    grid-row: 2;
    margin-top: 7px;
  }
  .passenger-flow > .trip-summary > .trip-route strong {
    font-size: 14px;
  }
  .passenger-flow > .trip-summary > .trip-date {
    grid-column: 1;
    grid-row: 3;
    margin-top: 4px;
  }
  .passenger-flow > .trip-summary > .trip-vessel {
    grid-column: 1/3;
    grid-row: 4;
    margin-top: 10px;
    padding: 9px 0;
  }
  .passenger-flow > .trip-summary > .total {
    grid-column: 2;
    grid-row: 1/4;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .passenger-flow > .trip-summary > .total span {
    font-size: 9px;
  }
  .passenger-flow > .trip-summary > .total strong {
    font-size: 20px;
  }
  .passenger-flow > .trip-summary > .hint {
    display: none;
  }
  .passenger-flow > .trip-summary .boat-badge {
    width: 32px;
    height: 32px;
  }
  .passenger-flow .flow-main h1 {
    font-size: 25px;
  }
  .passenger-flow .passenger-card {
    margin-top: 13px;
    padding: 15px;
  }
  .passenger-flow .form-grid {
    gap: 12px;
    margin-top: 14px;
  }
  .passenger-flow .passenger-actions {
    gap: 12px;
  }
  .passenger-flow .passenger-actions .continue {
    min-width: 0;
    flex: 1;
  }
  .passenger-flow .add-passenger {
    min-height: 40px;
  }
}
@container passenger (max-width:800px) {
  .confirmed-page {
    max-width: 520px;
    margin: 8px auto 0;
  }
  .confirmed-page .success-icon {
    width: 60px;
    height: 60px;
    margin-bottom: 15px;
  }
  .confirmed-page h1 {
    font-size: 28px;
  }
  .confirmed-page > .muted {
    max-width: 420px;
    margin: 0 auto;
  }
  .confirmed-card {
    gap: 14px;
    padding: 18px;
  }
  .confirmation-actions {
    align-items: stretch;
  }
  .confirmation-actions ion-button {
    width: 100%;
    max-width: 360px;
    margin: 0 auto;
  }
}
@container passenger (max-width:480px) {
  .confirmed-page {
    margin: 4px auto 0;
  }
  .confirmed-page .success-icon {
    width: 54px;
    height: 54px;
    margin-bottom: 13px;
  }
  .confirmed-page .success-icon ion-icon {
    font-size: 29px;
  }
  .confirmed-page h1 {
    font-size: 25px;
    letter-spacing: -0.6px;
  }
  .confirmed-page > .muted {
    font-size: 12px;
  }
  .reference {
    gap: 8px;
    margin: 19px 0 12px;
    padding: 12px 14px;
  }
  .reference > div {
    min-width: 0;
  }
  .reference strong {
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .confirmed-card {
    gap: 12px;
    padding: 15px;
  }
  .confirmed-card > div + div {
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }
  .confirmed-card strong {
    font-size: 12px;
  }
  .confirmation-actions {
    gap: 8px;
    margin-top: 15px;
  }
}
.confirmation-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: stretch;
  width: min(100%, 440px);
  margin: 20px auto 0;
  gap: 12px;
}
.confirmation-actions ion-button {
  display: block;
  width: 100%;
  min-width: 0;
  height: 48px;
  min-height: 48px;
  margin: 0;
  --border-radius: 10px;
  --padding-start: 12px;
  --padding-end: 12px;
  font-size: 13px;
  white-space: nowrap;
}
.confirmation-actions ion-button::part(native) {
  height: 48px;
  min-height: 48px;
  white-space: nowrap;
}
.confirmation-actions ion-button.continue {
  margin: 0;
}
@container passenger (max-width:800px) {
  .confirmation-actions {
    grid-template-columns: 1fr;
    width: min(100%, 360px);
    gap: 10px;
  }
  .confirmation-actions ion-button {
    height: 46px;
    min-height: 46px;
  }
  .confirmation-actions ion-button::part(native) {
    height: 46px;
    min-height: 46px;
  }
}
@container passenger (max-width:360px) {
  .confirmation-actions {
    width: 100%;
  }
  .confirmation-actions ion-button {
    font-size: 12px;
  }
}
@container passenger (max-width:800px) {
  .details-flow > .flow-aside {
    margin-top: 0;
    padding: 20px 16px;
  }
  .details-flow .fare-row span small,
  .details-flow .total span small {
    display: block;
  }
  .summary-flow > div {
    display: block;
  }
  .summary-flow > div > .summary-card {
    flex: none;
  }
}
.passenger-content {
  --background: #0d1726;
}
.passenger-info-page {
  --cloud: #0d1726;
  --surface: #142235;
  --surface-soft: #101d2d;
  --ink: #eff6fb;
  --muted: #9aafc0;
  --line: #263b50;
  --light-blue: #102d4b;
  --ocean: #53a9ee;
  min-height: 100%;
  background: var(--cloud);
  color: var(--ink);
}
.passenger-info-page .passenger-card,
.passenger-info-page .trip-summary {
  background: var(--surface);
  border-color: var(--line);
  box-shadow: 0 12px 30px #020b1829;
}
.passenger-info-page .trip-summary {
  border-top: 3px solid var(--ocean);
}
.passenger-info-page .form-grid input,
.passenger-info-page .form-grid select {
  background: var(--surface-soft);
  color: var(--ink);
  border-color: var(--line);
  color-scheme: dark;
}
.passenger-info-page .form-grid input::placeholder {
  color: var(--muted);
  opacity: 1;
}
.passenger-info-page .form-grid input:-webkit-autofill {
  -webkit-text-fill-color: var(--ink);
  box-shadow: 0 0 0 1000px #101d2d inset;
}
.passenger-info-page .form-grid input:focus,
.passenger-info-page .form-grid select:focus {
  border-color: var(--ocean);
  outline: 2px solid #53a9ee66;
  outline-offset: 1px;
}
.passenger-info-page .form-grid label {
  color: var(--ink);
}
.passenger-info-page .remove {
  color: #fa958c;
}
.passenger-info-page .add-passenger {
  min-height: 40px;
  margin-top: 15px;
  padding: 0 13px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
  color: var(--ocean);
}
.passenger-info-page .add-passenger:not(:disabled):hover {
  border-color: var(--ocean);
}
.passenger-info-page .progress .step:not(.active) span {
  background: var(--surface);
  color: var(--muted);
}
@container passenger (min-width:801px) and (max-width:900px) {
  .flow-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .details-flow > .flow-aside,
  .summary-flow > .flow-aside {
    margin-top: 0;
  }
  .passenger-flow > .trip-summary {
    order: -1;
    margin-top: 0;
    position: static;
  }
  .summary-flow > div {
    display: block;
  }
  .summary-flow > div > .summary-card {
    flex: none;
  }
  .details-flow .fare-row span small,
  .details-flow .total span small {
    display: block;
  }
}

@container passenger (max-width:620px) {
  .info-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .info-grid article {
    padding: 14px 10px;
  }
  .info-grid strong {
    font-size: 12px;
    line-height: 1.4;
  }
  .info-grid span {
    font-size: 9px;
    line-height: 1.5;
  }
}
</style>
