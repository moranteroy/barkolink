<template>
  <article class="trip-card">
    <div class="trip-top"><div class="vessel"><span class="vessel-icon"><ion-icon :icon="boatOutline" /></span><div><strong>{{ trip.vessel }}</strong><small>Trip {{ trip.id }} | Passenger ferry</small></div></div><span class="status" :class="trip.status.toLowerCase()">{{ trip.status }}</span></div>
    <div class="journey"><div><small>{{ trip.from.toUpperCase() }}</small><strong>{{ trip.departure }}</strong><span>{{ trip.from }} Port</span></div><div class="journey-line"><span>{{ trip.duration }}</span><i></i><ion-icon :icon="arrowForwardOutline" /></div><div class="arrival"><small>{{ trip.to.toUpperCase() }}</small><strong>{{ trip.arrival }}</strong><span>{{ trip.to }} Port</span></div></div>
    <div class="trip-bottom"><span><ion-icon :icon="peopleOutline" /> {{ trip.available }} slots available</span><div><strong>{{ trip.fare }}</strong><small> / passenger</small><ion-button fill="clear" size="small" @click="selectTrip">Book this sailing <ion-icon slot="end" :icon="arrowForwardOutline" /></ion-button></div></div>
  </article>
</template>

<script setup lang="ts">
import { IonButton, IonIcon } from '@ionic/vue'
import { arrowForwardOutline, boatOutline, peopleOutline } from 'ionicons/icons'
import { useRouter } from 'vue-router'
const router = useRouter()
function selectTrip() {
  sessionStorage.removeItem('barkolink-booking-draft')
  sessionStorage.removeItem('barkolink-booking-intent')
  localStorage.setItem('barkolink-selected-trip', JSON.stringify({ ...props.trip, selectionId: crypto.randomUUID() }))
  router.push('/trip-details')
}
const props = defineProps<{ trip: { id:string; vessel:string; from:string; to:string; departure:string; arrival:string; duration:string; fare:string; available:number; status:string; date?:string; passengerCount?:number; regularFare?:number; studentFare?:number; seniorFare?:number; childFare?:number; pwdFare?:number } }>()
</script>

<style scoped>
.trip-card { padding:20px; border:1px solid var(--line); background:var(--surface); border-radius:18px; }.trip-top,.trip-bottom { display:flex; align-items:center; justify-content:space-between; gap:12px; }.vessel { display:flex; align-items:center; gap:10px; }.vessel-icon { display:grid; place-items:center; width:34px;height:34px;border-radius:10px;background:var(--light-blue);color:var(--ocean); }.vessel strong,.vessel small { display:block; }.vessel strong { font-size:14px; }.vessel small { margin-top:3px;color:var(--muted);font-size:10px; }.status { padding:5px 8px;border-radius:6px;font-size:9px;font-weight:800;letter-spacing:.07em; }.available { color:#117a52;background:#e6f7ef; }.limited { color:#9a5b00;background:#fff3d6; }.journey { display:grid; grid-template-columns:1fr 1fr 1fr; align-items:center; margin:22px 0 18px; }.journey small,.journey span { display:block; color:var(--muted);font-size:10px; }.journey strong { display:block;margin:4px 0;font-size:22px;letter-spacing:-.6px; }.journey-line { display:flex; align-items:center; gap:8px; }.journey-line i { height:1px;flex:1;background:var(--line); }.journey-line ion-icon { color:var(--ocean);font-size:17px; }.arrival { text-align:right; }.trip-bottom { border-top:1px solid var(--line); padding-top:14px; }.trip-bottom > span { display:flex;align-items:center;gap:5px;color:var(--muted);font-size:11px; }.trip-bottom > span ion-icon { color:var(--ocean); }.trip-bottom > div { display:flex;align-items:center;gap:2px; }.trip-bottom > div strong { font-size:17px; }.trip-bottom small { color:var(--muted);font-size:10px; }.trip-bottom ion-button { --color:var(--ocean); margin-left:10px; font-weight:700;text-transform:none; }.trip-bottom ion-button ion-icon { font-size:14px; }
@container passenger (max-width:480px){.trip-card{padding:16px}.trip-bottom{align-items:flex-start;flex-direction:column}.trip-bottom>div{width:100%;justify-content:space-between}.trip-bottom ion-button{margin-left:auto}.journey strong{font-size:18px}}
</style>
