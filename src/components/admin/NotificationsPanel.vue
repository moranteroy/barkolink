<template>
  <section class="catalog-panel broadcasts-panel">
    <div class="catalog-tools">
      <p>
        Send in-app notices to passengers, staff, or travelers booked on a
        selected trip.
      </p>
      <Button :disabled="busy || loading" @click="start">
        New notification
      </Button>
    </div>
    <p v-if="error" class="catalog-error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
<IonModal :is-open="editing" :can-dismiss="canDismiss" class="communication-modal broadcast-modal" @didDismiss="dismiss"><section class="communication-dialog broadcast-dialog"><header class="communication-dialog-heading"><div><p class="eyebrow">IN-APP BROADCAST</p><h2>New notification</h2><p>Choose an audience and review before sending.</p></div><button type="button" aria-label="Close notification" :disabled="busy" @click="close"><IonIcon :icon="closeOutline" /></button></header>    <form class="communication-form" @submit.prevent="send">
      <div class="communication-scroll"><fieldset :disabled="busy" class="communication-fields">
      <p v-if="formError" role="alert" class="catalog-error full-field">{{ formError }}</p><p v-if="formNotice" role="status" class="full-field">{{ formNotice }}</p>
      <label
        >Title<input
          v-model.trim="draft.title"
          required
          minlength="3"
          maxlength="120" /></label
      ><label
        >Audience<select v-model="draft.audience">
          <option value="PASSENGERS">Passengers</option>
          <option value="STAFF">Staff</option>
          <option value="ALL">All accounts</option>
          <option value="TRIP">Passengers on a trip</option>
        </select></label
      ><label class="full-field" v-if="draft.audience === 'TRIP'"
        >Trip<select v-model="draft.sailingCode" required>
          <option value="" disabled>Select trip</option>
          <option v-for="s in sailings" :key="s.code" :value="s.code">
            {{ s.code }} · {{ s.origin.name }} → {{ s.destination.name }}
          </option></select
        ><button
          v-if="sailings.length < tripTotal"
          type="button"
          :disabled="busy"
          @click="moreTrips"
        >
          Load older trips
        </button></label
      ><label class="full-field"
        >Message<textarea
          v-model.trim="draft.message"
          rows="3"
          minlength="3"
          maxlength="2000"
          required
        />
      </label>
</fieldset></div><footer class="communication-footer"><Button variant="outline" type="button" :disabled="busy" @click="close">Cancel</Button><Button type="submit" :disabled="busy">{{ busy ? 'Sending...' : 'Review and send' }}</Button></footer></form></section></IonModal>
    <p v-if="loading" role="status">Loading broadcasts...</p>
    <button v-if="error && !loading" type="button" @click="load">Retry loading broadcasts</button>
    <div class="communication-directory"><div class="communication-heading"><div><p class="eyebrow">DELIVERY HISTORY</p><h2>Sent broadcasts</h2></div><Badge>{{ total }} total</Badge></div>
    <div class="broadcast-filters"><label>Search broadcasts<input v-model="table.query.value" type="search" placeholder="Title, message, or audience" /></label><Button variant="ghost" :disabled="!table.query.value" @click="table.query.value = ''">Reset search</Button></div>
    <RecordsGrid v-if="!error" title="Sent broadcasts" :columns="['Title', 'Message', 'Audience', 'Recipients', 'Sent (PH)']" :rows="gridRows" :loading="loading" density="compact" :column-min-widths="[155, 210, 135, 115, 150]" :column-flex="[1.2, 2.2, 1, .75, 1.1]" :max-grid-height="360">
      <template #cell="{ index, value }"><strong v-if="index === 0">{{ value }}</strong><Badge v-else-if="index === 2">{{ value }}</Badge><span v-else>{{ value }}</span></template>
    </RecordsGrid>
    <WorkspacePagination :page="page" :total="total" item-label="broadcasts" :disabled="busy || loading" @change="page = $event; table.query.value = ''; load()" />
    </div>
  </section>
</template>
<script setup lang="ts">
import WorkspacePagination from "../shared/WorkspacePagination.vue";
import { IonModal, IonIcon } from "@ionic/vue";
import { closeOutline } from "ionicons/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import "../../theme/communication.css";
import { confirmAction } from "../../composables/confirmation";
import RecordsGrid from "../shared/RecordsGrid.vue";
import { useTableRecords } from "../../composables/tableRecords";
import { useUnsavedChanges } from "../../composables/unsavedChanges";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { staffDatabase } from "../../services/session";
import {
  campaigns,
  notificationRecipients,
  sendNotification,
  staffTrips,
  type Campaign,
  type WorkspaceTrip,
} from "../../services/database/workspaces";
import { databaseRequestError } from "../../data/databaseErrors";
const rows = ref<Campaign[]>([]),
  sailings = ref<WorkspaceTrip[]>([]),
  editing = ref(false),
  busy = ref(false),
  loading = ref(false),
  error = ref(""),
  notice = ref(""),
  page = ref(0),
  total = ref(0),
  tripPage = ref(0),
  tripTotal = ref(0);
const draft = reactive({
  title: "",
  message: "",
  audience: "PASSENGERS",
  sailingCode: "",
});
const table = useTableRecords(rows);
const formError = ref(''), formNotice = ref('');
const audienceLabel = (value: string) => ({ ALL: 'All accounts', STAFF: 'Staff', PASSENGERS: 'Passengers' }[value] || value);
function dismiss() { editing.value = false; Object.assign(draft, { title: "", message: "", audience: "PASSENGERS", sailingCode: "" }); }
function start() { formError.value = ''; formNotice.value = ''; editing.value = true; }
async function canDismiss() { return !busy.value && (!hasUnsavedChanges() || await confirmAction({ title: 'Discard notification?', message: 'Your unsent notification will be lost.', confirmText: 'Discard changes' })); }
async function close() { if (await canDismiss()) { editing.value = false; Object.assign(draft, { title: '', message: '', audience: 'PASSENGERS', sailingCode: '' }); } }
const hasUnsavedChanges = () => editing.value && !!(draft.title || draft.message || draft.sailingCode || draft.audience !== "PASSENGERS");
useUnsavedChanges(hasUnsavedChanges);
defineExpose({ hasUnsavedChanges });
let requestId = crypto.randomUUID();
watch(draft, () => {
  requestId = crypto.randomUUID();
});
const date = (v: string) =>
  new Date(v).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
const gridRows = computed(() => table.records.value.map(campaign => ({
  key: campaign.id,
  source: campaign,
  cells: [campaign.title, campaign.message, campaign.audience === 'TRIP' ? campaign.sailingCode || 'Trip passengers' : audienceLabel(campaign.audience), campaign.recipientCount, date(campaign.createdAt)],
  sortValues: [campaign.title, campaign.message, campaign.audience === 'TRIP' ? campaign.sailingCode || '' : audienceLabel(campaign.audience), campaign.recipientCount, Date.parse(campaign.createdAt)],
})));
async function load() {
  if (!staffDatabase) return;
  loading.value = true;
  error.value = "";
  try {
    const r = await campaigns(staffDatabase, page.value);
    rows.value = r.data.campaigns;
    total.value = r.data.totalCount;
  } catch (e) {
    error.value = databaseRequestError(
      e,
      "Could not load notification campaigns.",
    );
  } finally {
    loading.value = false;
  }
}
async function moreTrips() {
  if (!staffDatabase) return;
  try {
    const r = await staffTrips(staffDatabase, { page: tripPage.value + 1 });
    sailings.value.push(...r.data.sailings);
    tripPage.value++;
    tripTotal.value = r.data.totalCount;
  } catch (e) {
    formError.value = databaseRequestError(e, "Could not load trips.");
  }
}
async function send() {
  if (!staffDatabase || busy.value) return;
  busy.value = true;
  formError.value = ""; formNotice.value = ""; notice.value = "";
  try {
    const args = {
      ...draft,
      sailingCode: draft.audience === "TRIP" ? draft.sailingCode : undefined,
    };
    const count = (await notificationRecipients(staffDatabase, args)).data
      .recipients;
    if (!count) {
      formNotice.value = "No eligible accounts in this audience.";
      return;
    }
    if (
      !(await confirmAction({
        title: "Send notification?",
        message: `Send "${draft.title}" to ${count} accounts in their BarkoLink inbox?`,
        confirmText: "Send notification",
      }))
    )
      return;
    const r = await sendNotification(staffDatabase, { ...args, requestId });
    notice.value = `Notification sent to ${r.data.sent} accounts.`;
    busy.value = false; editing.value = false;
    Object.assign(draft, { title: "", message: "", audience: "PASSENGERS", sailingCode: "" });
    page.value = 0;
    await load();
  } catch (e) {
    formError.value = databaseRequestError(e, "Could not send notification.");
  } finally {
    busy.value = false;
  }
}
onMounted(async () => {
  await load();
  if (staffDatabase) {
    try {
      const r = await staffTrips(staffDatabase);
      sailings.value = r.data.sailings;
      tripTotal.value = r.data.totalCount;
    } catch (e) {
      error.value = databaseRequestError(e, "Could not load trips.");
    }
  }
});
</script>
<style scoped>
.broadcasts-panel { display: grid; gap: 14px; min-width: 0; color: var(--ink); font-family: var(--ion-font-family); }
.broadcasts-panel > .catalog-tools { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0; }
.catalog-tools p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
.catalog-tools > button { flex: none; }
.broadcasts-panel > p { margin: 0; font-size: 12px; }
.communication-directory { border-radius: 14px; min-width: 0; }
.communication-directory > .communication-heading { padding: 14px 16px; }
.communication-heading h2 { font-size: 17px; }
.communication-heading p { margin-top: 5px; font-size: 11px; }
.broadcast-filters { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
label { display: grid; gap: 7px; min-width: 0; color: var(--muted); font-size: 12px; font-weight: 600; }
.broadcast-filters input, .broadcast-dialog input, .broadcast-dialog select, .broadcast-dialog textarea { box-sizing: border-box; width: 100%; min-width: 0; min-height: 40px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); color: var(--ink); font: inherit; font-size: 12px; }
.broadcast-dialog textarea { min-height: 76px; resize: vertical; line-height: 1.5; }
.broadcasts-panel button, .broadcast-dialog button { min-height: 40px; font-family: inherit; font-size: 12px; }
.communication-directory :deep(.grid-tools) { padding: 8px 16px; border-bottom: 1px solid var(--line); }
.communication-directory :deep(.grid-tools button) { min-height: 34px; padding: 6px 8px; }
.communication-directory :deep(.desktop-grid) { padding: 8px; }
.communication-directory :deep(.grid-cell-content) { font-size: 12px; line-height: 1.5; padding: 7px 0; }
.communication-directory :deep(.workspace-pagination) { padding: 12px 16px; }
.communication-directory :deep(.workspace-pagination button) { min-height: 34px; }
.full-field { grid-column: 1 / -1; }
.broadcast-modal { --width: min(620px, calc(100vw - 32px)); --border-radius: 16px; }
.broadcast-dialog { font-family: var(--ion-font-family); min-height: 0; }
.broadcast-dialog .communication-dialog-heading { padding: 14px 20px; gap: 12px; }
.broadcast-dialog .communication-dialog-heading h2 { font-size: 17px; }
.broadcast-dialog .communication-dialog-heading > button { width: 44px; height: 44px; padding: 0; }
.broadcast-dialog .communication-scroll { padding: 14px 20px; scrollbar-width: thin; }
.broadcast-dialog fieldset { gap: 14px; }
.broadcast-dialog .communication-footer { padding: 12px 20px; background: var(--surface-soft); }
.broadcast-dialog input:focus-visible, .broadcast-dialog select:focus-visible, .broadcast-dialog textarea:focus-visible, .broadcast-filters input:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
@media (max-width: 700px) {
  .broadcasts-panel > .catalog-tools { align-items: flex-start; flex-direction: column; gap: 10px; }
  .communication-directory :deep(.grid-tools) { flex-wrap: wrap; }
}
@media (max-width: 600px) {
  .broadcast-modal { --width: calc(100vw - 24px); }
  .broadcast-dialog .communication-dialog-heading, .broadcast-dialog .communication-scroll { padding: 16px; }
  .broadcast-dialog .communication-footer { padding: 12px 16px; }
  .broadcast-dialog .communication-footer button { flex: 1; min-height: 44px; }
  .broadcast-filters input, .broadcast-dialog input, .broadcast-dialog select, .broadcast-dialog textarea { min-height: 44px; font-size: 16px; }
  .broadcasts-panel button { min-height: 44px; }
}
</style>
