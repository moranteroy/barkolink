<template>
  <section class="catalog-panel">
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
<IonModal :is-open="editing" :can-dismiss="canDismiss" class="communication-modal" @didDismiss="dismiss"><section class="communication-dialog"><header class="communication-dialog-heading"><div><p class="eyebrow">IN-APP BROADCAST</p><h2>New notification</h2><p>Choose an audience and review before sending.</p></div><button type="button" aria-label="Close notification" :disabled="busy" @click="close"><IonIcon :icon="closeOutline" /></button></header>    <form class="communication-form" @submit.prevent="send">
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
      ><label v-if="draft.audience === 'TRIP'"
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
          rows="4"
          minlength="3"
          maxlength="2000"
          required
        />
      </label>
</fieldset></div><footer class="communication-footer"><Button variant="outline" type="button" :disabled="busy" @click="close">Cancel</Button><Button type="submit" :disabled="busy">{{ busy ? 'Sending...' : 'Review and send' }}</Button></footer></form></section></IonModal>
    <p v-if="loading" role="status">Loading broadcasts...</p>
    <button v-if="error && !loading" type="button" @click="load">Retry loading broadcasts</button>
    <div class="communication-directory"><div class="communication-heading"><div><p class="eyebrow">DELIVERY HISTORY</p><h2>Sent broadcasts</h2><p>{{ table.records.value.length }} of {{ rows.length }} loaded broadcasts</p></div><Badge>{{ total }} total</Badge></div>
    <TableControls v-model:query="table.query.value" v-model:sort="table.sort.value" :columns="[{ key: 'title', label: 'Title' }, { key: 'recipientCount', label: 'Recipients' }, { key: 'createdAt', label: 'Sent' }]" />
    <div v-if="!loading && !error" class="catalog-table">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Message</th>
            <th>Audience</th>
            <th>Recipients</th>
            <th>Sent</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in table.records.value" :key="c.id">
            <td data-label="Title">
              <strong>{{ c.title }}</strong>
            </td>
            <td data-label="Message">{{ c.message }}</td>
            <td data-label="Audience">
              {{
                c.audience === "TRIP" ? c.sailingCode : audienceLabel(c.audience)
              }}
            </td>
            <td data-label="Recipients">{{ c.recipientCount }}</td>
            <td data-label="Sent">{{ date(c.createdAt) }}</td>
          </tr>
          <tr v-if="!table.records.value.length">
            <td colspan="5">No matching broadcasts.</td>
          </tr>
        </tbody>
      </table>
    </div>
    </div><WorkspacePagination :page="page" :total="total" item-label="broadcasts" :disabled="busy || loading" @change="page = $event; load()" />
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
import TableControls from "../shared/TableControls.vue";
import { useTableRecords } from "../../composables/tableRecords";
import { useUnsavedChanges } from "../../composables/unsavedChanges";
import { onMounted, reactive, ref, watch } from "vue";
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
.full-field {
  grid-column: 1/-1;
}
.catalog-table td:nth-child(2) {
  max-width: 350px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
