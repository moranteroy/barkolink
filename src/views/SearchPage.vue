<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <main class="search-page">
        <PassengerHeader />
        <div class="title-row"><div><p class="kicker">AVAILABLE SAILINGS</p><h1 v-if="searchRoute.from && searchRoute.to">{{ searchRoute.from }} <span>to</span> {{ searchRoute.to }}</h1><h1 v-else>Available trips</h1><p class="subline"><ion-icon :icon="calendarOutline" /> {{ travelDate || 'Upcoming departures' }} <i></i> {{ passengerCount }} passenger{{ passengerCount === 1 ? '' : 's' }}</p></div></div>
        <section class="summary-strip"><div><strong>{{ trips.length }}</strong><span>trips found</span></div><button type="button" @click="sortDescending = !sortDescending">Departure <b>{{ sortDescending ? 'latest first' : 'earliest first' }}</b><ion-icon :icon="chevronDownOutline" /></button></section>
        <p v-if="loading" class="state-message">Loading available sailings…</p><p v-else-if="errorMessage" class="state-message error" role="alert">{{ errorMessage }}</p>
        <section v-else-if="sortedTrips.length" class="trip-list"><TripCard v-for="trip in sortedTrips" :key="trip.id" :trip="trip" /></section><section v-else class="no-trips"><strong>No sailings found</strong><p>Try another route or travel date.</p><button @click="router.push('/home')">Change search</button></section>
        <div class="demo-note"><ion-icon :icon="informationCircleOutline" /><span>Fares are calculated from the selected passenger types.</span></div>
      </main>
      <PassengerBottomNav />
    </ion-content>
  </ion-page>
</template>
<script setup lang="ts">
import { dataConnectRequestError } from '../data/dataConnectErrors'
import { IonContent, IonIcon, IonPage } from '@ionic/vue'
import { calendarOutline, chevronDownOutline, informationCircleOutline } from 'ionicons/icons'
import { useRoute, useRouter } from 'vue-router'
import { computed, ref } from 'vue'
import { onIonViewWillEnter } from '@ionic/vue'
import PassengerHeader from '../../components/PassengerHeader.vue'
import PassengerBottomNav from '../../components/PassengerBottomNav.vue'
import TripCard from '../../components/TripCard.vue'
import { browseSailings } from '../dataconnect-generated/passenger'
import { dataConnect } from '../services/firebase'
const router = useRouter()
const route = useRoute()
function readSearchRoute() { try { return JSON.parse(localStorage.getItem('barkolink-search-route') || '{}') as { from?: string; to?: string } } catch { return {} } }
const searchRoute = ref(readSearchRoute())
const travelDate = ref(localStorage.getItem('barkolink-search-date') || '')
const travelIsoDate = ref(localStorage.getItem('barkolink-search-iso-date') || '')
const passengerCount = ref(Math.max(1, Math.min(8, Number(localStorage.getItem('barkolink-search-passengers')) || 1)))
const trips = ref<Array<{id:string;departureAt:string;vessel:string;from:string;to:string;departure:string;arrival:string;duration:string;fare:string;available:number;status:string;date:string;passengerCount:number;regularFare:number;studentFare:number;seniorFare:number;childFare:number;pwdFare:number}>>([])
const loading = ref(true)
const errorMessage = ref('')
const sortDescending = ref(false)
const sortedTrips = computed(() => [...trips.value].sort((a,b) => sortDescending.value ? b.departureAt.localeCompare(a.departureAt) : a.departureAt.localeCompare(b.departureAt)))
const dateKey = (value: string) => { const parsed = new Date(value); return Number.isNaN(parsed.valueOf()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed) }
const clock = (value: string) => new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(value))
onIonViewWillEnter(async () => {
  loading.value = true; errorMessage.value = ''; searchRoute.value = route.query.all === '1' ? {} : readSearchRoute(); travelDate.value = route.query.all === '1' ? '' : localStorage.getItem('barkolink-search-date') || ''; travelIsoDate.value = route.query.all === '1' ? '' : localStorage.getItem('barkolink-search-iso-date') || ''; passengerCount.value = Math.max(1, Math.min(8, Number(localStorage.getItem('barkolink-search-passengers')) || 1))
  try {
    if (!dataConnect) throw new Error('Firebase is not configured. Add the Firebase Web app settings to .env.local to browse live sailings.')
    const result = await browseSailings(dataConnect)
    trips.value = result.data.sailings.filter(sailing => (!searchRoute.value.from || sailing.origin.city.toLowerCase() === searchRoute.value.from?.toLowerCase()) && (!searchRoute.value.to || sailing.destination.city.toLowerCase() === searchRoute.value.to?.toLowerCase()) && (!travelIsoDate.value || dateKey(sailing.departureAt) === travelIsoDate.value) && new Date(sailing.departureAt) > new Date() && sailing.availableSeats >= passengerCount.value).map(sailing => ({
      id: sailing.code, departureAt: sailing.departureAt, vessel: sailing.vessel.name, from: sailing.origin.city, to: sailing.destination.city,
      departure: clock(sailing.departureAt), arrival: clock(sailing.arrivalAt), duration: `${Math.floor(sailing.durationMinutes / 60)}h ${sailing.durationMinutes % 60}m`,
      fare: `PHP ${sailing.regularFare.toLocaleString()}`, available: sailing.availableSeats, status: sailing.availableSeats < 20 ? 'Limited' : 'Available',
      date: new Date(sailing.departureAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }), passengerCount: passengerCount.value,
      regularFare: sailing.regularFare, studentFare: sailing.studentFare, seniorFare: sailing.seniorFare, childFare: sailing.childFare, pwdFare:sailing.pwdFare,
    }))
  } catch (error) { errorMessage.value = dataConnectRequestError(error, 'Could not load sailings.') }
  finally { loading.value = false }
})
</script>
<style scoped>
.search-page{max-width:850px;margin:0 auto;padding:26px 34px 105px}.page-header{display:flex;align-items:center;justify-content:space-between}.page-header .brand-mark{margin:auto}.back-button,.filter-button{display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--line);border-radius:11px;background:#fff;color:var(--ink);font-size:20px}.kicker{margin:55px 0 7px;color:var(--ocean);font-size:10px;font-weight:800;letter-spacing:.1em}.title-row h1{margin:0;font-size:31px;letter-spacing:-1px}.title-row h1 span{color:var(--muted);font-weight:400}.subline{display:flex;align-items:center;gap:7px;margin:10px 0 0;color:var(--muted);font-size:12px}.subline ion-icon{color:var(--ocean)}.subline i{width:4px;height:4px;border-radius:50%;background:#b8c0cc}.summary-strip{display:flex;justify-content:space-between;align-items:center;margin:34px 0 13px;padding:14px 16px;border-radius:12px;background:var(--light-blue)}.summary-strip div{display:flex;align-items:baseline;gap:6px}.summary-strip strong{color:var(--ocean);font-size:18px}.summary-strip span{color:var(--muted);font-size:11px}.summary-strip button{border:0;background:transparent;color:var(--muted);font-size:11px}.summary-strip b{color:var(--ink)}.summary-strip ion-icon{margin-left:4px;vertical-align:middle}.trip-list{display:grid;gap:12px}.demo-note{display:flex;gap:8px;align-items:center;margin:18px 4px;color:var(--muted);font-size:10px}.demo-note ion-icon{flex:none;color:var(--ocean);font-size:16px}@container passenger (max-width:620px){.search-page{padding:20px 16px 102px}.kicker{margin-top:42px}.title-row h1{font-size:27px}.summary-strip{margin-top:25px}}
.header-spacer{width:38px;height:38px}
@container passenger (max-width:620px){.search-page{padding:20px 16px 105px}.kicker{margin-top:40px}.title-row h1{font-size:27px}.summary-strip{margin-top:25px}}
</style>
