<template>
  <aside class="panel shift-panel ticketing-guide">
    <p class="kicker">AT THE COUNTER</p>
    <h2>Ticketing steps</h2>
    <ol>
      <li>Find the reservation and confirm the passenger details.</li>
      <li>Collect cash, then record payment to issue tickets.</li>
      <li>
        For a passenger without an account, create a walk-in ticket and print
        the receipt.
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
  padding-left: 20px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.55;
}
li::marker {
  color: var(--ocean);
  font-weight: 800;
}
.walk-in-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
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
