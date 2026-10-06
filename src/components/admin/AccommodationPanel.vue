<template>
  <section class="accommodation-workspace">
    <p v-if="error" role="alert" class="catalog-error">{{ error }}</p>
    <button v-if="error && !loading && !busy" type="button" @click="load">Retry loading accommodations</button>
    <p v-if="notice" role="status">{{ notice }}</p>
    <IonModal :is-open="editing" :can-dismiss="canDismiss" class="accommodation-modal" @didDismiss="editing = false">
      <div class="accommodation-dialog">
        <header class="dialog-heading"><span class="dialog-symbol"><IonIcon :icon="bedOutline" aria-hidden="true" /></span><div><p class="eyebrow">VESSEL ACCOMMODATION</p><h2>{{ form.id ? 'Edit accommodation' : 'Add accommodation' }}</h2><p class="dialog-subtitle">Set the seating class, capacity, and extra fare.</p></div><button type="button" class="dialog-close" aria-label="Close dialog" :disabled="busy" @click="close"><IonIcon :icon="closeOutline" aria-hidden="true" /></button></header>
        <p v-if="formError" role="alert" class="form-error">{{ formError }}</p>
    <form class="accommodation-form" @submit.prevent="save">
      <div class="accommodation-scroll">
      <fieldset class="accommodation-fields" :disabled="busy">
        <p class="form-note">Vessel, class name, capacity, and extra fare are required.</p>
        <div class="accommodation-field-grid">
      <label
        >Vessel<select
          v-model="form.vesselId"
          required
          :disabled="!!form.id || busy"
        >
          <option value="" disabled>Select vessel</option>
          <option v-for="v in vessels" :key="v.id" :value="v.id">
            {{ v.name }} · {{ v.passengerCapacity }} seats
          </option>
        </select></label
      ><label
        >Class name<input
          v-model.trim="form.name"
          required
          maxlength="60"
          placeholder="Economy, Tourist, Business…" /></label
      ><label class="description-field"
        >Description (optional)<textarea
          v-model.trim="form.description"
          maxlength="500" rows="3" placeholder="Describe the seating and amenities." /></label
      ><label
        >Class capacity<input
          v-model.number="form.capacity"
          type="number"
          min="1"
          :max="form.isActive ? remainingCapacity || 1 : undefined"
          required /></label
      ><label
        >Extra fare per passenger (PHP)<input
          v-model.number="form.surcharge"
          type="number"
          min="0"
          max="1000000"
          required
        /><small
          >Added after the passenger's base-fare discount. Set 0 for no extra
          charge.</small
        ></label
      ></div>
      <p v-if="form.vesselId" class="capacity-note"><IonIcon :icon="peopleOutline" aria-hidden="true" /><span><strong>{{ remainingCapacity }} seats available to allocate</strong><small>Capacity already assigned to other active classes is excluded.</small></span></p>
      <label class="accommodation-availability"
        ><input v-model="form.isActive" type="checkbox" />Available for new
        bookings</label
      >
      </fieldset>
      </div>
      <footer class="dialog-footer"><Button variant="outline" type="button" :disabled="busy" @click="close">Cancel</Button><Button type="submit" :disabled="busy || loading || !form.vesselId">{{ busy ? 'Saving…' : 'Save accommodation' }}</Button></footer>
    </form>
      </div>
    </IonModal>
    <div class="directory-filters">
      <label class="directory-search" for="accommodation-search">Search accommodation<div class="search-input"><IonIcon :icon="searchOutline" aria-hidden="true" /><input id="accommodation-search" v-model="table.query.value" type="search" placeholder="Class name, vessel, or description" /></div></label>
      <label for="accommodation-vessel">Vessel<select id="accommodation-vessel" v-model="vesselFilter"><option value="ALL">All vessels</option><option v-for="v in vessels" :key="v.id" :value="v.id">{{ v.name }}</option></select></label>
      <label for="accommodation-status">Status<select id="accommodation-status" v-model="status"><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
      <label for="accommodation-sort">Sort classes<select id="accommodation-sort" v-model="table.sort.value"><option value="">Original order</option><option value="name:asc">Class: A–Z</option><option value="capacity:desc">Capacity: highest first</option><option value="surcharge:asc">Extra fare: lowest first</option><option value="surcharge:desc">Extra fare: highest first</option></select></label>
      <Button variant="ghost" :disabled="!table.query.value && !table.sort.value && status === 'ALL' && vesselFilter === 'ALL'" @click="resetFilters">Reset filters</Button>
    </div>
    <p v-if="!loading && !error && !vessels.length" class="form-note">Add an active vessel before creating accommodation. <router-link to="/admin/vessels">Manage vessels</router-link></p>
    <div class="accommodation-directory">
      <div class="directory-heading"><div><p class="eyebrow">SEATING CLASSES</p><h2>Accommodation directory</h2><p class="directory-hint">{{ table.records.value.length }} of {{ rows.length }} classes · Existing bookings keep their selected class and price.</p></div><Button :disabled="busy || loading || !vessels.length" @click="start()">Add accommodation</Button></div>
      <div class="directory-table">
      <table>
        <thead>
          <tr>
            <th>Class</th>
            <th>Vessel</th>
            <th>Description</th>
            <th>Capacity</th>
            <th>Extra fare</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in table.records.value" :key="a.id">
            <td data-label="Class">
              <strong class="class-name">{{ a.name }}</strong>
            </td>
            <td data-label="Vessel">{{ a.vesselName }}</td>
            <td data-label="Description">
              {{ a.description || "Standard seating" }}
            </td>
            <td data-label="Capacity"><span class="class-capacity">{{ a.capacity }} seats</span></td>
            <td data-label="Extra fare">
              PHP {{ a.surcharge.toLocaleString() }}
            </td>
            <td data-label="Status">
              <Badge :variant="a.isActive ? 'success' : 'destructive'">{{
                a.isActive ? "Active" : "Inactive"
              }}</Badge>
            </td>
            <td data-label="Actions">
              <Button variant="outline" :disabled="busy || loading" :aria-label="`Edit ${a.name} on ${a.vesselName}`" @click="start(a)">Edit</Button>
            </td>
          </tr>
          <tr v-if="!table.records.value.length && !error">
            <td colspan="7">
              {{
                loading
                  ? "Loading accommodations…"
                  : rows.length ? "No matching accommodation classes." : "No classes yet. Add the seating classes your operator offers."
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { IonIcon, IonModal } from "@ionic/vue";
import { bedOutline, closeOutline, peopleOutline, searchOutline } from "ionicons/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { confirmAction } from "../../composables/confirmation";
import { useTableRecords } from "../../composables/tableRecords";
import { useUnsavedChanges } from "../../composables/unsavedChanges";
import { staffDatabase } from "../../services/session";
import {
  accommodations,
  saveAccommodation,
  type Accommodation,
} from "../../services/database/workspaces";
import { adminVessels } from "../../services/database/staff";
import { databaseRequestError } from "../../data/databaseErrors";
const rows = ref<Accommodation[]>([]),
  vessels = ref<Array<{ id: string; name: string; passengerCapacity: number }>>(
    [],
  ),
  loading = ref(false),
  busy = ref(false),
  editing = ref(false),
  error = ref(""),
  notice = ref("");
const form = reactive({
  id: "",
  vesselId: "",
  name: "",
  description: "",
  capacity: 1,
  surcharge: 0,
  isActive: true,
});
const formError = ref(''), status = ref('ALL'), vesselFilter = ref('ALL');
const filteredRows = computed(() => rows.value.filter(row =>
  (status.value === 'ALL' || row.isActive === (status.value === 'ACTIVE')) &&
  (vesselFilter.value === 'ALL' || row.vesselId === vesselFilter.value)));
const table = useTableRecords(filteredRows);
function resetFilters() { table.query.value = ''; table.sort.value = ''; status.value = 'ALL'; vesselFilter.value = 'ALL'; }
let initialForm = JSON.stringify(form);
const hasUnsavedChanges = () => editing.value && JSON.stringify(form) !== initialForm;
useUnsavedChanges(hasUnsavedChanges);
defineExpose({ hasUnsavedChanges });
async function canDismiss() {
  if (busy.value) return false;
  return !hasUnsavedChanges() || await confirmAction({ title: 'Discard accommodation changes?', message: 'Your accommodation changes have not been saved.', confirmText: 'Discard changes' });
}
async function close() { if (await canDismiss()) editing.value = false; }
const remainingCapacity = computed(() => Math.max(0,
  (vessels.value.find(v => v.id === form.vesselId)?.passengerCapacity || 0)
  - rows.value.filter(a => a.vesselId === form.vesselId && a.isActive && a.id !== form.id).reduce((sum, a) => sum + a.capacity, 0)));
function start(a?: Accommodation) {
  Object.assign(
    form,
    a || {
      id: "",
      vesselId: "",
      name: "",
      description: "",
      capacity: 1,
      surcharge: 0,
      isActive: true,
    },
  );
  editing.value = true;
  initialForm = JSON.stringify(form);
  notice.value = "";
  formError.value = "";
}
async function load() {
  if (!staffDatabase) return;
  loading.value = true;
  error.value = "";
  try {
    const [a, v] = await Promise.all([
      accommodations(staffDatabase),
      adminVessels(staffDatabase),
    ]);
    rows.value = a.data.accommodations;
    vessels.value = v.data.vessels.filter((v) => v.isActive);
  } catch (e) {
    error.value = databaseRequestError(e, "Could not load accommodations.");
  } finally {
    loading.value = false;
  }
}
async function save() {
  if (!staffDatabase || busy.value) return;
  if (form.isActive && form.capacity > remainingCapacity.value) { formError.value = "Class capacity exceeds the vessel's remaining seats."; return; }
  busy.value = true;
  formError.value = "";
  try {
    await saveAccommodation(staffDatabase, {
      ...form,
      id: form.id || undefined,
    });
    initialForm = JSON.stringify(form);
    busy.value = false;
    editing.value = false;
    await load();
    notice.value = "Accommodation saved.";
  } catch (e) {
    formError.value = databaseRequestError(e, "Could not save accommodation.");
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<style scoped>
.accommodation-workspace { display: grid; gap: 20px; min-width: 0; }
.directory-filters { display: flex; align-items: end; flex-wrap: wrap; gap: 14px; padding: 18px 20px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
label { display: grid; gap: 8px; min-width: 0; font-size: 11px; font-weight: 600; color: var(--muted); }
input:not([type="checkbox"]), select, textarea { width: 100%; min-width: 0; min-height: 44px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); color: var(--ink); font: inherit; font-size: 12px; }
textarea { resize: vertical; line-height: 1.6; }
.directory-search { flex: 1 1 100%; }
.directory-filters > label:not(.directory-search) { flex: 1; }
.search-input { display: flex; align-items: center; gap: 8px; padding-left: 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); }
.search-input input { border: 0; background: transparent; outline: none; }
.search-input ion-icon { flex: none; font-size: 17px; }
.search-input:focus-within { outline: 2px solid var(--ocean); outline-offset: 2px; }
.directory-filters > button { min-height: 44px; flex: none; }
.accommodation-directory { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: var(--surface); min-width: 0; }
.directory-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 22px; border-bottom: 1px solid var(--line); }
.directory-heading > button { flex: none; }
.eyebrow { margin: 0 0 6px; font-size: 10px; font-weight: 800; letter-spacing: .1em; color: var(--ocean); }
h2 { margin: 0; font-size: 19px; color: var(--ink); }
.directory-hint { margin: 8px 0 0; color: var(--muted); font-size: 11px; line-height: 1.5; }
.directory-table { overflow-x: auto; scrollbar-width: thin; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 15px 18px; border-bottom: 1px solid var(--line); text-align: left; font-size: 12px; color: var(--ink); }
th { background: var(--surface-soft); font-size: 10px; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
tbody tr:last-child td { border-bottom: 0; }
tbody tr:hover { background: var(--surface-soft); }
.class-name { font-size: 13px; font-weight: 650; }
.class-capacity { white-space: nowrap; font-variant-numeric: tabular-nums; }
.form-note { margin: 0; font-size: 11px; color: var(--muted); line-height: 1.6; }
.form-note a { color: var(--ocean); }
.accommodation-modal { --width: min(680px, calc(100vw - 32px)); --height: auto; --max-height: calc(100dvh - 40px); --border-radius: 16px; --background: var(--surface); }
.accommodation-dialog { display: flex; flex-direction: column; max-height: calc(100dvh - 40px); overflow: hidden; background: var(--surface); color: var(--ink); }
.dialog-heading { display: flex; align-items: center; gap: 14px; padding: 22px 24px; border-bottom: 1px solid var(--line); flex: none; }
.dialog-symbol { display: grid; place-items: center; width: 44px; height: 44px; flex: none; border-radius: 12px; background: var(--light-blue); color: var(--ocean); font-size: 24px; }
.dialog-subtitle { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.dialog-close { display: grid; place-items: center; width: 36px; height: 36px; flex: none; margin-left: auto; border: 0; border-radius: 9px; background: var(--surface-soft); color: var(--muted); font-size: 22px; cursor: pointer; }
.accommodation-form { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; overflow: hidden; }
.accommodation-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-gutter: stable; scrollbar-color: var(--muted) var(--surface); }
.accommodation-fields { border: 0; margin: 0; min-width: 0; padding: 22px 24px; }
.accommodation-field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 20px 18px; margin-top: 18px; }
.description-field { grid-column: 1 / -1; }
.accommodation-fields label small { font-size: 10px; line-height: 1.5; font-weight: 400; }
.capacity-note { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 10px; background: var(--light-blue); color: var(--ocean); margin: 18px 0 0; }
.capacity-note ion-icon { font-size: 23px; flex: none; }
.capacity-note span { display: grid; gap: 5px; }
.capacity-note strong { font-size: 12px; font-weight: 650; }
.capacity-note small { font-size: 10px; line-height: 1.5; color: var(--muted); }
.accommodation-availability { display: flex; align-items: center; gap: 12px; margin-top: 18px; padding: 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); color: var(--ink); }
.accommodation-availability input { width: 17px; height: 17px; flex: none; accent-color: var(--ocean); }
.dialog-footer { display: flex; justify-content: flex-end; gap: 10px; flex: none; padding: 16px 24px; border-top: 1px solid var(--line); background: var(--surface-soft); }
.dialog-footer button { min-height: 44px; }
.form-error { margin: 16px 24px 0; padding: 12px; border-radius: 9px; background: var(--danger-soft); color: var(--danger); font-size: 12px; line-height: 1.5; }
input:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
button:disabled, input:disabled, select:disabled { opacity: .6; }
@media (max-width: 600px) {
  .directory-filters, .directory-heading { padding: 16px; }
  .directory-filters > label:not(.directory-search) { flex-basis: calc(50% - 14px); }
  .directory-filters > button { width: 100%; }
  .directory-heading { align-items: flex-start; flex-direction: column; }
  .accommodation-modal { --width: calc(100vw - 24px); --max-height: calc(100dvh - 24px); }
  .accommodation-dialog { max-height: calc(100dvh - 24px); }
  .dialog-heading, .accommodation-fields { padding: 18px; }
  .dialog-heading { align-items: flex-start; gap: 10px; }
  .accommodation-field-grid { grid-template-columns: 1fr; gap: 16px; }
  .dialog-footer { padding: 14px 18px; }
  .dialog-footer button { flex: 1; }
  table, tbody, tr, td { display: block; }
  thead { display: none; }
  tr { padding: 12px 16px; border-bottom: 1px solid var(--line); }
  tbody tr:last-child { border-bottom: 0; }
  td { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 8px 0; border: 0; overflow-wrap: anywhere; }
  td:before { content: attr(data-label); color: var(--muted); font-size: 10px; min-width: 80px; }
  td[colspan]:before { display: none; }
}
</style>
