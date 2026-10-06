<template>
  <section class="operations-panel">
    <form @submit.prevent="save">
      <h2>Reservation payment deadline</h2>
      <p>
        Unpaid seats are released after the deadline. Departure time is the
        latest possible deadline. Changes apply to new reservations.
      </p>
      <label
        >Hours to pay
        <input
          v-model.number="hours"
          type="number"
          min="0.083334"
          max="168"
          step="any"
          required
          :disabled="!loaded || loading || saving"
      /></label>
      <button :disabled="!loaded || loading || saving">
        {{ saving ? "Saving..." : "Save deadline" }}
      </button>
      <p v-if="notice" role="status">{{ notice }}</p>
    </form>
    <RouterLink
      class="history-link"
      to="/admin/audit-logs?entityType=operation_settings"
      >View settings history <span aria-hidden="true">&rarr;</span></RouterLink
    >
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <button v-if="!loaded && !loading" type="button" @click="load">Retry loading settings</button>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { staffDatabase } from "../../services/session";
import {
  operationSettings,
  saveOperationSettings,
} from "../../services/database/operations";
import { databaseRequestError } from "../../data/databaseErrors";
const hours = ref(24);
const loaded = ref(false);
const loading = ref(false),
  saving = ref(false),
  error = ref(""),
  notice = ref("");
async function save() {
  if (!staffDatabase || saving.value || !loaded.value || loading.value) return;
  const minutes = Math.round(hours.value * 60);
  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 10080) {
    error.value = "Choose a deadline from 5 minutes to 7 days.";
    return;
  }
  saving.value = true;
  error.value = "";
  notice.value = "";
  try {
    await saveOperationSettings(staffDatabase, minutes);
    hours.value = minutes / 60;
    notice.value = "Payment deadline saved for new reservations.";
  } catch (cause) {
    error.value = databaseRequestError(cause, "Could not save the deadline.");
  } finally {
    saving.value = false;
  }
}
async function load() {
  if (!staffDatabase) { error.value = "Settings are unavailable. Try signing in again."; return; }
  loading.value = true;
  error.value = "";
  loaded.value = false;
  try {
    hours.value =
      (await operationSettings(staffDatabase)).data.reservationMinutes / 60;
    loaded.value = true;
  } catch (cause) {
    error.value = databaseRequestError(cause, "Could not load the deadline.");
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
<style scoped>
.operations-panel {
  display: grid;
  gap: 18px;
}
.operations-panel > form {
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
}
h2 {
  margin-top: 0;
  font-size: 20px;
}
p {
  color: var(--muted);
  line-height: 1.6;
  max-width: 650px;
}
label {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}
input {
  width: 110px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
  color: var(--ink);
}
button {
  margin-top: 18px;
  padding: 12px 18px;
  border: 0;
  border-radius: 9px;
  background: var(--ocean);
  color: white;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
}
.history-link {
  justify-self: start;
  display: flex;
  gap: 12px;
  align-items: center;
  color: var(--ocean);
  font-size: 13px;
  font-weight: 650;
  text-decoration: none;
  padding: 10px 0;
}
.history-link:hover {
  text-decoration: underline;
}
.error {
  color: var(--danger);
}
@media (max-width: 600px) {
  .operations-panel > form {
    padding: 18px;
  }
  h2 {
    font-size: 18px;
  }
  p {
    font-size: 12px;
  }
}
</style>
