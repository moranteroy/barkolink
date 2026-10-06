<template>
  <section class="operations-panel">
    <p v-if="loading" class="settings-status" role="status">Loading reservation settings...</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="settings-notice" role="status"><IonIcon :icon="checkmarkCircleOutline" aria-hidden="true" />{{ notice }}</p>
    <Button v-if="!loaded && !loading" variant="outline" type="button" @click="load">Retry loading settings</Button>
    <form @submit.prevent="save">
      <header class="settings-heading"><span class="settings-icon"><IonIcon :icon="timeOutline" aria-hidden="true" /></span><div><p class="eyebrow">PAYMENT WINDOW</p><h2>Reservation payment deadline</h2><p>Set how long passengers have to pay for new reservations.</p></div></header>
      <div class="settings-body">
        <div class="deadline-editor">
          <label for="reservation-hours">Hours to pay<div class="hours-field"><input id="reservation-hours" v-model.number="hours" type="number" min="0.083334" max="168" step="any" required aria-describedby="deadline-hint" :disabled="!loaded || loading || saving" /><span aria-hidden="true">hours</span></div></label>
          <p id="deadline-hint" class="field-hint">Choose from 5 minutes to 7 days. Fractions of an hour are allowed.</p>
          <div class="deadline-presets" role="group" aria-label="Common payment deadlines"><Button v-for="value in [1, 6, 24, 48]" :key="value" variant="outline" size="sm" type="button" :aria-pressed="hours === value" :disabled="!loaded || loading || saving" @click="hours = value">{{ value }} hours</Button></div>
        </div>
        <aside class="deadline-preview"><p class="eyebrow">DEADLINE PREVIEW</p><strong>{{ !loaded || loading ? 'Loading...' : deadlinePreview }}</strong><p>After booking, payment is due within this window or by departure time, whichever comes first.</p></aside>
        <p class="deadline-note"><IonIcon :icon="informationCircleOutline" aria-hidden="true" /><span>Unpaid seats are released after the deadline. Existing reservations keep their saved payment deadlines.</span></p>
      </div>
      <footer class="settings-footer"><span>Changes apply to new reservations.</span><Button type="submit" :disabled="!loaded || loading || saving">{{ saving ? 'Saving...' : 'Save deadline' }}</Button></footer>
    </form>
    <RouterLink class="history-link" to="/admin/audit-logs?entityType=operation_settings"><span class="history-icon"><IonIcon :icon="documentTextOutline" aria-hidden="true" /></span><span><strong>View settings history</strong><small>Review who changed the payment deadline and when.</small></span><IonIcon :icon="chevronForwardOutline" aria-hidden="true" /></RouterLink>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { IonIcon } from "@ionic/vue";
import { checkmarkCircleOutline, chevronForwardOutline, documentTextOutline, informationCircleOutline, timeOutline } from "ionicons/icons";
import { staffDatabase } from "../../services/session";
import {
  operationSettings,
  saveOperationSettings,
} from "../../services/database/operations";
import { databaseRequestError } from "../../data/databaseErrors";
import { Button } from '@/components/ui/button';
const hours = ref(24);
const deadlinePreview = computed(() => {
  const minutes = Math.round(hours.value * 60);
  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 10080) return 'Choose a valid deadline';
  const wholeHours = Math.floor(minutes / 60), remainder = minutes % 60;
  return [wholeHours ? `${wholeHours} ${wholeHours === 1 ? 'hour' : 'hours'}` : '', remainder ? `${remainder} ${remainder === 1 ? 'minute' : 'minutes'}` : ''].filter(Boolean).join(' ');
});
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
  if (loading.value || saving.value) return;
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
.operations-panel { display:grid; gap:20px; min-width:0; }
.operations-panel > form { border:1px solid var(--line); border-radius:16px; background:var(--surface); overflow:hidden; }
.settings-heading { display:flex; align-items:center; gap:16px; padding:24px; border-bottom:1px solid var(--line); }
.settings-icon,.history-icon { display:grid; place-items:center; flex:none; width:44px; height:44px; border-radius:12px; background:var(--light-blue); color:var(--ocean); font-size:24px; }
h2 { margin:0; font-size:19px; color:var(--ink); }
p { color:var(--muted); font-size:12px; line-height:1.7; }
.settings-heading p:last-child { margin:7px 0 0; }
.eyebrow { color:var(--ocean); font-size:10px; letter-spacing:.1em; font-weight:800; margin:0 0 7px; }
.settings-body { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:24px; padding:24px; }
label { display:grid; gap:9px; font-size:12px; font-weight:600; color:var(--ink); }
.hours-field { display:flex; align-items:center; gap:12px; border:1px solid var(--line); border-radius:10px; background:var(--surface-soft); padding:0 14px; }
.hours-field input { width:100%; min-width:0; height:52px; padding:12px 0; border:0; background:transparent; color:var(--ink); font:inherit; font-size:22px; font-weight:700; }
.hours-field:focus-within { outline:2px solid var(--ocean); outline-offset:2px; }
.hours-field input:focus { outline:none; }
.hours-field > span { color:var(--muted); font-size:12px; font-weight:400; }
.field-hint { margin:10px 0 14px; font-size:11px; }
.deadline-presets { display:flex; gap:8px; flex-wrap:wrap; }
.deadline-presets button[aria-pressed="true"] { background:var(--light-blue); color:var(--ocean); border-color:var(--ocean); }
.deadline-preview { padding:20px; border:1px solid var(--line); border-radius:12px; background:var(--surface-soft); }
.deadline-preview strong { display:block; font-size:24px; color:var(--ink); }
.deadline-preview p:last-child { margin:10px 0 0; }
.deadline-note { grid-column:1/-1; display:flex; align-items:start; gap:10px; padding:14px; margin:0; border:1px solid var(--line); border-radius:10px; }
.deadline-note ion-icon { color:var(--ocean); font-size:18px; flex:none; margin-top:2px; }
.settings-footer { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:18px 24px; border-top:1px solid var(--line); }
.settings-footer > span { color:var(--muted); font-size:11px; }
.settings-status,.error,.settings-notice { padding:14px 18px; margin:0; border:1px solid var(--line); border-radius:10px; background:var(--surface); }
.error { color:#bd3b45; border-color:#bd3b4533; }
.settings-notice { display:flex; align-items:center; gap:9px; color:var(--ocean); }
.history-link { display:flex; align-items:center; gap:14px; padding:20px; border:1px solid var(--line); border-radius:14px; background:var(--surface); color:var(--ocean); text-decoration:none; }
.history-link > span:nth-child(2) { flex:1; min-width:0; }
.history-link strong { font-size:13px; }
.history-link small { display:block; color:var(--muted); font-size:11px; margin-top:6px; line-height:1.6; }
.history-link:hover { border-color:var(--ocean); }
.history-link > ion-icon { flex:none; }
@media(max-width:600px) { .settings-heading,.settings-body { padding:18px; } .settings-body { grid-template-columns:1fr; gap:18px; } .settings-heading { align-items:start; } .settings-footer { padding:16px 18px; flex-wrap:wrap; } .history-link { padding:18px; } h2 { font-size:17px; } }
</style>
