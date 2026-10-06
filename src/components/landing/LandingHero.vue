<template>
  <section class="landing-hero"><div class="landing-container hero-grid">
    <div class="hero-copy">
      <span class="hero-pill"><IonIcon :icon="boatOutline" aria-hidden="true" /> Your ferry journey, connected</span>
      <h1>Travel smarter.<br /><span>Sail easier.</span></h1>
      <p>Find your crossing, reserve your seats, and keep every passenger’s QR ticket in one place. Your next island is a few steps away.</p>
      <div class="hero-actions"><RouterLink class="landing-button white" to="/search?all=1">Book a Trip <IonIcon :icon="ticketOutline" aria-hidden="true" /></RouterLink><RouterLink class="landing-button outline" to="/login">Sign in</RouterLink></div>
      <div class="hero-stats" aria-label="Booking at a glance"><div><strong>{{ loading ? '—' : routes }}</strong><span>Available routes</span></div><div><strong>{{ loading ? '—' : vessels }}</strong><span>Scheduled vessels</span></div><div><strong>QR</strong><span>Passenger tickets</span></div><div><strong>Counter</strong><span>Payment at the port</span></div></div>
    </div>
    <div class="hero-search"><div class="search-frame"><TripSearchCard /></div><div class="search-benefits"><span><IonIcon :icon="calendarOutline" aria-hidden="true" /> Reserve ahead</span><span><IonIcon :icon="ticketOutline" aria-hidden="true" /> Tickets in one place</span></div></div>
  </div><svg class="hero-waves" viewBox="0 0 1440 120" fill="none" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60 C240 120 480 0 720 40 C960 80 1200 20 1440 60 L1440 120 L0 120Z" fill="currentColor" opacity=".18" /><path d="M0 80 C240 130 480 30 720 60 C960 90 1200 40 1440 80 L1440 120 L0 120Z" fill="currentColor" /></svg></section>
</template>
<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { RouterLink } from 'vue-router';
import { boatOutline, calendarOutline, ticketOutline } from 'ionicons/icons';
import TripSearchCard from '../passenger/TripSearchCard.vue';
defineProps<{ routes: number; vessels: number; loading: boolean }>();
</script>
