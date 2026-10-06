<template><section id="features" class="landing-muted landing-section" aria-labelledby="features-heading"><div class="landing-container">
  <div class="landing-heading"><span class="section-eyebrow">MADE FOR YOUR JOURNEY</span><h2 id="features-heading">Why sail with BarkoLink</h2><p>Your reservations, passenger details, and sailing updates — together.</p></div>
  <div class="landing-grid three-columns"><article v-for="feature in features" :key="feature.title" class="landing-card"><span class="landing-icon"><IonIcon :icon="feature.icon" aria-hidden="true" /></span><h3>{{ feature.title }}</h3><p>{{ feature.description }}</p></article></div>
</div></section></template>
<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { ticketOutline, scanOutline, walletOutline, notificationsOutline, peopleOutline, helpCircleOutline } from 'ionicons/icons';
const features = [
  { icon: ticketOutline, title: 'Digital passenger tickets', description: 'Keep your issued tickets in your account once payment is confirmed.' },
  { icon: scanOutline, title: 'QR check-in and boarding', description: 'Present your QR ticket and passenger ID to the crew at the terminal.' },
  { icon: walletOutline, title: 'Clear fares, counter payment', description: 'Review the fare breakdown, then pay at the ticketing desk before your deadline.' },
  { icon: notificationsOutline, title: 'Sailing and booking updates', description: 'Read trip advisories and reservation notices from your account.' },
  { icon: peopleOutline, title: 'Travel together', description: 'Reserve for up to eight passengers and reuse your saved traveler details.' },
  { icon: helpCircleOutline, title: 'Guidance when you need it', description: 'Find booking, payment, and boarding instructions in the Help page.' },
];
</script>
