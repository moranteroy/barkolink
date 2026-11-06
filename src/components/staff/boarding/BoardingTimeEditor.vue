<template>
  <div class="boarding-time-control">
    <div class="timing-summary">
      <Clock3 :size="17" aria-hidden="true" />
      <div>
        <strong>Boarding starts</strong
        ><span v-if="timing"
          >{{
            timing.effectiveBoardingAt
              ? philippineDateTime(timing.effectiveBoardingAt) + ' (PH)'
              : 'Not configured'
          }}<small>{{
            timing.usesOperatorDefault ? 'Operator default' : 'Trip adjustment'
          }}</small></span
        ><span v-else>{{ loading ? 'Loading boarding time…' : 'Boarding time unavailable' }}</span>
      </div>
    </div>
    <Button v-if="timing?.canEdit" variant="outline" :disabled="disabled || loading" @click="open"
      ><Pencil :size="15" aria-hidden="true" />Adjust time</Button
    >
    <p v-if="error && !editing" role="alert" class="timing-error">
      {{ error }} <Button variant="ghost" :disabled="loading" @click="load">Retry</Button>
    </p>
    <IonModal
      :is-open="editing"
      :can-dismiss="!saving"
      class="boarding-time-modal"
      @didDismiss="close"
    >
      <form class="timing-dialog" novalidate @submit.prevent="save">
        <header>
          <div>
            <p class="eyebrow">THIS TRIP ONLY</p>
            <h2>Adjust boarding time</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            aria-label="Close boarding time editor"
            :disabled="saving"
            @click="close"
            ><X :size="20"
          /></Button>
        </header>
        <div class="timing-body">
          <p class="trip-context">
            <strong>{{ sailingCode }}</strong
            ><span
              >Departure:
              {{ timing ? philippineDateTime(timing.departureAt) : 'Loading…' }} (PH)</span
            >
          </p>
          <p v-if="loading" role="status">Loading current boarding details…</p>
          <p v-if="error" role="alert" class="timing-error">
            {{ error }}
            <Button type="button" variant="ghost" :disabled="loading || saving" @click="load"
              >Reload details</Button
            >
          </p>
          <fieldset :disabled="loading || saving || !timing?.canEdit">
            <label for="boarding-lead">Open boarding before departure</label>
            <div class="lead-input">
              <input
                id="boarding-lead"
                v-model.number="amount"
                type="number"
                :min="unit === 'hours' ? 0.25 : 1"
                :step="unit === 'hours' ? 0.25 : 1"
                :max="unit === 'hours' ? 168 : 10080"
                v-bind="fieldAttrs('boarding-lead')"
              /><select v-model="unit" aria-label="Boarding time unit">
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </select>
            </div>
            <small
              v-if="fieldErrors['boarding-lead']"
              :id="errorId('boarding-lead')"
              class="timing-error"
              >{{ fieldErrors['boarding-lead'] }}</small
            >
            <p v-if="preview" class="timing-preview">
              <Clock3 :size="16" aria-hidden="true" /><span
                >Boarding starts <strong>{{ philippineDateTime(preview) }} (PH)</strong></span
              >
            </p>
            <label for="boarding-reason">Reason for the adjustment</label
            ><textarea
              id="boarding-reason"
              v-model.trim="reason"
              rows="3"
              minlength="5"
              maxlength="500"
              placeholder="Example: Vessel crew confirmed boarding opens one hour before departure."
              v-bind="fieldAttrs('boarding-reason')"
            ></textarea>
            <small
              v-if="fieldErrors['boarding-reason']"
              :id="errorId('boarding-reason')"
              class="timing-error"
              >{{ fieldErrors['boarding-reason'] }}</small
            >
          </fieldset>
          <p class="timing-note">
            Applies to this trip. Your account, reason and previous/new boarding times are recorded
            in Audit Logs. Automatic status updates follow the saved time within a minute.
          </p>
        </div>
        <footer>
          <Button type="button" variant="outline" :disabled="saving" @click="close">Cancel</Button
          ><Button type="submit" :disabled="loading || saving || !timing?.canEdit">{{
            saving ? 'Saving…' : 'Save boarding time'
          }}</Button>
        </footer>
      </form>
    </IonModal>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { IonModal } from '@ionic/vue';
import { Clock3, Pencil, X } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { useFieldErrors } from '@/composables/fieldErrors';
import { notifySuccess } from '@/composables/toast';
import { philippineDateTime } from '@/data/philippineTime';
import { databaseRequestError } from '@/data/databaseErrors';
import { staffDatabase } from '@/services/session';
import {
  boardingSailingTiming,
  setBoardingSailingTiming,
  type BoardingTiming,
} from '@/services/database/sailingStatus';
const props = defineProps<{
  sailingCode: string;
  disabled?: boolean;
  refreshToken?: number | null;
}>();
const emit = defineEmits<{ updated: []; editing: [value: boolean] }>();
const timing = ref<BoardingTiming | null>(null),
  loading = ref(false),
  saving = ref(false),
  editing = ref(false),
  error = ref('');
const amount = ref<number | string>(60),
  unit = ref('minutes'),
  reason = ref('');
const { fieldErrors, fieldAttrs, errorId, clearErrors, showErrors } = useFieldErrors();
const leadMinutes = computed(() => Number(amount.value) * (unit.value === 'hours' ? 60 : 1));
const validLead = computed(
  () => Number.isInteger(leadMinutes.value) && leadMinutes.value >= 1 && leadMinutes.value <= 10080,
);
const preview = computed(() =>
  timing.value && validLead.value
    ? new Date(Date.parse(timing.value.departureAt) - leadMinutes.value * 60000).toISOString()
    : '',
);
let generation = 0;
async function load() {
  const request = ++generation,
    code = props.sailingCode;
  if (!staffDatabase || !code) {
    timing.value = null;
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const result = await boardingSailingTiming(staffDatabase, code);
    if (request === generation && code === props.sailingCode) timing.value = result.data.timing;
  } catch (cause) {
    if (request === generation) {
      timing.value = null;
      error.value = databaseRequestError(cause, 'Could not load boarding time.');
    }
  } finally {
    if (request === generation) loading.value = false;
  }
}
async function open() {
  editing.value = true;
  emit('editing', true);
  reason.value = '';
  clearErrors();
  await load();
  amount.value = timing.value?.effectiveBoardingAt
    ? Math.round(
        (Date.parse(timing.value.departureAt) - Date.parse(timing.value.effectiveBoardingAt)) /
          60000,
      )
    : 60;
  unit.value = 'minutes';
}
function close() {
  if (saving.value) return;
  editing.value = false;
  emit('editing', false);
}
async function save() {
  if (!staffDatabase || saving.value || loading.value || !timing.value?.canEdit) return;
  const errors: Record<string, string> = {};
  if (!validLead.value)
    errors['boarding-lead'] = 'Enter 1 to 10,080 whole minutes (up to 168 hours).';
  else if (timing.value.status === 'BOARDING' && Date.parse(preview.value) > Date.now())
    errors['boarding-lead'] =
      'Boarding has started. Ask Admin to delay or reschedule instead of moving its start into the future.';
  if (reason.value.trim().length < 5 || reason.value.trim().length > 500)
    errors['boarding-reason'] = 'Enter a reason of 5 to 500 characters.';
  clearErrors();
  if (Object.keys(errors).length) {
    await showErrors(errors);
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    const result = await setBoardingSailingTiming(staffDatabase, {
      sailingCode: props.sailingCode,
      boardingAt: preview.value,
      expectedUpdatedAt: timing.value.updatedAt,
      reason: reason.value.trim(),
    });
    timing.value = result.data.timing;
    editing.value = false;
    emit('editing', false);
    emit('updated');
    notifySuccess('Boarding time updated for this trip.');
  } catch (cause) {
    error.value = databaseRequestError(cause, 'Could not save boarding time.');
  } finally {
    saving.value = false;
  }
}
watch(
  () => props.sailingCode,
  () => {
    close();
    timing.value = null;
    void load();
  },
  { immediate: true },
);
watch(
  () => props.refreshToken,
  () => {
    if (!editing.value) void load();
  },
);
onBeforeUnmount(() => {
  generation++;
  emit('editing', false);
});
</script>
<style scoped>
.boarding-time-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  grid-column: 1/-1;
  flex-basis: 100%;
  border-top: 1px solid var(--line);
  padding-top: 12px;
}
.timing-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: var(--ocean);
}
.timing-summary > div {
  min-width: 0;
}
.timing-summary strong,
.timing-summary span {
  display: block;
  font-size: var(--text-label);
  line-height: 1.6;
}
.timing-summary strong {
  color: var(--ink);
}
.timing-summary small {
  margin-left: 8px;
  color: var(--muted);
  font-size: var(--text-caption);
}
.timing-error {
  color: var(--danger);
  font-size: var(--text-label);
  line-height: 1.6;
  width: 100%;
  margin: 0;
}
.boarding-time-modal {
  --width: 520px;
  --height: auto;
  --max-height: 90vh;
  --border-radius: 16px;
}
.timing-dialog {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  background: var(--surface);
  color: var(--ink);
  font-family: var(--ion-font-family);
}
.timing-dialog header,
.timing-dialog footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  flex: none;
}
.timing-dialog header {
  border-bottom: 1px solid var(--line);
}
.timing-dialog footer {
  justify-content: flex-end;
  border-top: 1px solid var(--line);
}
.timing-dialog h2 {
  font-size: 20px;
  margin: 3px 0;
}
.eyebrow {
  color: var(--ocean);
  font-size: var(--text-caption);
  font-weight: 650;
  margin: 0;
}
.timing-body {
  padding: 16px 20px;
  overflow: auto;
}
.trip-context {
  display: grid;
  gap: 4px;
  margin: 0 0 16px;
  overflow-wrap: anywhere;
}
.trip-context span,
.timing-note {
  font-size: var(--text-label);
  line-height: 1.6;
  color: var(--muted);
}
fieldset {
  display: grid;
  gap: 10px;
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
label {
  font-size: var(--text-label);
  font-weight: 600;
}
.lead-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px;
  gap: 10px;
}
input,
select,
textarea {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  background: var(--surface-soft);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px;
  font: inherit;
}
textarea {
  resize: vertical;
}
[aria-invalid='true'] {
  border-color: var(--danger);
}
.timing-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 6px;
  padding: 12px;
  background: var(--light-blue);
  color: var(--ocean);
  border-radius: 8px;
  font-size: var(--text-label);
  line-height: 1.6;
}
.timing-preview strong {
  display: block;
}
.timing-note {
  margin: 16px 0 0;
}
@media (max-width: 600px) {
  .boarding-time-modal {
    --width: calc(100vw - 24px);
  }
  .timing-dialog header,
  .timing-dialog footer,
  .timing-body {
    padding: 14px;
  }
  .timing-dialog footer button {
    flex: 1;
  }
  .timing-summary small {
    display: block;
    margin: 0;
  }
  input,
  select,
  textarea {
    font-size: 16px;
  }
}
</style>
