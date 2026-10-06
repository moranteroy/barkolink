<template>
  <aside class="panel shift-panel ticketing-guide">
    <p class="kicker">AT THE COUNTER</p>
    <h2>Ticketing steps</h2>
    <ol>
      <li><strong>Check the reservation</strong><span>Confirm the sailing, passengers and discount eligibility.</span></li>
      <li><strong>Record cash payment</strong><span>Receive cash, then confirm payment to issue the tickets.</span></li>
      <li>
        <strong>Assist walk-in passengers</strong><span>Create a walk-in ticket and print the receipt for passengers without an account.</span>
      </li>
    </ol>
    <RouterLink to="/staff/ticketing/walk-in" class="walk-in-link"
      ><ion-icon :icon="ticketOutline" /> Issue walk-in ticket</RouterLink
    >
  </aside>
</template>
<script setup lang="ts">
import { RouterLink } from "vue-router";
import { IonIcon } from "@ionic/vue";
import { ticketOutline } from "ionicons/icons";
</script>
<style scoped>
.ticketing-guide {
  gap: 0;
  align-self: start;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: linear-gradient(145deg, var(--surface), var(--surface-soft));
}
.kicker {
  font-size: 10px;
  font-weight: 800;
  color: var(--ocean);
}
h2 {
  margin-bottom: 12px;
}
ol {
  display: grid;
  gap: 14px;
  margin: 4px 0 24px;
  padding: 0;
  list-style: none;
  counter-reset: step;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.55;
}
li { position: relative; padding-left: 36px; counter-increment: step; }
li::before { content: counter(step); position: absolute; left: 0; top: 0; display: grid; place-items: center; width: 25px; height: 25px; border-radius: 8px; background: var(--light-blue); color: var(--ocean); font-size: 11px; font-weight: 650; }
li strong { display: block; color: var(--ink); font-size: 12px; font-weight: 600; line-height: 1.6; }
li span { display: block; margin-top: 5px; font-size: 11px; line-height: 1.8; }
li::marker {
  color: var(--ocean);
  font-weight: 800;
}
.walk-in-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  margin-top: auto;
  padding: 0 12px;
  border-radius: 9px;
  background: var(--ocean);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  text-decoration: none;
}
.walk-in-link:hover {
  filter: brightness(1.08);
}
ion-icon {
  font-size: 16px;
}
@media (max-width: 600px) {
  ol {
    margin-bottom: 18px;
  }
  .walk-in-link {
    width: 100%;
  }
}
</style>
