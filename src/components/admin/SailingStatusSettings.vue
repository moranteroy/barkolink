<template>
  <section class="status-settings" aria-label="Sailing status configuration">
    <header class="settings-card operator-picker">
      <div class="card-heading">
        <span class="card-icon"><AppIcon :icon="boatOutline" aria-hidden="true" /></span>
        <div><p class="eyebrow">SAILING AUTOMATION</p><h2>Sailing status configuration</h2><p>Choose an operator to set its boarding and completion rules.</p></div>
      </div>
      <div class="operator-control">
        <label for="status-operator">Shipping operator</label>
        <select id="status-operator" :value="operator" :disabled="loading || saving || !loaded" @change="changeOperator"><option value="" disabled>Select operator</option><option v-for="policy in policies" :key="policy.operator" :value="policy.operator">{{ policy.operator }}</option></select>
        <span class="config-status" :class="{ pending: hasUnsavedChanges() }">{{ loading ? 'Loading settings...' : hasUnsavedChanges() ? 'Unsaved changes' : loaded ? 'Saved settings' : 'Settings unavailable' }}</span>
      </div>
    </header>
    <p v-if="error" class="feedback error" role="alert">{{ error }}</p><p v-if="notice" class="feedback success" role="status"><AppIcon :icon="checkmarkCircleOutline" aria-hidden="true" />{{ notice }}</p>
    <Button v-if="!loaded && !loading" variant="outline" @click="load">Retry status settings</Button>
    <form @submit.prevent="save">
      <fieldset :disabled="loading || saving || !loaded">
        <div class="settings-layout">
          <div class="settings-editor">
            <section class="settings-card">
              <div class="card-heading"><span class="card-icon"><AppIcon :icon="timeOutline" aria-hidden="true" /></span><div><h3>Boarding time</h3><p>When passengers can start boarding for {{ operator || 'this operator' }}.</p></div></div>
              <label class="toggle"><input v-model="form.autoBoarding" type="checkbox">Automatically start Boarding</label>
              <div v-if="form.autoBoarding" class="fields">
                <label>Boarding lead time (minutes)<div class="unit-field"><input v-model.number="form.minutes" aria-label="Boarding lead time (minutes)" type="number" min="1" max="10080" step="1" required placeholder="Enter minutes"><span aria-hidden="true">min</span></div><small>Minutes before departure, confirmed by the operator.</small></label>
                <div class="confirmation-field">
                  <label for="boarding-confirmation">Boarding time confirmation <span class="required-label" aria-hidden="true">Required</span></label>
                  <textarea id="boarding-confirmation" v-model.trim="form.source" rows="3" minlength="3" maxlength="500" required aria-label="Boarding time confirmation" aria-describedby="boarding-confirmation-help" placeholder="Example: Terminal supervisor confirmed boarding opens 45 minutes before departure."></textarea>
                  <small id="boarding-confirmation-help">For admin records: enter who confirmed the boarding time and when. The minutes above control when Boarding starts.</small>
                </div>
              </div>
              <p v-if="form.autoBoarding && !validBoarding" class="field-hint">Enter a confirmed time and note before saving.</p>
              <p v-else-if="!form.autoBoarding" class="field-hint">Set the exact boarding start in each trip's editor.</p>
              <p class="card-note"><AppIcon :icon="informationCircleOutline" aria-hidden="true" /><span>A trip's own boarding time takes priority. Check-in deadlines and boarding cutoffs are different from boarding start.</span></p>
            </section>
            <section class="settings-card">
              <div class="card-heading"><span class="card-icon"><AppIcon :icon="checkmarkCircleOutline" aria-hidden="true" /></span><div><h3>Trip completion</h3><p>Choose how trips are marked Completed.</p></div></div>
              <label class="toggle"><input v-model="form.autoComplete" type="checkbox">Automatically mark Completed at scheduled arrival</label>
              <p class="field-hint">{{ form.autoComplete ? 'Uses the saved arrival time. Mark the trip Delayed if its actual schedule changes.' : 'Mark Completed manually in Trips & schedules.' }}</p>
            </section>
          </div>
          <aside class="settings-card status-preview" aria-label="Status preview">
            <div class="preview-heading"><p class="eyebrow">STATUS PREVIEW</p><h3>{{ operator || 'Choose an operator' }}</h3><p>How these rules apply to a trip.</p></div>
            <div class="preview-row"><span>Scheduled<small>Before boarding starts</small></span><strong>Initial status</strong></div>
            <div class="preview-row" :class="{ 'preview-automatic': form.autoBoarding && validBoarding }"><span>Boarding<small>{{ form.autoBoarding ? 'Before departure' : 'Trip-specific boarding time' }}</small></span><strong>{{ form.autoBoarding ? validBoarding ? form.minutes + ' min early' : 'Needs setup' : 'Per trip' }}</strong></div>
            <div class="preview-row"><span>Completed<small>{{ form.autoComplete ? 'At saved arrival time' : 'Admin updates the status' }}</small></span><strong>{{ form.autoComplete ? 'Automatic' : 'Manual' }}</strong></div>
            <p v-if="form.autoBoarding && validBoarding" class="preview-example">{{ example || 'Boarding starts ' + form.minutes + ' minutes before departure.' }}</p>
            <div class="manual-guide"><strong>Delayed &amp; Cancelled</strong><p>Admin updates these in Trip operations. Delayed pauses automation until the trip is rescheduled and resumed.</p><router-link to="/admin/trip-operations">Open Trip operations &rarr;</router-link></div>
          </aside>
        </div>
      </fieldset>
      <footer class="settings-card save-bar"><div><strong>{{ hasUnsavedChanges() ? 'Save changes for ' + operator : 'Status rules for ' + (operator || 'this operator') }}</strong><p>Applies to Scheduled and Boarding trips. Each trip's boarding time takes priority.</p></div><Button type="submit" :disabled="!canSave">{{ saving ? 'Saving...' : 'Save status configuration' }}</Button></footer>
    </form>
  </section>
</template>
<script setup lang="ts">
import { notifyError, notifySuccess } from '@/composables/toast';
import { computed, onMounted, reactive, ref } from 'vue';
import { Button } from '@/components/ui/button';
import AppIcon from '@/components/ui/icon/AppIcon.vue';
import { boatOutline, timeOutline, checkmarkCircleOutline, informationCircleOutline } from 'ionicons/icons';
import { staffDatabase } from '@/services/session';
import { sailingStatusPolicies, saveSailingStatusPolicy, type SailingStatusPolicy } from '@/services/database/sailingStatus';
import { databaseRequestError } from '@/data/databaseErrors';
import { useUnsavedChanges } from '@/composables/unsavedChanges';
import { confirmAction } from '@/composables/confirmation';
const policies = ref<SailingStatusPolicy[]>([]), operator = ref(''), loading = ref(false), saving = ref(false), loaded = ref(false), error = ref(''), notice = ref('');
const form = reactive({ autoBoarding: false, minutes: null as number | null, source: '', autoComplete: true });
let baseline = JSON.stringify(form);
const hasUnsavedChanges = () => loaded.value && JSON.stringify(form) !== baseline;
useUnsavedChanges(hasUnsavedChanges); defineExpose({ hasUnsavedChanges });
const validBoarding = computed(() => typeof form.minutes === 'number' && Number.isInteger(form.minutes) && form.minutes >= 1 && form.minutes <= 10080 && form.source.trim().length >= 3);
const canSave = computed(() => loaded.value && !!operator.value && !loading.value && !saving.value && (!form.autoBoarding || validBoarding.value));
const example = computed(() => {
  if (!validBoarding.value || form.minutes! > 840) return '';
  const minutes = 840 - form.minutes!, hours = Math.floor(minutes / 60);
  return `Example: a 2:00 PM departure starts boarding at ${hours % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}.`;
});
function selectPolicy() {
  const policy = policies.value.find(p => p.operator === operator.value);
  Object.assign(form, { autoBoarding: policy?.boardingLeadMinutes != null, minutes: policy?.boardingLeadMinutes ?? null, source: policy?.boardingTimeSource || '', autoComplete: policy?.autoComplete ?? true });
  baseline = JSON.stringify(form);
}
async function changeOperator(event: Event) {
  const select = event.target as HTMLSelectElement, next = select.value;
  if (hasUnsavedChanges() && !(await confirmAction({ title: 'Discard configuration changes?', message: 'Save your changes before choosing another operator, or discard them.', confirmText: 'Discard changes' }))) { select.value = operator.value; return; }
  operator.value = next; notice.value = ''; error.value = ''; selectPolicy();
}
async function load() {
  if (!staffDatabase) return;
  loading.value = true; error.value = '';
  try { policies.value = (await sailingStatusPolicies(staffDatabase)).data.policies; operator.value ||= policies.value[0]?.operator || ''; selectPolicy(); loaded.value = true; }
  catch (e) { error.value = notifyError(databaseRequestError(e, 'Could not load sailing status settings.')); }
  finally { loading.value = false; }
}
async function save() {
  if (!staffDatabase || !canSave.value) return;
  error.value = ''; notice.value = ''; saving.value = true;
  try { policies.value = (await saveSailingStatusPolicy(staffDatabase, { operator: operator.value, boardingLeadMinutes: form.autoBoarding ? form.minutes : null, boardingTimeSource: form.autoBoarding ? form.source.trim() : null, autoComplete: form.autoComplete })).data.policies; selectPolicy(); notice.value = notifySuccess('Sailing status configuration saved.'); }
  catch (e) { error.value = notifyError(databaseRequestError(e, 'Could not save status configuration.')); }
  finally { saving.value = false; }
}
onMounted(load);
</script>
<style scoped>
.status-settings { display: grid; gap: 16px; margin-top: 24px; color: var(--ink); }
.status-settings, .status-settings * { min-width: 0; }
.settings-card { padding: 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; }
.operator-picker { display: grid; grid-template-columns: minmax(0,1fr) minmax(220px,.8fr); align-items: center; gap: 24px; }
.card-heading { display: flex; align-items: center; gap: 13px; margin-bottom: 16px; }
.operator-picker .card-heading { margin-bottom: 0; }
.card-icon { display: grid; place-items: center; flex: 0 0 36px; height: 36px; border-radius: 10px; background: var(--light-blue); color: var(--ocean); font-size: 19px; }
h2,h3,p { margin: 0; }h2 { font-size: 17px; }h3 { font-size: 15px; letter-spacing: -.02em; }
p,small { color: var(--muted); font-size: var(--text-label); line-height: 1.6; }
.card-heading p:not(.eyebrow),.preview-heading > p:last-child { margin-top: 6px; }
.eyebrow { font-size: var(--text-caption); font-weight: 700; letter-spacing: .08em; margin-bottom: 6px; }
label { display: grid; gap: 7px; font-size: var(--text-label); font-weight: 700; }small { font-size: var(--text-caption); font-weight: 400; }
select,input:not([type=checkbox]) { width: 100%; box-sizing: border-box; min-height: 44px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); color: var(--ink); font: inherit; font-size: 13px; }
.operator-control { display: grid; gap: 8px; }.config-status { color: var(--ocean); font-size: var(--text-caption); }.config-status.pending { color: var(--muted); }
fieldset { border: 0; padding: 0; margin: 0; }
.settings-layout { display: grid; grid-template-columns: minmax(0,1.8fr) minmax(250px,1fr); gap: 16px; align-items: start; }
.settings-editor { display: grid; gap: 16px; }.toggle { display: flex; align-items: center; gap: 9px; font-weight: 500; line-height: 1.5; }
input[type=checkbox] { accent-color: var(--ocean); flex: none; }.fields { display: grid; grid-template-columns: minmax(150px,.75fr) minmax(0,1fr); gap: 16px; margin-top: 20px; }
.unit-field { display: flex; align-items: center; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); }.unit-field input { flex: 1; width: 0; border: 0; background: transparent; font-size: 22px; font-weight: 700; }.unit-field > span { flex: none; white-space: nowrap; padding-right: 14px; color: var(--muted); font-size: var(--text-label); }
.field-hint { margin-top: 12px; font-size: var(--text-caption); }.card-note { display: flex; align-items: flex-start; gap: 9px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); font-size: var(--text-caption); }.card-note .app-icon { flex: none; font-size: 17px; color: var(--ocean); }
.preview-heading { margin-bottom: 14px; }.preview-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--line); }.preview-row > span { font-size: var(--text-label); font-weight: 700; }.preview-row small { display: block; margin-top: 3px; }.preview-row > strong { font-size: var(--text-label); flex-shrink: 0; }.preview-automatic { background: var(--light-blue); padding: 12px; border: 0; border-radius: 10px; }.preview-automatic strong { color: var(--ocean); }.preview-example { margin-top: 14px; font-size: var(--text-caption); }
.manual-guide { border-top: 1px solid var(--line); margin-top: 18px; padding-top: 16px; }.manual-guide > strong { font-size: var(--text-label); }.manual-guide p { margin: 8px 0 12px; font-size: var(--text-caption); }.manual-guide a { color: var(--ocean); font-size: var(--text-label); }
.save-bar { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 16px; padding: 16px 20px; }.save-bar strong { font-size: var(--text-label); }.save-bar p { font-size: var(--text-caption); margin-top: 5px; }.save-bar :deep(button) { flex-shrink: 0; }
.feedback { padding: 12px 16px; border: 1px solid var(--line); border-radius: 10px; }.feedback.error { color: var(--danger); }.feedback.success { display: flex; align-items: center; gap: 8px; color: var(--ocean); }
.confirmation-field { grid-column: 1 / -1; display: grid; gap: 8px; }
.confirmation-field > label { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.required-label { color: var(--muted); font-size: var(--text-caption); font-weight: 400; }
.confirmation-field textarea { width: 100%; box-sizing: border-box; min-height: 92px; padding: 12px; border: 1px solid var(--line); border-radius: 10px; resize: vertical; background: var(--surface-soft); color: var(--ink); font: inherit; font-size: 13px; font-weight: 400; line-height: 1.6; }
.confirmation-field textarea::placeholder { color: var(--muted); opacity: 1; }
select:focus-visible,input:focus-visible,textarea:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
@media(min-width:1151px) { .status-preview { position: sticky; top: 20px; } }
@media(max-width:1100px) { .settings-layout { grid-template-columns: 1fr; }.operator-picker { grid-template-columns: 1fr; gap: 16px; } }
@media(max-width:600px) { .settings-card { padding: 16px; }.fields { grid-template-columns: 1fr; }select,input:not([type=checkbox]),.confirmation-field textarea { font-size: 16px; }.unit-field input { font-size: 22px; }.save-bar { flex-direction: column; align-items: stretch; gap: 14px; } }
</style>
