<template>
  <section id="routes" class="landing-section landing-container" aria-labelledby="routes-heading" :aria-busy="loading">
    <div class="landing-heading"><span class="section-eyebrow">FIND YOUR CROSSING</span><h2 id="routes-heading">Explore our routes</h2><p>Choose from upcoming sailings and find a fare that fits your journey.</p></div>
    <div v-if="loading" class="landing-state" role="status">Loading upcoming routes…</div>
    <div v-else-if="error" class="landing-state" role="alert">{{ error }} <button type="button" class="text-action" @click="emit('retry')">Try again</button></div>
    <div v-else-if="!routes.length" class="landing-state landing-empty"><span class="landing-icon"><IonIcon :icon="calendarOutline" aria-hidden="true" /></span><div><h3>More journeys on the horizon</h3><p>No upcoming routes with seats available. Check the schedules for the latest departures.</p></div><RouterLink class="landing-button pale small" to="/trips?all=1">Browse sailing schedules <IonIcon :icon="arrowForwardOutline" aria-hidden="true" /></RouterLink></div>
    <div v-else class="landing-grid routes-grid"><article v-for="route in routes.slice(0, 4)" :key="route.id" class="landing-card route-card">
      <span class="landing-icon"><IonIcon :icon="boatOutline" aria-hidden="true" /></span>
      <h3>{{ route.sailing.origin.city }} <IonIcon :icon="arrowForwardOutline" aria-hidden="true" /><span class="sr-only">to</span> {{ route.sailing.destination.city }}</h3>
      <p class="route-duration"><IonIcon :icon="timeOutline" aria-hidden="true" /> {{ duration(route.sailing.durationMinutes) }}</p>
      <p class="route-next">Next departure<br /><strong>{{ departure(route.sailing.departureAt) }}</strong></p>
      <div class="route-bottom"><div><small>Regular fare from</small><strong>{{ route.fare === null ? 'See fares' : money.format(route.fare) }}</strong></div><button class="landing-button pale small" type="button" :aria-label="`Find ${route.sailing.origin.city} to ${route.sailing.destination.city} sailings`" @click="emit('select', route.sailing)">Book Now</button></div>
    </article></div>
    <p v-if="routes.length" class="landing-note">Regular passenger fare shown. Service fees and accommodation charges are displayed before you reserve.</p>
    <RouterLink class="section-link" to="/trips?all=1">View all sailings <IonIcon :icon="searchOutline" aria-hidden="true" /></RouterLink>
  </section>
</template>
<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { RouterLink } from 'vue-router';
import { arrowForwardOutline, boatOutline, timeOutline, searchOutline, calendarOutline } from 'ionicons/icons';
import type { landingCatalog, LandingSailing } from '../../data/landingCatalog';
defineProps<{ routes: ReturnType<typeof landingCatalog>['routes']; loading: boolean; error: string }>();
const emit = defineEmits<{ retry: []; select: [sailing: LandingSailing] }>();
const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 });
const departure = (value: string) => new Date(value).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
const duration = (minutes: number) => `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`;
</script>
