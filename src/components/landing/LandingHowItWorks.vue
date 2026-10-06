<template><section id="how-it-works" class="landing-section landing-container" aria-labelledby="steps-heading">
  <div class="landing-heading"><span class="section-eyebrow">FROM SEARCH TO SAIL</span><h2 id="steps-heading">How it works</h2><p>Three simple steps to your next crossing.</p></div>
  <ol class="landing-grid three-columns landing-steps"><li v-for="(step, index) in steps" :key="step.title" class="landing-card"><span class="step-number" aria-hidden="true">0{{ index + 1 }}</span><span class="landing-icon filled"><IonIcon :icon="step.icon" aria-hidden="true" /></span><h3>{{ step.title }}</h3><p>{{ step.description }}</p></li></ol>
</section></template>
<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { searchOutline, walletOutline, scanOutline } from 'ionicons/icons';
const steps = [
  { icon: searchOutline, title: 'Search & reserve', description: 'Choose a route and date, sign in, and add your passengers and accommodation.' },
  { icon: walletOutline, title: 'Pay at the counter', description: 'Bring your booking reference to the ticketing desk and pay before the reservation deadline.' },
  { icon: scanOutline, title: 'Check in & board', description: 'After payment confirmation, show your issued QR ticket and ID to the crew for check-in and boarding.' },
];
</script>
