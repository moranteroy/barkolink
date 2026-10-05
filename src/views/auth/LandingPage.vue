<template>
  <ion-page
    ><ion-content :fullscreen="true"
      ><main class="landing-page">
        <header class="site-header glass-toolbar">
          <RouterLink to="/" aria-label="BarkoLink home"
            ><BrandMark
          /></RouterLink>
          <nav aria-label="Main navigation">
            <a href="#how-it-works" @click.prevent="scrollTo('how-it-works')"
              >How it works</a
            ><a href="#features" @click.prevent="scrollTo('features')"
              >Why BarkoLink</a
            ><a href="#ports" @click.prevent="scrollTo('ports')">Port guide</a>
          </nav>
          <div class="header-actions">
            <RouterLink class="sign-in" to="/login">Sign in</RouterLink
            ><RouterLink class="button button-small" to="/register"
              >Get started
              <ion-icon :icon="arrowForwardOutline" aria-hidden="true"
            /></RouterLink>
          </div>
        </header>
        <section class="hero">
          <div class="hero-copy">
            <p class="eyebrow"><span></span> A BETTER WAY TO CROSS</p>
            <h1>Less waiting.<br />More <em>island time.</em></h1>
            <p class="hero-description">
              Your ferry journey, connected. Find your sailing, reserve your
              seats, and keep every passenger's ticket in one place.
            </p>
            <div class="hero-actions">
              <RouterLink class="button" to="/search"
                >Find a sailing
                <ion-icon
                  :icon="arrowForwardOutline"
                  aria-hidden="true" /></RouterLink
              ><a
                class="button button-outline"
                href="#ports"
                @click.prevent="scrollTo('ports')"
                ><ion-icon :icon="locationOutline" aria-hidden="true" /> Explore
                the ports</a
              >
            </div>
            <div class="hero-benefits">
              <span
                ><ion-icon :icon="checkmarkCircleOutline" aria-hidden="true" />
                Reserve online</span
              ><span
                ><ion-icon :icon="checkmarkCircleOutline" aria-hidden="true" />
                Pay at the terminal</span
              ><span
                ><ion-icon :icon="checkmarkCircleOutline" aria-hidden="true" />
                Board with your QR ticket</span
              >
            </div>
          </div>
          <div class="hero-visual">
            <div class="visual-caption">
              <span class="compass"
                ><ion-icon :icon="navigateOutline" aria-hidden="true" /></span
              ><span
                >Across the water.<br /><strong
                  >Closer to your next adventure.</strong
                ></span
              >
            </div>
            <FerryIllustration />
            <div class="sailing-preview glass-panel">
              <div class="preview-heading">
                <span class="live-dot"></span
                ><span>{{
                  nextSailing ? "UPCOMING SAILING" : "YOUR JOURNEY, CONNECTED"
                }}</span
                ><ion-icon :icon="boatOutline" aria-hidden="true" />
              </div>
              <template v-if="nextSailing"
                ><div class="preview-route">
                  <div>
                    <small>DEPARTURE PORT</small
                    ><strong>{{ nextSailing.origin.name }}</strong>
                  </div>
                  <ion-icon :icon="arrowForwardOutline" aria-hidden="true" />
                  <div>
                    <small>ARRIVAL PORT</small
                    ><strong>{{ nextSailing.destination.name }}</strong>
                  </div>
                </div>
                <div class="preview-footer">
                  <span>{{ formatDeparture(nextSailing.departureAt) }}</span
                  ><strong
                    >From PHP
                    {{ nextSailing.regularFare.toLocaleString() }}</strong
                  >
                </div></template
              ><template v-else
                ><h2>Your next crossing starts here.</h2>
                <p>
                  Choose a route and travel date to find your next available
                  sailing.
                </p>
                <RouterLink to="/search"
                  >Explore sailings
                  <ion-icon
                    :icon="arrowForwardOutline"
                    aria-hidden="true" /></RouterLink
              ></template>
            </div>
          </div>
        </section>
        <section
          id="features"
          class="feature-strip"
          aria-label="BarkoLink features"
        >
          <article v-for="feature in features" :key="feature.title">
            <span class="feature-icon"
              ><ion-icon :icon="feature.icon" aria-hidden="true"
            /></span>
            <div>
              <h2>{{ feature.title }}</h2>
              <p>{{ feature.description }}</p>
            </div>
          </article>
        </section>
        <section id="how-it-works" class="steps-section">
          <div class="section-heading">
            <p class="eyebrow">FROM SHORE TO SHORE</p>
            <h2>A smoother journey.<br />One step at a time.</h2>
            <p>
              Reserve ahead, arrive prepared, and spend more time enjoying the
              crossing.
            </p>
          </div>
          <div class="steps-grid">
            <article v-for="(step, index) in steps" :key="step.title">
              <span class="step-number">0{{ index + 1 }}</span
              ><ion-icon :icon="step.icon" aria-hidden="true" />
              <h3>{{ step.title }}</h3>
              <p>{{ step.description }}</p>
            </article>
          </div>
        </section>
        <section id="ports" class="ports-section">
          <div class="section-heading">
            <p class="eyebrow">YOUR JOURNEY STARTS AT THE PORT</p>
            <h2>A little planning.<br />A better departure.</h2>
            <p>
              Explore port locations on Google Maps and get directions to your
              departure port.
            </p>
          </div>
          <PortLocationMap :ports="mapPorts" />
        </section>
        <section class="start-banner">
          <span class="banner-icon"
            ><ion-icon :icon="boatOutline" aria-hidden="true"
          /></span>
          <div>
            <p class="eyebrow">READY WHEN YOU ARE</p>
            <h2>Your next island is waiting.</h2>
            <p>Create an account and plan your next ferry journey.</p>
          </div>
          <RouterLink class="button" to="/register"
            >Start your journey
            <ion-icon :icon="arrowForwardOutline" aria-hidden="true"
          /></RouterLink>
        </section>
        <footer>
          <RouterLink to="/" aria-label="BarkoLink home"
            ><BrandMark
          /></RouterLink>
          <p>
            A Web and Mobile-Based Ferry Booking<br />and Passenger Management
            System
          </p>
          <div>
            <RouterLink to="/privacy">Privacy notice</RouterLink
            ><RouterLink to="/login"
              >Sign in <ion-icon :icon="arrowForwardOutline" aria-hidden="true"
            /></RouterLink>
          </div>
        </footer></main></ion-content
  ></ion-page>
</template>
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { IonContent, IonIcon, IonPage } from "@ionic/vue";
import { RouterLink } from "vue-router";
import {
  arrowForwardOutline,
  boatOutline,
  checkmarkCircleOutline,
  locationOutline,
  navigateOutline,
  notificationsOutline,
  scanOutline,
  searchOutline,
  ticketOutline,
  walletOutline,
} from "ionicons/icons";
import BrandMark from "../../components/shared/BrandMark.vue";
import FerryIllustration from "../../components/shared/FerryIllustration.vue";
import PortLocationMap from "../../components/shared/PortLocationMap.vue";
import {
  browseActivePorts,
  browseSailings,
} from "../../services/database/passenger";
import { database } from "../../services/session";
import type { MapPort } from "../../data/portMaps";
type SailingPreview = {
  origin: { name: string };
  destination: { name: string };
  departureAt: string;
  regularFare: number;
};
const nextSailing = ref<SailingPreview | null>(null);
const mapPorts = ref<MapPort[]>([
  { id: "calapan-guide", name: "Calapan Port", city: "Calapan" },
  { id: "batangas-guide", name: "Batangas Port", city: "Batangas" },
]);
const features = [
  {
    icon: searchOutline,
    title: "Find the right sailing",
    description: "Choose your route, date, and passenger count.",
  },
  {
    icon: ticketOutline,
    title: "Your tickets, together",
    description: "Keep booking details and passenger QR tickets close.",
  },
  {
    icon: notificationsOutline,
    title: "Stay in the loop",
    description: "See reservation and sailing updates in your account.",
  },
];
const steps = [
  {
    icon: searchOutline,
    title: "Choose your crossing",
    description: "Find an available sailing and enter your passenger details.",
  },
  {
    icon: walletOutline,
    title: "Reserve, then pay",
    description: "Pay at the ticketing desk before your reservation deadline.",
  },
  {
    icon: scanOutline,
    title: "Check in and sail",
    description:
      "Have your issued QR ticket and passenger ID ready for boarding.",
  },
];
const formatDeparture = (value: string) =>
  new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
function scrollTo(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
}
onMounted(async () => {
  if (!database) return;
  const [ports, sailings] = await Promise.allSettled([
    browseActivePorts(database),
    browseSailings(database),
  ]);
  if (ports.status === "fulfilled" && ports.value.data.ports.length)
    mapPorts.value = ports.value.data.ports;
  if (sailings.status === "fulfilled")
    nextSailing.value =
      sailings.value.data.sailings.find((s) => s.availableSeats > 0) || null;
});
</script>
<style scoped>
.landing-page {
  max-width: 1240px;
  margin: auto;
  padding: 22px 38px 0;
  color: var(--ink);
}
.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  padding: 17px 22px;
  border: 1px solid var(--glass-border);
  border-radius: 20px;
}
.site-header > a,
footer > a {
  text-decoration: none;
}
.site-header nav,
.header-actions {
  display: flex;
  align-items: center;
  gap: 26px;
}
.site-header nav a,
.sign-in {
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  color: var(--muted);
}
.site-header nav a:hover,
.sign-in:hover {
  color: var(--ocean);
}
.header-actions {
  gap: 20px;
}
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 52px;
  padding: 0 22px;
  border: 1px solid transparent;
  border-radius: 13px;
  background: var(--action);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
  box-shadow: 0 8px 22px #0875ad22;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}
.button:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 26px #0875ad30;
}
.button-small {
  min-height: 42px;
  padding: 0 17px;
  font-size: 12px;
}
.button-outline {
  border-color: var(--line);
  background: var(--surface);
  color: var(--ink);
  box-shadow: none;
}
.button-outline ion-icon {
  color: var(--ocean);
}
.hero {
  display: grid;
  grid-template-columns: 1fr 1.07fr;
  align-items: center;
  gap: 44px;
  padding: 68px 0 66px;
}
.eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ocean);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.15em;
}
.eyebrow > span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--teal);
}
h1 {
  margin: 22px 0 19px;
  font-size: clamp(45px, 5.2vw, 70px);
  line-height: 1.04;
  letter-spacing: -0.06em;
}
h1 em {
  color: var(--ocean);
  font-style: normal;
}
.hero-description {
  max-width: 410px;
  margin: 0;
  color: var(--muted);
  font-size: 16px;
  line-height: 1.85;
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 28px 0 24px;
}
.hero-benefits {
  display: flex;
  flex-wrap: wrap;
  gap: 11px 18px;
  max-width: 430px;
}
.hero-benefits span {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
}
.hero-benefits ion-icon {
  font-size: 15px;
  color: var(--teal);
}
.hero-visual {
  position: relative;
  height: 460px;
  border: 1px solid var(--glass-border);
  border-radius: 34px;
  background: linear-gradient(155deg, #e9fbfb, #d7eef9);
  box-shadow: var(--card-shadow);
  overflow: hidden;
}
.hero-visual > svg {
  position: absolute;
  inset: 30px -32px auto;
  width: calc(100% + 64px);
  height: 400px;
}
.visual-caption {
  position: absolute;
  z-index: 1;
  top: 24px;
  left: 25px;
  display: flex;
  align-items: center;
  gap: 11px;
  color: #325d70;
  font-size: 11px;
  line-height: 1.6;
}
.visual-caption strong {
  font-size: 12px;
  color: #163e55;
}
.compass {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  background: #ffffffb8;
  border: 1px solid #fff;
  border-radius: 13px;
  color: #087fa0;
  font-size: 20px;
}
.sailing-preview {
  position: absolute;
  z-index: 2;
  bottom: 22px;
  left: 24px;
  right: 24px;
  padding: 20px;
  border: 1px solid var(--glass-border);
  border-radius: 20px;
}
.preview-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
}
.preview-heading > ion-icon {
  margin-left: auto;
  font-size: 18px;
  color: var(--ocean);
}
.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--teal);
}
.preview-route {
  display: grid;
  grid-template-columns: 1fr 22px 1fr;
  align-items: center;
  gap: 12px;
  margin: 19px 0;
}
.preview-route small {
  display: block;
  margin-bottom: 7px;
  font-size: 8px;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: 0.08em;
}
.preview-route strong {
  font-size: 17px;
  letter-spacing: -0.02em;
}
.preview-route > ion-icon {
  color: var(--ocean);
}
.preview-footer {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  font-size: 10px;
  color: var(--muted);
}
.preview-footer strong {
  color: var(--ocean);
}
.sailing-preview h2 {
  margin: 12px 0 8px;
  font-size: 20px;
  letter-spacing: -0.03em;
}
.sailing-preview p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}
.sailing-preview > a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  color: var(--ocean);
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
}
.feature-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
  padding: 23px 0 38px;
  border-bottom: 1px solid var(--line);
}
.feature-strip article {
  display: flex;
  align-items: center;
  gap: 15px;
}
.feature-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 48px;
  height: 48px;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: var(--surface);
  color: var(--ocean);
  font-size: 23px;
}
.feature-strip h2 {
  margin: 0 0 6px;
  font-size: 13px;
}
.feature-strip p {
  margin: 0;
  max-width: 245px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.65;
}
.steps-section {
  display: grid;
  grid-template-columns: 0.85fr 1.5fr;
  gap: 40px;
  padding: 75px 0;
}
.section-heading h2 {
  margin: 14px 0 15px;
  font-size: clamp(28px, 3.3vw, 40px);
  line-height: 1.15;
  letter-spacing: -0.045em;
}
.section-heading > p:last-child {
  max-width: 310px;
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.8;
}
.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.steps-grid article {
  position: relative;
  padding: 24px 20px;
  border: 1px solid var(--line);
  border-radius: 19px;
  background: var(--surface);
  box-shadow: 0 5px 18px #163f5905;
}
.step-number {
  display: block;
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.steps-grid article > ion-icon {
  display: block;
  margin: 24px 0 20px;
  font-size: 27px;
  color: var(--ocean);
}
.steps-grid h3 {
  margin: 0 0 9px;
  font-size: 14px;
}
.steps-grid p {
  margin: 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.8;
}
.ports-section {
  display: grid;
  grid-template-columns: 0.68fr 1.3fr;
  align-items: center;
  gap: 55px;
  padding: 10px 0 78px;
  scroll-margin-top: 30px;
}
.start-banner {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 35px;
  border: 1px solid var(--glass-border);
  border-radius: 24px;
  background: var(--glass-background);
  box-shadow: var(--card-shadow);
}
.banner-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 68px;
  height: 68px;
  border-radius: 20px;
  background: var(--action);
  color: white;
  font-size: 35px;
}
.start-banner h2 {
  margin: 10px 0;
  font-size: 28px;
  letter-spacing: -0.04em;
}
.start-banner p:last-child {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}
.start-banner .button {
  margin-left: auto;
  flex-shrink: 0;
}
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 38px 0 30px;
  margin-top: 25px;
  border-top: 1px solid var(--line);
}
footer > p {
  color: var(--muted);
  font-size: 10px;
  line-height: 1.7;
}
footer > div {
  display: flex;
  gap: 18px;
}
footer > div > a {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--ocean);
  text-decoration: none;
}
@media (max-width: 960px) {
  .landing-page {
    padding: 18px 24px 0;
  }
  .site-header nav {
    gap: 15px;
  }
  .hero {
    gap: 25px;
    padding: 55px 0;
  }
  .hero-visual {
    height: 410px;
  }
  .hero-visual > svg {
    top: 20px;
    height: 350px;
  }
  .steps-section {
    grid-template-columns: 1fr;
    padding: 55px 0;
    gap: 25px;
  }
  .section-heading > p:last-child {
    max-width: 480px;
  }
  .ports-section {
    gap: 28px;
    grid-template-columns: 0.7fr 1.2fr;
  }
  .start-banner {
    padding: 26px;
    gap: 18px;
  }
  .banner-icon {
    display: none;
  }
}
@media (max-width: 700px) {
  .site-header nav {
    display: none;
  }
  .site-header {
    padding: 13px 15px;
    border-radius: 16px;
  }
  .header-actions {
    gap: 13px;
  }
  .hero {
    grid-template-columns: 1fr;
    padding: 42px 0;
    gap: 31px;
  }
  h1 {
    font-size: clamp(46px, 10vw, 68px);
    max-width: 550px;
  }
  .hero-description {
    max-width: 520px;
    font-size: 14px;
  }
  .hero-benefits {
    max-width: none;
  }
  .hero-visual {
    height: 390px;
    max-width: 620px;
  }
  .hero-visual > svg {
    height: 360px;
    top: 5px;
  }
  .feature-strip {
    grid-template-columns: 1fr;
    gap: 22px;
    padding: 0 0 32px;
  }
  .feature-strip p {
    max-width: none;
  }
  .ports-section {
    grid-template-columns: 1fr;
    gap: 25px;
    padding-bottom: 48px;
  }
  .start-banner {
    flex-direction: column;
    align-items: flex-start;
  }
  .start-banner .button {
    margin: 8px 0 0;
  }
  .start-banner h2 {
    font-size: 26px;
  }
  footer {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  footer > p {
    flex-basis: 100%;
    order: 3;
    margin: 0;
  }
}
@media (max-width: 430px) {
  .landing-page {
    padding: 12px 16px 0;
  }
  .site-header :deep(.brand-copy small) {
    display: none;
  }
  .header-actions .sign-in {
    font-size: 11px;
  }
  .button-small {
    padding: 0 11px;
    min-height: 38px;
    font-size: 11px;
  }
  .site-header {
    gap: 10px;
    padding: 12px;
  }
  .site-header :deep(.brand-symbol) {
    width: 32px;
    height: 32px;
    border-radius: 10px;
  }
  .hero h1 {
    font-size: 49px;
  }
  .hero-actions .button {
    padding: 0 16px;
    min-height: 48px;
    font-size: 12px;
  }
  .hero-visual {
    height: 350px;
    border-radius: 24px;
  }
  .visual-caption {
    top: 18px;
    left: 18px;
    font-size: 10px;
  }
  .hero-visual > svg {
    top: 0;
    height: 330px;
  }
  .sailing-preview {
    left: 16px;
    right: 16px;
    bottom: 16px;
    padding: 17px;
  }
  .preview-route strong {
    font-size: 14px;
  }
  .preview-footer {
    font-size: 9px;
  }
  .steps-grid {
    grid-template-columns: 1fr;
  }
  .steps-grid article {
    display: grid;
    grid-template-columns: 35px 1fr;
    column-gap: 14px;
    padding: 20px;
  }
  .step-number {
    grid-column: 2;
  }
  .steps-grid article > ion-icon {
    grid-row: 1/4;
    margin: 0;
    align-self: center;
  }
  .steps-grid h3 {
    grid-column: 2;
    margin: 8px 0;
  }
  .steps-grid p {
    grid-column: 2;
  }
  .section-heading h2 {
    font-size: 31px;
  }
  footer > div {
    gap: 14px;
  }
}
</style>
