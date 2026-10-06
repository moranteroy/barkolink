<template>
  <IonPage>
    <IonContent :fullscreen="true" :scroll-events="true" @ionScroll="scrolled = $event.detail.scrollTop > 24">
      <div class="landing-page">
        <a class="landing-skip" href="#landing-main" @click.prevent="scrollTo('landing-main')">Skip to content</a>
        <LandingNav :scrolled="scrolled" @navigate="scrollTo" />
        <main id="landing-main" tabindex="-1">
          <LandingHero :routes="catalog.routes.length" :vessels="catalog.vessels.length" :loading="loading || !!catalogError" />
          <LandingRoutes :routes="catalog.routes" :loading="loading" :error="catalogError" @retry="loadCatalog" @select="selectRoute" />
          <LandingFeatures />
          <LandingHowItWorks />
          <LandingFleet :vessels="catalog.vessels" :loading="loading" :error="catalogError" @retry="loadCatalog" />
          <LandingTravelTips />
          <section id="ports" class="landing-muted landing-section"><div class="landing-container port-guide"><div class="landing-heading"><span class="section-eyebrow">YOUR DEPARTURE STARTS HERE</span><h2>Know your port</h2><p>Check port locations and get directions before your journey.</p></div><PortLocationMap :ports="mapPorts" /><p v-if="portError" class="landing-note">{{ portError }} <button type="button" class="text-action" @click="loadPorts">Try again</button></p></div></section>
          <LandingCTA />
        </main>
        <footer class="landing-footer landing-container"><RouterLink to="/" aria-label="BarkoLink home"><BrandMark /></RouterLink><p>Travel smarter. Sail easier.</p><nav aria-label="Footer navigation"><RouterLink to="/help">Help</RouterLink><RouterLink to="/privacy">Privacy notice</RouterLink><RouterLink to="/login">Sign in</RouterLink></nav></footer>
      </div>
    </IonContent>
  </IonPage>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { RouterLink, useRouter } from 'vue-router';
import BrandMark from '../../components/shared/BrandMark.vue';
import PortLocationMap from '../../components/shared/PortLocationMap.vue';
import LandingNav from '../../components/landing/LandingNav.vue';
import LandingHero from '../../components/landing/LandingHero.vue';
import LandingRoutes from '../../components/landing/LandingRoutes.vue';
import LandingFeatures from '../../components/landing/LandingFeatures.vue';
import LandingHowItWorks from '../../components/landing/LandingHowItWorks.vue';
import LandingFleet from '../../components/landing/LandingFleet.vue';
import LandingTravelTips from '../../components/landing/LandingTravelTips.vue';
import LandingCTA from '../../components/landing/LandingCTA.vue';
import { browseActivePorts, browseSailings } from '../../services/database/passenger';
import { database } from '../../services/session';
import { landingCatalog, type LandingSailing } from '../../data/landingCatalog';
import { philippineDateKey } from '../../data/travelDate';
import type { MapPort } from '../../data/portMaps';
import '../../theme/landing.css';

const router = useRouter();
const scrolled = ref(false), loading = ref(false), catalogError = ref(''), portError = ref('');
const sailings = ref<LandingSailing[]>([]), mapPorts = ref<MapPort[]>([]);
const catalog = computed(() => landingCatalog(sailings.value));
async function loadCatalog() {
  if (loading.value) return;
  loading.value = true; catalogError.value = '';
  try {
    if (!database) throw new Error('Unavailable');
    sailings.value = (await browseSailings(database)).data.sailings;
  } catch { catalogError.value = 'Could not load upcoming routes. Please try again.'; }
  finally { loading.value = false; }
}
async function loadPorts() {
  portError.value = '';
  try {
    if (!database) throw new Error('Unavailable');
    mapPorts.value = (await browseActivePorts(database)).data.ports;
  } catch { portError.value = 'Port locations are temporarily unavailable.'; }
}
function scrollTo(id: string) {
  const element = document.getElementById(id);
  element?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  const target = element?.querySelector<HTMLElement>('h1, h2') || element;
  if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
}
function selectRoute(sailing: LandingSailing) {
  localStorage.setItem('barkolink-search-route', JSON.stringify({ from: sailing.origin.city, to: sailing.destination.city }));
  localStorage.setItem('barkolink-search-iso-date', philippineDateKey(new Date(sailing.departureAt)));
  localStorage.setItem('barkolink-search-date', new Date(sailing.departureAt).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'Asia/Manila' }));
  localStorage.setItem('barkolink-search-passengers', '1');
  void router.push('/search');
}
onMounted(() => { void loadCatalog(); void loadPorts(); });
</script>
