<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <main class="landing-page">
        <header class="site-header">
          <BrandMark />
          <nav aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Why BarkoLink</a>
          </nav>
          <div class="header-actions">
            <RouterLink class="sign-in" to="/login">Sign in</RouterLink>
            <RouterLink class="button button-small" to="/register">Get started <ion-icon :icon="arrowForwardOutline" /></RouterLink>
          </div>
        </header>

        <section class="hero">
          <div class="hero-copy">
            <p class="eyebrow"><span></span> FERRY TRAVEL, MADE SIMPLE</p>
            <h1>Your next island journey <em>starts here.</em></h1>
            <p class="hero-description">Find a sailing, reserve seats, and keep your trip details together in one easy place.</p>
            <div class="hero-actions">
              <RouterLink class="button" to="/home">Plan a trip <ion-icon :icon="arrowForwardOutline" /></RouterLink>
              <RouterLink class="button button-outline" to="/role-preview"><ion-icon :icon="eyeOutline" /> Explore the prototype</RouterLink>
            </div>
            <p class="prototype-note"><ion-icon :icon="informationCircleOutline" /> Prototype preview · sample trips and bookings only</p>
          </div>

          <div class="visual-wrap" aria-label="Illustration of a ferry sailing from Calapan to Batangas">
            <div class="sun"></div><div class="island island-back"></div><div class="island island-front"></div>
            <div class="route-line"><span></span><i></i><span></span></div>
            <div class="trip-card">
              <div class="trip-card-top"><span class="live-dot"></span><span>YOUR SAMPLE SAILING</span><ion-icon :icon="ellipsisHorizontalOutline" /></div>
              <div class="route-points"><div><small>FROM</small><strong>Calapan</strong><span>Mindoro</span></div><div class="mini-ship"><ion-icon :icon="boatOutline" /></div><div class="align-right"><small>TO</small><strong>Batangas</strong><span>Luzon</span></div></div>
              <div class="trip-card-bottom"><span><ion-icon :icon="timeOutline" /> 2h 30m</span><b>Passenger ferry</b></div>
            </div>
            <div class="wave wave-one"></div><div class="wave wave-two"></div>
          </div>
        </section>

        <section id="features" class="feature-strip" aria-label="BarkoLink features">
          <article><span class="feature-icon blue"><ion-icon :icon="searchOutline" /></span><div><h2>Find your sailing</h2><p>Browse a clear, simple trip preview.</p></div></article>
          <article><span class="feature-icon mint"><ion-icon :icon="ticketOutline" /></span><div><h2>Keep tickets close</h2><p>Review your reservation in one place.</p></div></article>
          <article><span class="feature-icon gold"><ion-icon :icon="notificationsOutline" /></span><div><h2>Travel with confidence</h2><p>See helpful trip and port information.</p></div></article>
        </section>

        <section id="how-it-works" class="steps-section">
          <div class="section-heading"><p class="eyebrow">A CLEARER WAY TO SAIL</p><h2>From search to boarding, in a few steps.</h2></div>
          <div class="steps-grid"><article><span>01</span><h3>Choose a trip</h3><p>Select your route, date, and passenger count.</p></article><article><span>02</span><h3>Add passenger details</h3><p>Review the sailing and enter traveler information.</p></article><article><span>03</span><h3>Keep your ticket ready</h3><p>See the reservation summary and sample e-ticket.</p></article></div>
        </section>

        <footer><BrandMark /><p>Reserve online, then pay at the ticketing desk before your e-ticket is issued.</p><RouterLink to="/login">Passenger sign in <ion-icon :icon="arrowForwardOutline" /></RouterLink></footer>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonIcon, IonPage } from '@ionic/vue'
import { RouterLink } from 'vue-router'
import { arrowForwardOutline, boatOutline, ellipsisHorizontalOutline, eyeOutline, informationCircleOutline, notificationsOutline, searchOutline, ticketOutline, timeOutline } from 'ionicons/icons'
import BrandMark from '../../components/BrandMark.vue'
</script>

<style scoped>
.landing-page{--hero-ink:var(--ink);max-width:1180px;margin:0 auto;padding:0 36px;color:var(--ink)}.site-header{height:88px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.site-header nav,.header-actions{display:flex;align-items:center;gap:30px}.site-header nav a,.sign-in{color:var(--muted);font-size:13px;font-weight:700;text-decoration:none}.site-header nav a:hover,.sign-in:hover{color:var(--ocean)}.header-actions{gap:22px}.button{display:inline-flex;min-height:52px;align-items:center;justify-content:center;gap:10px;padding:0 21px;border:1px solid var(--ocean);border-radius:12px;background:var(--ocean);color:#fff;text-decoration:none;font-size:13px;font-weight:800;box-shadow:0 10px 24px rgba(21,101,192,.14);transition:transform .18s,filter .18s}.button:hover{transform:translateY(-2px);filter:brightness(1.07)}.button ion-icon{font-size:17px}.button-small{min-height:42px;padding:0 15px;border-radius:10px;font-size:12px}.hero{min-height:500px;display:grid;grid-template-columns:1fr 1.03fr;align-items:center;gap:36px;padding:45px 0 38px}.hero-copy{max-width:515px}.eyebrow{display:flex;align-items:center;gap:8px;margin:0;color:var(--ocean);font-size:10px;font-weight:900;letter-spacing:.13em}.eyebrow>span{width:7px;height:7px;border-radius:50%;background:#20b990}.hero h1{max-width:540px;margin:20px 0 16px;font-size:clamp(42px,5.1vw,67px);line-height:1.02;letter-spacing:-.055em}.hero h1 em{display:block;color:var(--ocean);font-style:normal}.hero-description{max-width:415px;margin:0;color:var(--muted);font-size:16px;line-height:1.7}.hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:27px}.button-outline{background:var(--surface);color:var(--ink);border-color:var(--line);box-shadow:none}.button-outline ion-icon{color:var(--ocean)}.prototype-note{display:flex;align-items:center;gap:7px;margin:19px 0 0;color:var(--muted);font-size:10px}.prototype-note ion-icon{color:var(--ocean);font-size:15px}.visual-wrap{height:386px;position:relative;overflow:hidden;border:1px solid var(--line);border-radius:30px;background:linear-gradient(155deg,var(--surface) 0%,var(--light-blue) 100%)}.sun{position:absolute;top:36px;right:65px;width:112px;height:112px;border-radius:50%;background:#e5b958;opacity:.95}.island{position:absolute;bottom:136px;left:-30px;width:245px;height:102px;border-radius:55% 60% 0 0;background:#5a9d91;transform:rotate(-9deg)}.island-back{left:auto;right:-15px;bottom:146px;width:206px;height:76px;background:#83b9a2;transform:rotate(10deg)}.island-front{bottom:111px;left:-16px;width:230px;height:60px;background:#367f78;opacity:.9}.route-line{position:absolute;left:27%;right:25%;top:48%;height:1px;border-top:2px dashed rgba(21,101,192,.48)}.route-line span{position:absolute;top:-5px;width:9px;height:9px;border:2px solid var(--ocean);border-radius:50%;background:var(--surface)}.route-line span:last-child{right:0}.route-line i{position:absolute;top:-14px;left:47%;font-style:normal}.trip-card{position:absolute;z-index:2;left:8%;right:8%;bottom:30px;padding:17px 19px 14px;border:1px solid var(--line);border-radius:17px;background:var(--surface);box-shadow:0 18px 45px rgba(7,24,44,.14)}.trip-card-top{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:9px;font-weight:900;letter-spacing:.1em}.trip-card-top>ion-icon{margin-left:auto;color:var(--muted);font-size:17px}.live-dot{width:7px;height:7px;border-radius:50%;background:#20b990}.route-points{display:grid;grid-template-columns:1fr 38px 1fr;align-items:center;margin:18px 0 14px}.route-points div{display:grid;gap:4px}.route-points small{color:var(--muted);font-size:8px;font-weight:900;letter-spacing:.1em}.route-points strong{font-size:18px}.route-points span{color:var(--muted);font-size:10px}.align-right{text-align:right}.mini-ship{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;background:var(--light-blue);color:var(--ocean);font-size:21px}.trip-card-bottom{display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:12px;color:var(--muted);font-size:10px}.trip-card-bottom span{display:flex;align-items:center;gap:5px}.trip-card-bottom ion-icon{color:var(--ocean);font-size:14px}.trip-card-bottom b{color:var(--ink)}.wave{position:absolute;bottom:-63px;left:-10%;width:120%;height:130px;border-radius:50% 50% 0 0;background:rgba(83,169,238,.25);transform:rotate(-4deg)}.wave-two{bottom:-82px;left:34%;background:rgba(21,101,192,.19);transform:rotate(5deg)}.feature-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;padding:20px 0 56px;border-bottom:1px solid var(--line)}.feature-strip article{display:flex;align-items:center;gap:14px;padding:18px;border:1px solid var(--line);border-radius:15px;background:var(--surface)}.feature-icon{display:grid;place-items:center;flex:0 0 42px;height:42px;border-radius:12px;font-size:20px}.feature-icon.blue{background:var(--light-blue);color:var(--ocean)}.feature-icon.mint{background:#def7f0;color:#078a72}.feature-icon.gold{background:#fff1d2;color:#b77700}.feature-strip h2{margin:0 0 5px;font-size:13px}.feature-strip p{margin:0;color:var(--muted);font-size:10px;line-height:1.5}.steps-section{padding:58px 0 65px}.section-heading{max-width:500px}.section-heading h2{margin:10px 0 0;font-size:30px;line-height:1.16;letter-spacing:-.04em}.steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:29px}.steps-grid article{padding:18px 0;border-top:1px solid var(--line)}.steps-grid article>span{color:var(--ocean);font-size:10px;font-weight:900;letter-spacing:.1em}.steps-grid h3{margin:13px 0 7px;font-size:16px}.steps-grid p{max-width:270px;margin:0;color:var(--muted);font-size:12px;line-height:1.6}footer{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:20px 0 28px;border-top:1px solid var(--line)}footer :deep(.brand-symbol){width:32px;height:32px;font-size:18px}footer :deep(.brand-copy strong),footer :deep(.brand-copy b){font-size:15px}footer :deep(.brand-copy small){font-size:7px}footer p{margin:0;color:var(--muted);font-size:10px}footer>a{display:flex;align-items:center;gap:6px;color:var(--ocean);font-size:11px;font-weight:800;text-decoration:none}
@media(max-width:820px){.landing-page{padding:0 24px}.site-header nav{gap:17px}.hero{gap:20px;min-height:450px}.hero h1{font-size:clamp(40px,6vw,55px)}.visual-wrap{height:340px}.feature-strip{gap:9px}.feature-strip article{padding:13px;gap:10px}.feature-icon{flex-basis:36px;height:36px}}
@media(max-width:620px){.landing-page{padding:0 18px}.site-header{height:72px}.site-header nav{display:none}.site-header :deep(.brand-copy small){display:none}.header-actions{gap:14px}.sign-in{font-size:12px}.button-small{min-height:38px;padding:0 11px;font-size:11px}.hero{grid-template-columns:1fr;gap:23px;padding:43px 0 28px}.hero h1{max-width:430px;margin-top:15px;font-size:clamp(42px,12vw,58px)}.hero-description{font-size:14px}.hero-actions{gap:9px;margin-top:21px}.hero-actions .button{min-height:47px;padding:0 14px;font-size:11px}.prototype-note{font-size:9px}.visual-wrap{height:310px;border-radius:22px}.sun{top:23px;right:35px;width:84px;height:84px}.island{bottom:116px}.island-back{bottom:123px}.island-front{bottom:94px}.trip-card{left:5%;right:5%;bottom:20px;padding:14px}.route-points strong{font-size:16px}.feature-strip{grid-template-columns:1fr;padding:12px 0 39px}.feature-strip article{padding:14px}.steps-section{padding:42px 0}.section-heading h2{font-size:25px}.steps-grid{grid-template-columns:1fr;gap:8px;margin-top:20px}.steps-grid article{display:grid;grid-template-columns:35px 1fr;column-gap:8px;padding:14px 0}.steps-grid article>span{grid-row:span 2;padding-top:2px}.steps-grid h3{margin:0 0 5px;font-size:14px}.steps-grid p{font-size:11px}footer{align-items:flex-start;flex-direction:column;gap:12px}footer p{order:3;line-height:1.5}}
</style>
