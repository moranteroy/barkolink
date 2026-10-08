<template>
  <section class="landing-container landing-guides" aria-labelledby="landing-guides-heading">
    <div class="guides-card">
      <div class="guides-copy">
        <span class="section-eyebrow">MEET YOUR BARKOLINK GUIDES</span>
        <h2 id="landing-guides-heading">A friendly crew.<br />Every step of the way.</h2>
        <p>From choosing your crossing to getting ready at the terminal, meet the guides who make your journey easier.</p>
        <RouterLink to="/help" class="landing-button pale">Explore the travel guide <IonIcon :icon="arrowForwardOutline" aria-hidden="true" /></RouterLink>
        <span class="guide-language">English, Tagalog, o Taglish—welcome aboard.</span>
      </div>
      <div class="guide-pair">
        <article class="guide-profile captain-profile">
          <div class="guide-portrait"><BarkoMascot class="guide-captain" /></div>
          <div class="guide-role"><span class="role-icon"><IonIcon :icon="boatOutline" aria-hidden="true" /></span><h3>Captain</h3><p>Your sailing guide</p></div>
          <span class="role-description">Find routes, schedules, and your next crossing.</span>
          <RouterLink to="/trips?all=1" class="role-action">Find a sailing <IonIcon :icon="arrowForwardOutline" aria-hidden="true" /></RouterLink>
        </article>
        <article class="guide-profile service-profile">
          <div class="guide-portrait"><BarkoMascot character="female" class="guide-captain guide-service" /></div>
          <div class="guide-role"><span class="role-icon"><IonIcon :icon="ticketOutline" aria-hidden="true" /></span><h3>Passenger service</h3><p>Your booking & boarding guide</p></div>
          <span class="role-description">Get help with reservations, payment, and QR tickets.</span>
          <RouterLink to="/help#reserve-sailing" class="role-action">Get booking help <IonIcon :icon="arrowForwardOutline" aria-hidden="true" /></RouterLink>
        </article>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import { arrowForwardOutline, boatOutline, ticketOutline } from 'ionicons/icons';
import BarkoMascot from '../shared/BarkoMascot.vue';
</script>
<style scoped>
.landing-guides { padding-top: 40px; padding-bottom: 16px; }
.guides-card { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); align-items: center; gap: 40px; padding: 36px; border: 1px solid var(--line); border-radius: 24px; background: linear-gradient(120deg, var(--light-blue), var(--surface)); }
.guides-copy h2 { margin: 12px 0 16px; font-size: clamp(26px, 3vw, 38px); line-height: 1.2; letter-spacing: -.035em; }
.guides-copy > p { max-width: 440px; margin: 0 0 22px; color: var(--muted); font-size: 14px; line-height: 1.8; }
.guide-language { display: block; margin-top: 14px; color: var(--muted); font-size: 11px; line-height: 1.6; }
.guide-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.guide-profile { display: flex; align-items: center; flex-direction: column; min-width: 0; padding: 20px 14px 10px; border: 1px solid var(--line); border-radius: 18px; background: var(--surface); text-align: center; }
.guide-portrait { display: flex; align-items: flex-end; justify-content: center; width: 100%; height: 192px; border-radius: 12px; background: radial-gradient(ellipse at center, var(--light-blue), transparent 70%); }
.guide-captain { width: 120px; transform-origin: bottom center; animation: crew-greeting .9s ease-out both; }
.guide-service { animation-delay: .15s; }
.guide-role { margin-top: 12px; }
.role-icon { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 9px; background: var(--light-blue); color: var(--ocean); font-size: 16px; }
.service-profile .role-icon { color: #237f78; background: #329b9217; }
.guide-role h3 { margin: 8px 0 4px; font-size: 15px; line-height: 1.4; }
.guide-role p { min-height: 32px; margin: 0; color: var(--ocean); font-size: 11px; line-height: 1.5; }
.role-description { margin: 10px 0 14px; color: var(--muted); font-size: 11px; line-height: 1.7; }
.role-action { display: flex; justify-content: center; align-items: center; gap: 6px; width: 100%; min-height: 44px; margin-top: auto; border-top: 1px solid var(--line); color: var(--ocean); font-size: 11px; font-weight: 700; line-height: 1.5; }
.role-action:hover { text-decoration: underline; text-underline-offset: 3px; }
@keyframes crew-greeting { 0% { opacity: 0; transform: translateY(10px) rotate(-3deg); } 60% { opacity: 1; transform: translateY(-2px) rotate(2deg); } 100% { opacity: 1; transform: none; } }
@media (max-width: 900px) { .guides-card { grid-template-columns: 1fr; gap: 28px; padding: 28px; } .guides-copy { text-align: center; } .guides-copy > p { margin-inline: auto; } .guide-pair { max-width: 560px; width: 100%; margin-inline: auto; } }
@media (max-width: 520px) { .guides-card { padding: 24px 14px 14px; } .guide-pair { gap: 10px; } .guide-profile { padding: 14px 10px 6px; } .guide-portrait { height: 150px; } .guide-captain { width: 96px; } .guide-role h3 { font-size: 13px; } }
@media (max-width: 380px) { .guides-card { padding-inline: 12px; } .guide-profile { padding-inline: 7px; } .guide-portrait { height: 126px; } .guide-captain { width: 80px; } .guide-role h3 { min-height: 36px; font-size: 12px; } .role-description { font-size: 10px; } .guides-copy .landing-button { padding-inline: 12px; font-size: 13px; } }
@media (prefers-reduced-motion: reduce) { .guide-captain { animation: none; } }
</style>
