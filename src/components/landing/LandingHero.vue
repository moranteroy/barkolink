<template>
  <section class="landing-hero"><div class="landing-container hero-grid">
    <div class="hero-copy">
      <span class="hero-pill"><IonIcon :icon="boatOutline" aria-hidden="true" /> Your ferry journey, connected</span>
      <h1>Travel smarter.<br /><span>Sail easier.</span></h1>
      <p>Find your crossing, reserve your seats, and keep every passenger’s QR ticket in one place. Your next island is a few steps away.</p>
      <div class="hero-actions"><RouterLink class="landing-button white" to="/trips?all=1">Book a Trip <IonIcon :icon="ticketOutline" aria-hidden="true" /></RouterLink><RouterLink class="landing-button outline" to="/login">Sign in</RouterLink></div>
      <RouterLink to="/help" class="hero-crew"><span class="hero-crew-portraits"><BarkoMascot portrait /><BarkoMascot character="female" portrait /></span><span><strong>Your captain & passenger guide</strong><small>Help with sailings, booking, and boarding</small></span><IonIcon :icon="arrowForwardOutline" aria-hidden="true" /></RouterLink>
      <div class="hero-stats" aria-label="Booking at a glance"><div><strong>{{ loading ? '—' : routes }}</strong><span>Available routes</span></div><div><strong>{{ loading ? '—' : vessels }}</strong><span>Scheduled vessels</span></div><div><strong>QR</strong><span>Passenger tickets</span></div><div><strong>Cash + online</strong><span>Payment options</span></div></div>
    </div>
    <div class="hero-search"><div class="search-frame"><TripSearchCard /></div><div class="search-benefits"><span><IonIcon :icon="calendarOutline" aria-hidden="true" /> Reserve ahead</span><span><IonIcon :icon="ticketOutline" aria-hidden="true" /> Tickets in one place</span></div></div>
  </div><svg class="hero-waves" viewBox="0 0 1440 120" fill="none" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60 C240 120 480 0 720 40 C960 80 1200 20 1440 60 L1440 120 L0 120Z" fill="currentColor" opacity=".18" /><path d="M0 80 C240 130 480 30 720 60 C960 90 1200 40 1440 80 L1440 120 L0 120Z" fill="currentColor" /></svg></section>
</template>
<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { RouterLink } from 'vue-router';
import { boatOutline, calendarOutline, ticketOutline, arrowForwardOutline } from 'ionicons/icons';
import BarkoMascot from '../shared/BarkoMascot.vue';
import TripSearchCard from '../passenger/TripSearchCard.vue';
defineProps<{ routes: number; vessels: number; loading: boolean }>();
</script>
<style scoped>
.hero-crew { display: flex; align-items: center; gap: 12px; max-width: 440px; margin-top: 26px; padding: 12px 14px; border: 1px solid #ffffff26; border-radius: 14px; color: #fff; background: #ffffff0a; transition: background .2s ease; }
.hero-crew:hover { background: #ffffff16; }
.hero-crew-portraits { display: flex; flex-shrink: 0; padding-right: 2px; }
.hero-crew-portraits .barko-mascot { width: 36px; border: 2px solid #d2eff7; }
.hero-crew-portraits .barko-mascot + .barko-mascot { margin-left: -8px; }
.hero-crew > span:nth-child(2) { flex: 1; min-width: 0; }
.hero-crew strong { display: block; font-size: 12px; line-height: 1.5; }
.hero-crew small { display: block; color: #d4e9f0; font-size: 11px; line-height: 1.6; margin-top: 2px; }
.hero-stats > div:last-child strong { font-size: 19px; }
@media (prefers-reduced-motion: reduce) { .hero-crew { transition: none; } }
</style>
