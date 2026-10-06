<template><section id="fleet" class="landing-muted landing-section" aria-labelledby="fleet-heading" :aria-busy="loading"><div class="landing-container">
  <div class="landing-heading"><span class="section-eyebrow">ACROSS THE WATER</span><h2 id="fleet-heading">Meet the fleet</h2><p>Vessels serving our upcoming scheduled sailings.</p></div>
  <div v-if="loading" class="landing-state" role="status">Loading scheduled vessels…</div>
  <div v-else-if="error" class="landing-state">Fleet information is unavailable. <button type="button" class="text-action" @click="emit('retry')">Try again</button></div>
  <p v-else-if="!vessels.length" class="landing-state">Vessels will appear here when new sailings are scheduled.</p>
  <div v-else class="landing-grid three-columns"><article v-for="item in vessels.slice(0, 3)" :key="item.vessel.id" class="landing-card fleet-card"><div class="fleet-visual"><IonIcon :icon="boatOutline" aria-hidden="true" /><span>Upcoming sailings</span><svg viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30 Q100 0 200 30 T400 30 V60 H0Z" fill="currentColor" /></svg></div><div class="fleet-details"><h3>{{ item.vessel.name }}</h3><small>{{ item.vessel.code }}</small><p><IonIcon :icon="peopleOutline" aria-hidden="true" /> {{ item.vessel.passengerCapacity }} passenger capacity</p><span class="fleet-tag">{{ item.routes.size }} scheduled route{{ item.routes.size === 1 ? '' : 's' }}</span></div></article></div>
</div></section></template>
<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { boatOutline, peopleOutline } from 'ionicons/icons';
import type { landingCatalog } from '../../data/landingCatalog';
defineProps<{ vessels: ReturnType<typeof landingCatalog>['vessels']; loading: boolean; error: string }>();
const emit = defineEmits<{ retry: [] }>();
</script>
