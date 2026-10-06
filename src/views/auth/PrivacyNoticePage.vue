<template>
  <ion-page
    ><ion-content
      ><main class="privacy-page">
        <RouterLink to="/" class="back-link">← Back to BarkoLink</RouterLink>
        <article class="glass-panel">
          <BrandMark />
          <p class="eyebrow">YOUR INFORMATION</p>
          <h1>Privacy notice</h1>
          <p>
            BarkoLink uses account and passenger information to manage ferry
            reservations, ticketing, check-in, and boarding.
          </p>
          <h2>Information you provide</h2>
          <p>
            Your account includes your name and email address. Reservations
            include each passenger’s name, date of birth, sex, contact number,
            nationality, and passenger category. Booking references, payment
            records, and boarding events are stored with your trip.
          </p>
          <h2>Who can access it</h2>
          <p>
            You can view your own bookings. Authorized admin, ticketing, and
            boarding accounts access the records needed for their work. Discount
            verification records a staff note; do not enter identity document
            numbers in that note.
          </p>
          <h2>Port maps</h2>
          <p>
            Port guides load Google Maps, an external service. They send the
            selected port location to Google. BarkoLink does not send passenger
            details or request your device location for these maps. Opening
            directions takes you to Google Maps, where Google’s own privacy
            controls apply.
          </p>
          <h2>On your device</h2>
          <p>
            The app stores your sign-in session, appearance preference, and trip
            selection on your device. Sign out after using a shared device.
          </p>
          <h2>Help with your records</h2>
          <OperatorContact />
          <p>
            Ask the ferry operator or system administrator about corrections,
            access, or removal of your information.
          </p>
          <RouterLink to="/register" class="return-link"
            >Back to create account →</RouterLink
          >
        </article>
      </main></ion-content
    ></ion-page
  >
</template>
<script setup lang="ts">
import { IonPage, IonContent } from "@ionic/vue";
import { RouterLink } from "vue-router";
import BrandMark from "../../components/shared/BrandMark.vue";
import OperatorContact from "../../components/shared/OperatorContact.vue";
</script>
<style scoped>
.privacy-page {
  max-width: 800px;
  margin: auto;
  padding: 36px 20px 60px;
  color: var(--ink);
}
.back-link,
.return-link {
  display: inline-block;
  color: var(--ocean);
  text-decoration: none;
  font-size: 14px;
  font-weight: 700;
}
.back-link {
  margin-bottom: 24px;
}
article {
  padding: clamp(24px, 5vw, 48px);
  border-radius: 26px;
}
.eyebrow {
  margin-top: 36px;
  color: var(--ocean);
  font-size: 11px;
  letter-spacing: 0.14em;
  font-weight: 800;
}
h1 {
  font-size: 38px;
  letter-spacing: -0.04em;
  margin: 12px 0 20px;
}
h2 {
  font-size: 20px;
  margin: 28px 0 10px;
}
p {
  font-size: 14px;
  line-height: 1.85;
  color: var(--muted);
}
.return-link {
  margin-top: 24px;
}
</style>
