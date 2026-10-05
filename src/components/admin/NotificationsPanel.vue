<template>
  <section class="catalog-panel">
    <div class="catalog-tools">
      <p>
        Send in-app notices to passengers, staff, or travelers booked on a
        selected trip.
      </p>
      <button class="primary-button" @click="editing = !editing">
        New notification
      </button>
    </div>
    <p v-if="error" class="catalog-error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <form v-if="editing" class="catalog-form" @submit.prevent="send">
      <h2>New notification</h2>
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
      <div class="catalog-actions">
        <button class="primary-button" :disabled="busy">
          {{ busy ? "Sending…" : "Review and send" }}</button
        ><button type="button" :disabled="busy" @click="editing = false">
          Cancel
        </button>
      </div>
    </form>
    <div class="catalog-table">
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
          <tr v-for="c in rows" :key="c.id">
            <td data-label="Title">
              <strong>{{ c.title }}</strong>
            </td>
            <td data-label="Message">{{ c.message }}</td>
            <td data-label="Audience">
              {{
                c.audience === "TRIP" ? c.sailingCode : c.audience.toLowerCase()
              }}
            </td>
            <td data-label="Recipients">{{ c.recipientCount }}</td>
            <td data-label="Sent">{{ date(c.createdAt) }}</td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="5">No notification campaigns sent yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="catalog-pagination">
      <button
        :disabled="!page || busy"
        @click="
          page--;
          load();
        "
      >
        Previous</button
      ><span>Page {{ page + 1 }} · {{ total }} campaigns</span
      ><button
        :disabled="(page + 1) * 30 >= total || busy"
        @click="
          page++;
          load();
        "
      >
        Next
      </button>
    </div>
  </section>
</template>
<script setup lang="ts">
import { confirmAction } from "../../composables/confirmation";
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
  try {
    const r = await campaigns(staffDatabase, page.value);
    rows.value = r.data.campaigns;
    total.value = r.data.totalCount;
  } catch (e) {
    error.value = databaseRequestError(
      e,
      "Could not load notification campaigns.",
    );
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
    error.value = databaseRequestError(e, "Could not load trips.");
  }
}
async function send() {
  if (!staffDatabase || busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    const args = {
      ...draft,
      sailingCode: draft.audience === "TRIP" ? draft.sailingCode : undefined,
    };
    const count = (await notificationRecipients(staffDatabase, args)).data
      .recipients;
    if (!count) {
      notice.value = "No eligible accounts in this audience.";
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
    editing.value = false;
    page.value = 0;
    await load();
  } catch (e) {
    error.value = databaseRequestError(e, "Could not send notification.");
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
