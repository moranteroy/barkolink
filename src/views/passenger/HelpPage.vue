<template>
  <ion-page
    ><ion-content
      ><main class="help-page">
        <PassengerHeader />
        <p class="eyebrow">SAIL WITH CONFIDENCE</p>
        <h1>Help & travel guide</h1>
        <p class="intro">
          Your guide to booking and using BarkoLink at the terminal.
        </p>
        <section class="faq">
          <details v-for="item in questions" :key="item.title">
            <summary>
              <ion-icon :icon="item.icon" aria-hidden="true" />{{ item.title }}
            </summary>
            <p>{{ item.answer }}</p>
          </details>
        </section>
        <div class="help-actions">
          <router-link to="/bookings">View my bookings →</router-link
          ><router-link to="/travelers">Manage saved travelers →</router-link
          ><router-link to="/privacy">Privacy notice →</router-link>
        </div>
        <aside>
          <h2>Need help with a trip?</h2>
          <p>
            Contact your ferry operator or visit the terminal ticketing desk.
            Have your booking reference ready. Operator-specific baggage rules
            and arrival requirements should be confirmed with the operator
            before travel.
          </p>
        </aside>
      </main>
      <PassengerBottomNav /></ion-content
  ></ion-page>
</template>
<script setup lang="ts">
import { IonPage, IonContent, IonIcon } from "@ionic/vue";
import {
  boatOutline,
  calendarOutline,
  cashOutline,
  documentTextOutline,
  peopleOutline,
  qrCodeOutline,
  timeOutline,
} from "ionicons/icons";
import PassengerHeader from "../../components/passenger/PassengerHeader.vue";
import PassengerBottomNav from "../../components/passenger/PassengerBottomNav.vue";
const questions = [
  {
    title: "How do I reserve a sailing?",
    icon: calendarOutline,
    answer:
      "Search your route and travel date, select a sailing, complete each passenger’s details, and review the total before confirming. Seats are reserved after the reservation is successfully created.",
  },
  {
    title: "How do I pay?",
    icon: cashOutline,
    answer:
      "Show your booking reference at the ticketing desk and pay in cash before the payment deadline shown in My Bookings. E-tickets become available after staff records payment. BarkoLink currently charges PHP 0 booking fee.",
  },
  {
    title: "What happens when the deadline expires?",
    icon: timeOutline,
    answer:
      "Unpaid reservations expire and their seats are released. The countdown shows the remaining payment time; the database determines the final status. Check My Bookings before making another reservation.",
  },
  {
    title: "How are passenger discounts checked?",
    icon: peopleOutline,
    answer:
      "Select the correct category when booking. Ticketing staff verifies eligibility for discounted fares before accepting payment. Bring the appropriate supporting document. Fares depend on the sailing and discounts are not stacked.",
  },
  {
    title: "How do I use my e-ticket?",
    icon: qrCodeOutline,
    answer:
      "Open My Tickets after payment. Each passenger has a separate QR code. Staff scans or enters the ticket code to check in, then boards the passenger. You can download a copy to keep offline or use Print / Save PDF in a supported browser.",
  },
  {
    title: "Can I cancel or get a refund?",
    icon: documentTextOutline,
    answer:
      "You can cancel an eligible unpaid future reservation in My Bookings. If the operator cancels a paid sailing, the booking may show REFUND PENDING. Visit the ticketing desk for the cash refund; the app records the return of cash and does not transfer money.",
  },
  {
    title: "Where do I find trip changes?",
    icon: boatOutline,
    answer:
      "Check Notifications for booking and sailing updates. Travel advisories appear on the home and search screens; sailing-specific advisories appear in that sailing’s booking flow. A saved ticket copy may be outdated after a trip change, so check your current booking before travel.",
  },
];
</script>
<style scoped>
.help-page {
  max-width: 850px;
  margin: auto;
  padding: 28px 24px 110px;
  color: var(--ink);
}
.eyebrow {
  margin-top: 38px;
  font-size: 10px;
  font-weight: 800;
  color: var(--ocean);
  letter-spacing: 0.1em;
}
h1 {
  margin: 8px 0;
  font-size: 30px;
}
.intro {
  color: var(--muted);
  font-size: 13px;
}
.faq {
  margin: 24px 0;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: var(--surface);
  overflow: hidden;
}
details {
  padding: 18px;
  border-bottom: 1px solid var(--line);
}
details:last-child {
  border-bottom: 0;
}
summary {
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}
summary ion-icon {
  vertical-align: middle;
  margin-right: 10px;
  color: var(--ocean);
  font-size: 19px;
}
details p,
aside p {
  font-size: 13px;
  line-height: 1.8;
  color: var(--muted);
}
.help-actions {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}
.help-actions a {
  font-size: 12px;
  color: var(--ocean);
  font-weight: 700;
  text-decoration: none;
}
aside {
  margin-top: 28px;
  padding: 22px;
  background: var(--light-blue);
  border-radius: 14px;
}
aside h2 {
  font-size: 18px;
  margin: 0;
}
@container passenger (max-width: 600px) {
  .help-page {
    padding: 20px 16px 110px;
  }
}
</style>
