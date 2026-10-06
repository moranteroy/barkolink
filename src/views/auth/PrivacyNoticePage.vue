<template>
  <IonPage>
    <IonContent :fullscreen="true" class="privacy-content">
      <div class="privacy-page" :class="{ 'profile-privacy': fromProfile, 'registration-privacy': fromRegistration }">
        <PassengerHeader v-if="fromProfile" />
        <header v-else class="privacy-header">
          <RouterLink to="/" class="brand-link" aria-label="BarkoLink home"><BrandMark /></RouterLink>
          <RouterLink to="/help" class="help-link">Help <IonIcon :icon="helpCircleOutline" aria-hidden="true" /></RouterLink>
        </header>
        <main>
          <a v-if="fromProfile" href="/profile" class="back-link" @click="returnToProfile"><IonIcon :icon="personOutline" aria-hidden="true" /> Back to profile</a>
          <RouterLink v-else :to="backLocation" :replace="fromRegistration" class="back-link"><IonIcon :icon="fromRegistration ? personAddOutline : homeOutline" aria-hidden="true" /> {{ fromRegistration ? 'Back to create account' : 'Back to BarkoLink' }}</RouterLink>
          <div class="privacy-intro">
            <span class="privacy-icon"><IonIcon :icon="shieldCheckmarkOutline" aria-hidden="true" /></span>
            <p class="eyebrow">YOUR INFORMATION</p>
            <h1>Privacy notice</h1>
            <p class="intro-copy">How BarkoLink uses your information, who can access it, and where to get help with your records.</p>
            <p v-if="fromRegistration" class="registration-guide"><IonIcon :icon="personAddOutline" aria-hidden="true" /><span>Read this notice before creating your account. Then return to registration to confirm that you have read it.</span></p>
          </div>
          <div class="privacy-layout">
            <aside class="privacy-sidebar">
              <component :is="fromRegistration ? 'details' : 'div'" class="section-index">
              <summary v-if="fromRegistration"><IonIcon :icon="documentTextOutline" aria-hidden="true" /> On this page <IonIcon :icon="chevronDownOutline" class="index-chevron" aria-hidden="true" /></summary>
              <nav class="section-nav" aria-label="On this page">
                <h2>On this page</h2>
                <a v-for="(section, index) in sections" :key="section.id" :href="`#${section.id}`" @click.prevent="jumpTo(section.id)">
                  <span class="nav-number" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>{{ section.title }}
                  <IonIcon :icon="documentTextOutline" aria-hidden="true" />
                </a>
              </nav>
              </component>
              <p class="sidebar-note"><IonIcon :icon="lockClosedOutline" aria-hidden="true" /> Using a shared device? Sign out when you're done.</p>
            </aside>
            <article class="privacy-article" aria-label="BarkoLink privacy notice">
              <p class="notice-summary">BarkoLink uses account and passenger information to manage ferry reservations, ticketing, check-in, and boarding.</p>
              <section v-for="(section, index) in sections" :id="section.id" :key="section.id" :aria-labelledby="`${section.id}-heading`">
                <h2 :id="`${section.id}-heading`" tabindex="-1"><span class="section-number" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>{{ section.title }}</h2>
                <p>{{ section.content }}</p>
                <div v-if="section.id === 'records'" class="contact-panel"><OperatorContact /></div>
              </section>
              <footer class="notice-footer">
                <a v-if="fromProfile" href="/profile" class="return-link" @click="returnToProfile"><IonIcon :icon="personOutline" aria-hidden="true" /> Back to profile</a>
                <template v-else>
                  <RouterLink :to="registrationLocation" :replace="fromRegistration" class="return-link">{{ fromRegistration ? 'Return to registration' : 'Create account' }} <IonIcon :icon="personAddOutline" aria-hidden="true" /></RouterLink>
                  <RouterLink v-if="!fromRegistration" :to="signInLocation" class="sign-in-link">Sign in</RouterLink>
                  <p v-else class="registration-return-note">Your account details are kept when you return. Check the privacy acknowledgement on the registration form to continue.</p>
                </template>
              </footer>
            </article>
          </div>
        </main>
        <footer class="privacy-footer">BarkoLink <span aria-hidden="true">·</span> Travel smarter. Sail easier.</footer>
      </div>
    </IonContent>
  </IonPage>
</template>
<script setup lang="ts">
import { IonPage, IonContent, IonIcon, useIonRouter } from "@ionic/vue";
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { personOutline, homeOutline, documentTextOutline, helpCircleOutline, lockClosedOutline, shieldCheckmarkOutline, personAddOutline, chevronDownOutline } from "ionicons/icons";
import BrandMark from "../../components/shared/BrandMark.vue";
import OperatorContact from "../../components/shared/OperatorContact.vue";
import PassengerHeader from "../../components/passenger/PassengerHeader.vue";

const route = useRoute();
const ionRouter = useIonRouter();
const fromProfile = computed(() => route.query.from === 'profile');
function returnToProfile(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  ionRouter.navigate('/profile', 'back', 'pop');
}
const fromRegistration = computed(() => route.query.from === 'register');
const registrationQuery = computed(() => fromRegistration.value && typeof route.query.redirect === 'string'
  ? { redirect: route.query.redirect } : {});
const registrationLocation = computed(() => ({ path: '/register', query: registrationQuery.value }));
const signInLocation = computed(() => ({ path: '/login', query: registrationQuery.value }));
const backLocation = computed(() => fromRegistration.value ? registrationLocation.value : { path: '/' });

const sections = [
  { id: "information", title: "Information you provide", content: "Your account includes your name and email address. Reservations include each passenger’s name, date of birth, sex, contact number, nationality, and passenger category. Booking references, payment records, and boarding events are stored with your trip." },
  { id: "access", title: "Who can access it", content: "You can view your own bookings. Authorized admin, ticketing, and boarding accounts access the records needed for their work. Discount verification records a staff note; do not enter identity document numbers in that note." },
  { id: "maps", title: "Port maps", content: "Port guides load Google Maps, an external service. They send the selected port location to Google. BarkoLink does not send passenger details or request your device location for these maps. Opening directions takes you to Google Maps, where Google’s own privacy controls apply." },
  { id: "device", title: "On your device", content: "The app stores your sign-in session, appearance preference, and trip selection on your device. Sign out after using a shared device." },
  { id: "records", title: "Help with your records", content: "Ask the ferry operator or system administrator about corrections, access, or removal of your information." },
];
function jumpTo(id: string) {
  const section = document.getElementById(id);
  section?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
  section?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
}
</script>
<style scoped>
.privacy-content { --background: var(--page-background); }
.privacy-page {
  max-width: 1120px;
  margin-inline: auto;
  padding: max(24px, env(safe-area-inset-top)) max(32px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(32px, env(safe-area-inset-left));
  color: var(--ink);
}
.privacy-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 22px; border-bottom: 1px solid var(--line); }
a { color: var(--ocean); text-decoration: none; }
a:focus-visible { outline: 2px solid var(--ocean); outline-offset: 4px; border-radius: 6px; }
.brand-link { display: inline-flex; }
.help-link, .back-link { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; font-size: 13px; font-weight: 600; }
.help-link ion-icon { font-size: 20px; }
.back-link { margin-top: 22px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); color: var(--ink); }
.back-link ion-icon { flex: none; font-size: 19px; color: var(--ocean); }
.back-link:hover, .help-link:hover, .sign-in-link:hover { color: var(--ocean); text-decoration: underline; text-underline-offset: 4px; }
.privacy-intro { max-width: 660px; padding: 28px 0 38px; }
.privacy-icon { display: grid; place-items: center; width: 54px; height: 54px; border: 1px solid var(--line); border-radius: 16px; background: var(--light-blue); color: var(--ocean); font-size: 27px; }
.eyebrow { margin: 24px 0 10px; color: var(--ocean); font-size: 11px; font-weight: 700; letter-spacing: .14em; }
h1 { margin: 0; font-size: clamp(34px, 4vw, 48px); line-height: 1.15; letter-spacing: -.045em; }
.intro-copy { margin: 16px 0 0; max-width: 560px; color: var(--muted); font-size: 16px; line-height: 1.7; }
.privacy-layout { display: grid; grid-template-columns: 250px minmax(0, 1fr); align-items: start; gap: 32px; }
.privacy-sidebar { position: sticky; top: 24px; }
.section-nav { padding: 18px 12px 12px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); }
.section-nav h2 { margin: 0 10px 12px; color: var(--ink); font-size: 13px; font-weight: 700; }
.section-nav a { display: grid; grid-template-columns: 20px minmax(0, 1fr) 14px; align-items: center; gap: 8px; min-height: 48px; padding: 10px; border-radius: 8px; color: var(--muted); font-size: 12px; line-height: 1.5; }
.section-nav a:hover { color: var(--ocean); background: var(--light-blue); }
.nav-number { font-size: 10px; color: var(--ocean); font-weight: 700; }
.sidebar-note { display: flex; align-items: flex-start; gap: 8px; padding: 0 12px; margin: 18px 0 0; color: var(--muted); font-size: 12px; line-height: 1.7; }
.sidebar-note ion-icon { flex: none; font-size: 16px; margin-top: 3px; color: var(--ocean); }
.privacy-article { min-width: 0; padding: 36px; border: 1px solid var(--line); border-radius: 20px; background: var(--surface); box-shadow: 0 8px 30px #102b4c05; }
.notice-summary { margin: 0 0 8px; color: var(--ink); font-size: 15px; line-height: 1.8; }
.privacy-article section { padding-top: 28px; margin-top: 28px; border-top: 1px solid var(--line); scroll-margin-top: 24px; }
.privacy-article h2 { display: flex; align-items: center; gap: 12px; margin: 0 0 14px; color: var(--ink); font-size: 19px; line-height: 1.4; letter-spacing: -.02em; }
.privacy-article h2:focus { outline: none; }
.privacy-article h2:focus-visible { outline: 2px solid var(--ocean); outline-offset: 5px; border-radius: 4px; }
.section-number { display: inline-grid; place-items: center; flex: none; width: 32px; height: 32px; border-radius: 9px; background: var(--light-blue); color: var(--ocean); font-size: 11px; font-weight: 700; letter-spacing: 0; }
.privacy-article section > p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.85; }
.contact-panel { margin-top: 18px; padding: 16px 18px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); overflow-wrap: anywhere; }
.contact-panel :deep(p) { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.8; }
.contact-panel :deep(p + p) { margin-top: 6px; }
.contact-panel :deep(strong) { color: var(--ink); }
.contact-panel :deep(a) { color: var(--ocean); text-underline-offset: 3px; }
.notice-footer { display: flex; align-items: center; flex-wrap: wrap; gap: 12px 24px; margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--line); }
.return-link { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 46px; padding: 12px 18px; border-radius: 10px; background: var(--action); color: #fff; font-size: 13px; font-weight: 650; }
.return-link:hover { filter: brightness(.95); }
.sign-in-link { display: inline-flex; align-items: center; min-height: 44px; font-size: 13px; font-weight: 600; }
.privacy-footer { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 36px; color: var(--muted); font-size: 11px; line-height: 1.6; text-align: center; }
.profile-privacy { padding: max(20px, env(safe-area-inset-top)) 16px max(28px, env(safe-area-inset-bottom)); }
.profile-privacy main { padding: 0 !important; }
.profile-privacy .privacy-intro { padding: 20px 0 24px; }
.profile-privacy h1 { font-size: 30px; }
.profile-privacy .intro-copy { font-size: 14px; line-height: 1.7; }
.profile-privacy .privacy-icon { width: 44px; height: 44px; border-radius: 12px; font-size: 24px; }
.profile-privacy .eyebrow { margin-top: 18px; }
.profile-privacy .privacy-layout { grid-template-columns: minmax(0, 1fr); gap: 18px; }
.profile-privacy .privacy-sidebar { position: static; }
.profile-privacy .section-nav { display: block; padding: 16px 12px 10px; }
.profile-privacy .section-nav a { grid-template-columns: 20px minmax(0, 1fr) 14px; min-height: 44px; }
.profile-privacy .section-nav a ion-icon { display: block; }
.profile-privacy .sidebar-note { display: none; }
.profile-privacy .privacy-article { padding: 22px 18px; border-radius: 16px; }
.profile-privacy .privacy-article h2 { font-size: 17px; gap: 10px; }
.profile-privacy .notice-summary { font-size: 14px; }
.profile-privacy .notice-footer { align-items: stretch; }
.profile-privacy .return-link { width: 100%; }
@media (max-width: 800px) {
  .privacy-layout { grid-template-columns: 1fr; gap: 24px; }
  .privacy-sidebar { position: static; }
  .section-nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 16px 12px 12px; }
  .section-nav h2 { grid-column: 1 / -1; margin-bottom: 6px; }
  .sidebar-note { display: none; }
}
@media (max-width: 480px) {
  .privacy-page { padding: max(18px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left)); }
  .privacy-header { padding-bottom: 16px; }
  .back-link { margin-top: 14px; font-size: 12px; }
  .privacy-intro { padding: 20px 0 26px; }
  .privacy-icon { width: 46px; height: 46px; font-size: 24px; border-radius: 13px; }
  .eyebrow { margin-top: 20px; font-size: 10px; }
  .intro-copy { margin-top: 12px; font-size: 14px; }
  .section-nav a { grid-template-columns: 18px minmax(0, 1fr); gap: 6px; padding: 8px; }
  .section-nav a ion-icon { display: none; }
  .privacy-article { padding: 22px 18px; border-radius: 16px; }
  .notice-summary { font-size: 14px; }
  .privacy-article section { margin-top: 24px; padding-top: 24px; }
  .privacy-article h2 { font-size: 17px; gap: 10px; }
  .privacy-article section > p { line-height: 1.8; }
  .notice-footer { flex-direction: column; align-items: stretch; gap: 8px; }
  .sign-in-link { justify-content: center; }
  .privacy-footer { font-size: 10px; }
}
.registration-privacy { max-width: 820px; }
.registration-privacy .privacy-header { padding-bottom: 16px; }
.registration-privacy .privacy-intro { max-width: none; padding: 24px 0; }
.registration-privacy .privacy-icon { width: 46px; height: 46px; border-radius: 13px; font-size: 24px; }
.registration-privacy .eyebrow { margin: 18px 0 8px; }
.registration-privacy h1 { font-size: clamp(30px, 4vw, 38px); }
.registration-privacy .intro-copy { max-width: none; font-size: 14px; line-height: 1.8; }
.registration-guide { display: flex; align-items: flex-start; gap: 10px; margin: 18px 0 0; padding: 14px 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--light-blue); color: var(--ink); font-size: 12px; line-height: 1.8; }
.registration-guide > ion-icon { flex: none; margin-top: 3px; color: var(--ocean); font-size: 19px; }
.registration-privacy .privacy-layout { grid-template-columns: minmax(0, 1fr); gap: 16px; }
.registration-privacy .privacy-sidebar { position: static; }
.registration-privacy .sidebar-note { display: none; }
.registration-privacy .section-index { border: 1px solid var(--line); border-radius: 12px; background: var(--surface); overflow: hidden; }
.registration-privacy .section-index summary { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 12px 16px; color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer; list-style: none; }
.registration-privacy .section-index summary::-webkit-details-marker { display: none; }
.registration-privacy .section-index summary > ion-icon { flex: none; color: var(--ocean); font-size: 18px; }
.registration-privacy .section-index summary .index-chevron { margin-left: auto; transition: transform .15s; }
.registration-privacy .section-index[open] summary .index-chevron { transform: rotate(180deg); }
.registration-privacy .section-nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 4px 12px 12px; border: 0; border-top: 1px solid var(--line); border-radius: 0; }
.registration-privacy .section-nav h2 { display: none; }
.registration-privacy .section-nav a { min-height: 44px; }
.registration-privacy .privacy-article { padding: 28px; border-radius: 16px; box-shadow: none; }
.registration-privacy .privacy-article h2 { font-size: 18px; }
.registration-privacy .notice-footer { flex-direction: column; align-items: stretch; gap: 12px; }
.registration-return-note { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.8; }
@media (max-width: 480px) {
  .registration-privacy .privacy-article { padding: 22px 18px; }
  .registration-privacy .section-nav { grid-template-columns: minmax(0, 1fr); }
  .registration-privacy .privacy-article h2 { font-size: 17px; }
}
</style>
