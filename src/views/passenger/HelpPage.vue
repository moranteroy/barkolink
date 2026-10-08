<template>
  <ion-page
    ><ion-content
      ><main ref="helpMain" class="help-page">
        <PassengerHeader />
        <p class="eyebrow">SAIL WITH CONFIDENCE</p>
        <h1>Help & travel guide</h1>
        <p class="intro">
          Your guide to booking and using BarkoLink at the terminal.
        </p>
        <router-link class="mascot-guide" to="/assistant">
          <BarkoMascot />
          <span><small>YOUR BARKOLINK GUIDE</small><strong>Need a hand, passenger?</strong><span>Ask about sailings, bookings, or your QR ticket.</span><b>Ask the assistant <ion-icon :icon="arrowForwardOutline" aria-hidden="true" /></b></span>
        </router-link>
        <section class="faq">
          <details v-for="item in questions" :key="item.title" :id="item.id" tabindex="-1">
            <summary>
              <ion-icon :icon="item.icon" aria-hidden="true" />{{ item.title }}
            </summary>
            <p>{{ item.answer }}</p>
          </details>
        </section>
        <div class="help-actions">
          <router-link to="/bookings"><ion-icon :icon="ticketOutline" aria-hidden="true" /> View my bookings</router-link
          ><router-link to="/travelers"><ion-icon :icon="peopleOutline" aria-hidden="true" /> Manage saved travelers</router-link
          ><router-link to="/privacy"><ion-icon :icon="shieldCheckmarkOutline" aria-hidden="true" /> Privacy notice</router-link>
        </div>
        <aside>
          <h2>Need help with a trip?</h2>
          <OperatorContact />
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
import { ref } from 'vue';
import { useSectionNavigation } from '../../composables/useSectionNavigation';
import {
  boatOutline,
  calendarOutline,
  cashOutline,
  documentTextOutline,
  peopleOutline,
  qrCodeOutline,
  timeOutline,
  ticketOutline,
  shieldCheckmarkOutline,
  arrowForwardOutline,
} from "ionicons/icons";
import PassengerHeader from "../../components/passenger/PassengerHeader.vue";
import OperatorContact from "../../components/shared/OperatorContact.vue";
import PassengerBottomNav from "../../components/passenger/PassengerBottomNav.vue";
import BarkoMascot from "../../components/shared/BarkoMascot.vue";
const questions = [
  {
    id: 'reserve-sailing',
    title: "How do I reserve a sailing?",
    icon: calendarOutline,
    answer:
      "Search your route and travel date, select a sailing, complete each passenger’s details, and review the total before confirming. Seats are reserved after the reservation is successfully created.",
  },
  {
    id: 'payment',
    title: "How do I pay?",
    icon: cashOutline,
    answer:
      "Pay cash at ticketing or choose online payment in My Bookings to pay with GCash, Maya or a credit/debit card through PayMongo. E-tickets appear after payment is confirmed. Discounted passengers must be verified at ticketing first. Choose cash in the payment panel to close any open online checkout before paying at the counter. BarkoLink currently charges PHP 0 booking fee.",
  },
  {
    id: 'payment-deadline',
    title: "What happens when the deadline expires?",
    icon: timeOutline,
    answer:
      "Unpaid reservations expire and their seats are released. The countdown shows the remaining payment time; the database determines the final status. Check My Bookings before making another reservation.",
  },
  {
    id: 'passenger-discounts',
    title: "How are passenger discounts checked?",
    icon: peopleOutline,
    answer:
      "Select the correct category when booking. Ticketing staff verifies eligibility for discounted fares before accepting payment. Bring the appropriate supporting document. Fares depend on the sailing and discounts are not stacked.",
  },
  {
    id: 'e-ticket',
    title: "How do I use my e-ticket?",
    icon: qrCodeOutline,
    answer:
      "Open My Tickets after payment. Each passenger has a separate QR code. Staff scans or enters the ticket code to check in, then boards the passenger. You can download a copy to keep offline or use Print / Save PDF in a supported browser.",
  },
  {
    id: 'cancellation-refunds',
    title: "Can I cancel or get a refund?",
    icon: documentTextOutline,
    answer:
      "You can cancel an eligible unpaid future reservation in My Bookings. If the operator cancels a paid sailing, the booking may show REFUND PENDING. Visit the ticketing desk for the cash refund; the app records the return of cash and does not transfer money.",
  },
  {
    id: 'trip-changes',
    title: "Where do I find trip changes?",
    icon: boatOutline,
    answer:
      "Check Notifications for booking and sailing updates. Travel advisories appear on the home and search screens; sailing-specific advisories appear in that sailing’s booking flow. A saved ticket copy may be outdated after a trip change, so check your current booking before travel.",
  },
];
const helpMain = ref<HTMLElement>();
useSectionNavigation(helpMain, '/help', questions.map(item => `#${item.id}`));
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
.mascot-guide { display: flex; align-items: center; gap: 16px; margin-top: 22px; padding: 16px; border: 1px solid var(--line); border-radius: 16px; background: linear-gradient(135deg, var(--light-blue), var(--surface)); color: var(--ink); text-decoration: none; }
.mascot-guide .barko-mascot { width: 80px; }
.mascot-guide > span { display: grid; gap: 8px; min-width: 0; }
.mascot-guide small { color: var(--ocean); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.mascot-guide strong { font-size: 17px; line-height: 1.4; }
.mascot-guide span > span { color: var(--muted); font-size: 12px; line-height: 1.6; }
.mascot-guide b { display: flex; align-items: center; gap: 6px; color: var(--ocean); font-size: 12px; }
.mascot-guide:hover { border-color: var(--ocean); }
.mascot-guide:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
@container passenger (max-width: 380px) { .mascot-guide { gap: 12px; padding: 12px; } .mascot-guide .barko-mascot { width: 64px; } }
.faq {
  margin: 24px 0;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: var(--surface);
  overflow: hidden;
}
details {
  scroll-margin-top: 16px;
  padding: 18px;
  border-bottom: 1px solid var(--line);
}
details:target { background: var(--light-blue); outline: 2px solid var(--ocean); outline-offset: -2px; }
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
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  font-size: 12px;
  color: var(--ocean);
  font-weight: 700;
  text-decoration: none;
}
.help-actions ion-icon { font-size: 17px; flex: none; }
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
