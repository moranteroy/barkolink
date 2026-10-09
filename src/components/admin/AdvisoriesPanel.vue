<template>
  <section class="advisory-panel">
    <header v-if="!embedded">
      <div v-if="!embedded">
        <p class="eyebrow">PASSENGER COMMUNICATION</p>
        <h2>Travel advisories</h2>
        <p>Publish updates for every passenger or for one sailing.</p>
      </div>
      <button v-if="!embedded" :disabled="busy || loading" @click="load">
        <ion-icon :icon="refreshOutline" /> Refresh
      </button>
    </header>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <div class="communication-heading"><div><p class="eyebrow">PASSENGER UPDATES</p><h3>Advisory directory</h3><p>Manage drafts and updates for upcoming travel.</p></div><Button :disabled="busy || loading" @click="start">Create advisory</Button></div>
    <div class="communication-filters"><label>Search advisories<input v-model="query" type="search" placeholder="Title, message, or sailing" /></label><label>Status<select v-model="statusFilter"><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="SCHEDULED">Scheduled</option><option value="DRAFT">Draft</option><option value="ENDED">Ended</option></select></label><Button variant="ghost" @click="query = ''; statusFilter = 'ALL'" :disabled="!query && statusFilter === 'ALL'">Reset filters</Button></div>
    <IonModal :is-open="editing" :can-dismiss="canDismiss" class="communication-modal advisory-modal" @didDismiss="editing = false"><section class="communication-dialog advisory-dialog"><header class="communication-dialog-heading"><div><p class="eyebrow">TRAVEL ADVISORY</p><h2>{{ form.id ? 'Edit advisory' : 'Create advisory' }}</h2><p>Set the audience and publishing period.</p></div><button type="button" aria-label="Close advisory" :disabled="busy" @click="close"><ion-icon :icon="closeOutline" /></button></header>    <form class="communication-form" @submit.prevent="save"><div class="communication-scroll"><fieldset :disabled="busy">
<p v-if="formError" class="error" role="alert">{{ formError }}</p>
      <label
        >Title<input
          v-model.trim="form.title"
          required
          minlength="3"
          maxlength="120" /></label
      ><label
        >Message<textarea
          v-model.trim="form.message"
          required
          minlength="3"
          maxlength="2000"
          rows="3"
        />
      </label>
      <div class="fields advisory-settings">
        <label
          >Type<select v-model="form.category">
            <option
              v-for="type in [
                'WEATHER',
                'PORT',
                'SCHEDULE',
                'SAFETY',
                'GENERAL',
              ]"
              :key="type" :value="type"
            >
              {{ label(type) }}
            </option>
          </select></label
        ><label
          >Priority<select v-model="form.priority">
            <option
              v-for="priority in ['HIGH', 'MEDIUM', 'LOW']"
              :key="priority" :value="priority"
            >
              {{ label(priority) }}
            </option>
          </select></label
        >
      <label
        >Audience<select v-model="form.sailingCode">
          <option value="">All passengers</option>
          <option v-for="s in sailings" :key="s.code" :value="s.code">
            {{ s.code }} · {{ s.origin.name }} → {{ s.destination.name }}
          </option>
        </select></label>
      </div><button
        v-if="sailings.length < sailingTotal"
        type="button"
        :disabled="moreLoading || busy"
        @click="loadMoreSailings"
      >
        {{ moreLoading ? "Loading…" : "Load older sailings" }}
      </button>
      <div class="fields">
        <label
          >Starts (Philippine time)<input
            v-model="form.startsAt"
            type="datetime-local"
            required /></label
        ><label
          >Ends (Philippine time)<input
            v-model="form.endsAt"
            type="datetime-local"
            required
        /></label>
      </div>
      <label class="check"
        ><input v-model="form.published" type="checkbox" /> Publish during this
        period</label
      >
</fieldset></div><footer class="communication-footer"><Button variant="outline" type="button" :disabled="busy" @click="close">Cancel</Button><Button type="submit" :disabled="busy || loading">{{ busy ? 'Saving...' : 'Save advisory' }}</Button></footer></form></section></IonModal>
    <p v-if="loading">Loading advisories…</p>
    <p v-else-if="!items.length">No advisories created yet.</p>
    <p v-if="!loading && items.length" class="communication-count">{{ filteredItems.length }} of {{ items.length }} advisories</p><p v-if="!loading && items.length && !filteredItems.length" class="communication-empty">No advisories match these filters.</p>
    <div v-if="filteredItems.length" class="advisory-list">
      <article v-for="item in filteredItems" :key="item.id">
        <ion-icon
          :icon="item.priority === 'HIGH' ? warningOutline : megaphoneOutline"
        />
        <div>
          <div class="advisory-badges"><Badge :variant="status(item) === 'ACTIVE' ? 'success' : status(item) === 'SCHEDULED' ? 'warning' : 'default'">{{ label(status(item)) }}</Badge><small>{{ label(item.category) }} / {{ label(item.priority) }} priority</small></div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.message }}</p>
          <small
            >{{ item.sailingCode || "All passengers" }} ·
            {{ date(item.startsAt) }} – {{ date(item.endsAt) }} (PH)</small
          >
        </div>
        <button :disabled="busy" :aria-label="`Edit advisory ${item.title}`" @click="edit(item)">Edit</button>
      </article>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { IonIcon, IonModal } from "@ionic/vue";
import {
  closeOutline,
  megaphoneOutline,
  refreshOutline,
  warningOutline,
} from "ionicons/icons";
import {
  adminAdvisories,
  saveAdvisory,
  type Advisory,
} from "../../services/database/experience";
import { adminSailings } from "../../services/database/staff";
import { staffDatabase } from "../../services/session";
import { databaseRequestError } from "../../data/databaseErrors";
import { useUnsavedChanges } from "../../composables/unsavedChanges";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { confirmAction } from '../../composables/confirmation';
import '../../theme/communication.css';
defineProps<{ embedded?: boolean }>();
const editing = ref(false), formError = ref(''), query = ref(''), statusFilter = ref('ALL');
const label = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();
const items = ref<Advisory[]>([]),
  sailings = ref<
    Array<{
      code: string;
      origin: { name: string };
      destination: { name: string };
    }>
  >([]);
const sailingPage = ref(0),
  sailingTotal = ref(0),
  moreLoading = ref(false);
async function loadMoreSailings() {
  if (!staffDatabase || moreLoading.value) return;
  moreLoading.value = true;
  try {
    const result = await adminSailings(staffDatabase, {
      page: sailingPage.value + 1,
      pageSize: 100,
    });
    const seen = new Set(sailings.value.map((s) => s.code));
    sailings.value.push(
      ...result.data.sailings.filter((s) => !seen.has(s.code)),
    );
    sailingPage.value++;
    sailingTotal.value = result.data.totalCount || sailings.value.length;
  } catch (cause) {
    formError.value = databaseRequestError(cause, "Could not load more sailings.");
  } finally {
    moreLoading.value = false;
  }
}
const error = ref(""),
  notice = ref(""),
  busy = ref(false),
  loading = ref(false);
const local = (value: string) =>
  new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0, 16);
const empty = () => ({
  id: "",
  title: "",
  message: "",
  category: "GENERAL",
  priority: "MEDIUM",
  sailingCode: "",
  startsAt: local(new Date().toISOString()),
  endsAt: local(new Date(Date.now() + 86400000).toISOString()),
  published: false,
});
const form = reactive(empty());
let savedForm = JSON.stringify(form);
const hasUnsavedChanges = () => editing.value && JSON.stringify(form) !== savedForm;
useUnsavedChanges(hasUnsavedChanges);
defineExpose({ hasUnsavedChanges });
const date = (value: string) =>
  new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: 'medium', timeStyle: 'short' });
const status = (item: Advisory) =>
  !item.published
    ? "DRAFT"
    : Date.parse(item.endsAt) <= Date.now()
      ? "ENDED"
      : Date.parse(item.startsAt) > Date.now()
        ? "SCHEDULED"
        : "ACTIVE";
const filteredItems = computed(() => items.value.filter(item => (statusFilter.value === 'ALL' || status(item) === statusFilter.value) && [item.title, item.message, item.sailingCode || 'All passengers'].join(' ').toLowerCase().includes(query.value.trim().toLowerCase())));
async function canDismiss() { return !busy.value && (!hasUnsavedChanges() || await confirmAction({ title: 'Discard advisory changes?', message: 'Your unsaved changes will be lost.', confirmText: 'Discard changes' })); }
async function close() { if (await canDismiss()) editing.value = false; }
function start() { reset(); formError.value = ''; editing.value = true; }
function reset() {
  Object.assign(form, empty());
  savedForm = JSON.stringify(form);
}
function edit(item: Advisory) {
  editing.value = true; formError.value = "";
  Object.assign(form, item, {
    sailingCode: item.sailingCode || "",
    startsAt: local(item.startsAt),
    endsAt: local(item.endsAt),
  });
  savedForm = JSON.stringify(form);
  if (
    item.sailingCode &&
    !sailings.value.some((s) => s.code === item.sailingCode)
  )
    sailings.value.push({
      code: item.sailingCode,
      origin: { name: "Existing" },
      destination: { name: "sailing" },
    });
  notice.value = "";
}
async function load() {
  if (!staffDatabase || loading.value) return;
  loading.value = true;
  error.value = "";
  try {
    const [advisories, trips] = await Promise.all([
      adminAdvisories(staffDatabase),
      adminSailings(staffDatabase, { pageSize: 100 }),
    ]);
    items.value = advisories.data.advisories;
    sailings.value = trips.data.sailings;
    sailingPage.value = 0;
    sailingTotal.value = trips.data.totalCount || sailings.value.length;
  } catch (cause) {
    error.value = databaseRequestError(cause, "Could not load advisories.");
  } finally {
    loading.value = false;
  }
}
async function save() {
  if (!staffDatabase || busy.value) return;
  error.value = "";
  notice.value = "";
  formError.value = '';
  const startDate = new Date(`${form.startsAt}:00+08:00`), endDate = new Date(`${form.endsAt}:00+08:00`);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
    formError.value = "End time must be later than start time.";
    return;
  }
  const startsAt = startDate.toISOString(), endsAt = endDate.toISOString();
  busy.value = true;
  try {
    await saveAdvisory(staffDatabase, {
      ...form,
      id: form.id || undefined,
      sailingCode: form.sailingCode || null,
      startsAt,
      endsAt,
    });
    reset();
    busy.value = false; editing.value = false;
    await load();
    notice.value =
      "Advisory saved. Published advisories appear during their effective period.";
  } catch (cause) {
    formError.value = databaseRequestError(cause, "Could not save advisory.");
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<style scoped>
.advisory-panel { display: grid; gap: 14px; min-width: 0; color: var(--ink); font-family: var(--ion-font-family); }
.advisory-panel > header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.communication-heading { padding: 14px 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); gap: 14px; }
.communication-heading h3 { font-size: 17px; }
.communication-heading p { margin-top: 5px; font-size: 12px; }
.eyebrow { color: var(--ocean); font-size: 10px; font-weight: 800; letter-spacing: .1em; }
.communication-filters { display: grid; grid-template-columns: minmax(0, 1fr) 160px auto; gap: 12px; padding: 12px 16px; border-radius: 14px; }
.communication-filters select { min-width: 0; }
.communication-count { font-size: 11px; }
.communication-empty { padding: 24px 16px; font-size: 12px; }
.advisory-panel > p { margin: 0; color: var(--muted); font-size: 12px; }
.advisory-panel > p.error, .error { color: var(--danger, #d85563); }
.advisory-list { display: grid; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); overflow: hidden; }
.advisory-list article { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; align-items: start; gap: 12px; padding: 14px 16px; }
.advisory-list article + article { border-top: 1px solid var(--line); }
.advisory-list article > ion-icon { color: var(--ocean); font-size: 21px; margin-top: 3px; }
.advisory-list article > div { min-width: 0; }
.advisory-badges { gap: 8px; }
.advisory-list h3 { font-size: 14px; line-height: 1.5; margin: 7px 0 4px; overflow-wrap: anywhere; }
.advisory-list p { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; line-height: 1.6; margin: 0 0 7px; }
.advisory-list small { color: var(--muted); font-size: 11px; line-height: 1.6; overflow-wrap: anywhere; }
.advisory-panel button, .advisory-dialog button { min-height: 40px; font-family: inherit; font-size: 12px; }
button:not([data-slot="button"]) { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-soft); color: var(--ocean); font-weight: 600; cursor: pointer; }
.advisory-list button { min-height: 32px; padding: 5px 10px; font-size: 11px; }
button:disabled { opacity: .6; }
label { display: grid; gap: 7px; min-width: 0; color: var(--muted); font-size: 12px; font-weight: 600; }
input:not([type="checkbox"]), select, textarea { width: 100%; min-width: 0; min-height: 40px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); color: var(--ink); font: inherit; font-size: 12px; }
textarea { resize: vertical; line-height: 1.5; }
.fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.advisory-settings { grid-template-columns: .8fr .8fr 1.4fr; }
.advisory-modal { --width: min(640px, calc(100vw - 32px)); --border-radius: 16px; }
.advisory-dialog { min-height: 0; font-family: var(--ion-font-family); }
.advisory-dialog .communication-dialog-heading { padding: 12px 20px; gap: 12px; }
.advisory-dialog .communication-dialog-heading h2 { font-size: 17px; }
.advisory-dialog .communication-dialog-heading > button { width: 44px; height: 44px; padding: 0; flex: none; font-size: 20px; }
.advisory-dialog .communication-scroll { padding: 12px 20px; scrollbar-width: thin; }
.advisory-dialog fieldset { gap: 10px; }
.advisory-dialog .check { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); color: var(--ink); }
.check input { width: 17px; height: 17px; flex: none; margin: 0; accent-color: var(--ocean); }
.advisory-dialog .communication-footer { padding: 12px 20px; background: var(--surface-soft); }
input:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
@media (max-width: 600px) {
  .communication-heading { align-items: flex-start; }
  .communication-filters { grid-template-columns: minmax(0, 1fr); padding: 16px; }
  .advisory-list article { grid-template-columns: 24px minmax(0, 1fr); gap: 10px; }
  .advisory-list article > button { grid-column: 2; justify-self: start; min-height: 44px; }
  .advisory-modal { --width: calc(100vw - 24px); }
  .advisory-dialog .communication-dialog-heading, .advisory-dialog .communication-scroll { padding: 16px; }
  .fields { grid-template-columns: minmax(0, 1fr); }
  input:not([type="checkbox"]), select, textarea { min-height: 44px; font-size: 16px; }
  .advisory-dialog .communication-footer { padding: 12px 16px; }
  .advisory-dialog .communication-footer button { min-height: 44px; flex: 1; }
}
</style>
