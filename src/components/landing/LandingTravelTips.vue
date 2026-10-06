<template><section class="landing-section landing-container" aria-labelledby="tips-heading"><div class="landing-heading"><span class="section-eyebrow">ARRIVE PREPARED</span><h2 id="tips-heading">A little planning. A smoother trip.</h2><p>Keep these essentials handy before you head to the port.</p></div><div class="landing-grid three-columns"><article v-for="tip in tips" :key="tip.title" class="landing-card travel-tip"><IonIcon :icon="checkmarkCircleOutline" aria-hidden="true" /><h3>{{ tip.title }}</h3><p>{{ tip.description }}</p></article></div><RouterLink class="section-link" to="/help">Visit the Help page <IonIcon :icon="helpCircleOutline" aria-hidden="true" /></RouterLink></section></template>
<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { RouterLink } from 'vue-router';
import { helpCircleOutline, checkmarkCircleOutline } from 'ionicons/icons';
const tips = [
  { title: 'Keep your booking reference', description: 'Use it at the ticketing desk and check the payment deadline in My bookings.' },
  { title: 'Bring passenger identification', description: 'Have your ID and any required discount documents ready for verification.' },
  { title: 'Check your sailing updates', description: 'Review trip advisories and your departure details before traveling to the terminal.' },
];
</script>
