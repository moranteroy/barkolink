<template>
  <article class="trip-card glass-panel">
    <div class="trip-top">
      <div class="vessel">
        <span class="vessel-icon"><ion-icon :icon="boatOutline" /></span>
        <div>
          <strong>{{ trip.vessel }}</strong
          ><small>Trip {{ trip.id }}</small>
        </div>
      </div>
      <Badge class="status" :variant="['SCHEDULED', 'AVAILABLE'].includes(trip.status.toUpperCase()) ? 'success' : trip.status.toUpperCase() === 'CANCELLED' ? 'destructive' : 'warning'">{{
        trip.status
      }}</Badge>
    </div>
    <p v-if="trip.date" class="sailing-date">Departure: {{ trip.date }} · Philippine time</p>
    <div class="journey">
      <div>
        <small>Departure</small
        ><strong>{{ trip.departure }}</strong
        ><span>{{ trip.originPortName || trip.from + " Port" }}</span>
      </div>
      <div class="journey-line">
        <ion-icon :icon="boatOutline" aria-hidden="true" /><span>{{ trip.duration }}</span>
      </div>
      <div class="arrival">
        <small>Arrival</small
        ><strong>{{ trip.arrival }}</strong
        ><span>{{ trip.destinationPortName || trip.to + " Port" }}</span>
      </div>
    </div>
    <div class="trip-bottom">
      <span
        ><ion-icon :icon="peopleOutline" /> {{ trip.available }} slots
        available</span
      >
      <div class="fare-actions">
        <div class="fare-copy">
        <strong>{{ trip.fare }}</strong
        ><small>Regular fare / passenger</small>
        </div>
        <Button @click="selectTrip"
          >Book this sailing <ion-icon :icon="ticketOutline" aria-hidden="true"
        /></Button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { IonIcon } from "@ionic/vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  boatOutline,
  peopleOutline,
  ticketOutline,
} from "ionicons/icons";
import { useRouter } from "vue-router";
const router = useRouter();
function selectTrip() {
  sessionStorage.removeItem("barkolink-booking-draft");
  sessionStorage.removeItem("barkolink-booking-intent");
  localStorage.setItem(
    "barkolink-selected-trip",
    JSON.stringify({ ...props.trip, selectionId: crypto.randomUUID() }),
  );
  router.push("/trip-details");
}
const props = defineProps<{
  trip: {
    id: string;
    originPortName?: string;
    destinationPortName?: string;
    vessel: string;
    from: string;
    to: string;
    departure: string;
    arrival: string;
    duration: string;
    fare: string;
    available: number;
    status: string;
    date?: string;
    passengerCount?: number;
    regularFare?: number;
    studentFare?: number;
    seniorFare?: number;
    childFare?: number;
    pwdFare?: number;
  };
}>();
</script>

<style scoped>
.trip-card { min-width: 0; padding: 18px; border: 1px solid var(--line); border-radius: 15px; background: var(--surface); color: var(--ink); }
.trip-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.vessel { display: flex; align-items: center; gap: 10px; min-width: 0; }
.vessel > div { min-width: 0; }
.vessel-icon { display: grid; place-items: center; flex: none; width: 34px; height: 34px; border-radius: 10px; background: var(--light-blue); color: var(--ocean); font-size: 19px; }
.vessel strong { display: block; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
.vessel small { display: block; margin-top: 3px; color: var(--muted); font-size: 10px; line-height: 1.5; overflow-wrap: anywhere; }
.status { flex: none; padding: 5px 8px; border-radius: 7px; font-size: 9px; font-weight: 650; letter-spacing: .02em; }
.sailing-date { margin: 14px 0 0; color: var(--muted); font-size: 10px; line-height: 1.6; font-weight: 400; }
.journey { display: grid; grid-template-columns: minmax(0, 1fr) 64px minmax(0, 1fr); align-items: center; gap: 8px; padding: 16px 0; margin: 8px 0 0; }
.journey > div { min-width: 0; }
.journey small { display: block; color: var(--muted); font-size: 10px; }
.journey strong { display: block; margin: 5px 0; color: var(--ink); font-size: 22px; line-height: 1.3; letter-spacing: -.5px; }
.journey span { display: block; color: var(--muted); font-size: 11px; line-height: 1.6; overflow-wrap: anywhere; }
.journey-line { display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 5px; }
.journey-line ion-icon { color: var(--ocean); font-size: 20px; }
.journey-line span { font-size: 10px; text-align: center; }
.arrival { text-align: right; }
.trip-bottom { padding-top: 14px; border-top: 1px solid var(--line); }
.trip-bottom > span { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 11px; }
.trip-bottom > span ion-icon { color: var(--ocean); font-size: 16px; }
.fare-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; }
.fare-copy { min-width: 0; }
.fare-copy strong { display: block; color: var(--ink); font-size: 20px; line-height: 1.5; }
.fare-copy small { display: block; color: var(--muted); font-size: 10px; line-height: 1.5; }
.fare-actions [data-slot="button"] { display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex: none; min-height: 44px; padding: 10px 12px; border-radius: 9px; background: var(--action); color: #fff; font-size: 11px; font-weight: 600; white-space: normal; text-transform: none; }
.fare-actions ion-icon { font-size: 17px; flex: none; }
@container passenger (max-width: 380px) {
  .trip-card { padding: 16px; }
  .trip-top { gap: 8px; }
  .vessel { gap: 8px; }
  .journey { grid-template-columns: minmax(0, 1fr) 44px minmax(0, 1fr); gap: 6px; }
  .journey strong { font-size: 18px; }
  .fare-actions { flex-wrap: wrap; }
  .fare-actions [data-slot="button"] { width: 100%; }
}
</style>
