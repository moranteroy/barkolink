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
      <label for="accommodation-form-vessel"
        >Vessel<select id="accommodation-form-vessel"
          v-model="form.vesselId"
          required
          :disabled="!!form.id || busy"
        >
          <option value="" disabled>Select vessel</option>
          <option v-for="v in vessels" :key="v.id" :value="v.id">
            {{ v.name }} · {{ v.passengerCapacity }} seats
          </option>
        </select></label
      ><label for="accommodation-class-name"
        >Class name<select id="accommodation-class-name" v-model="form.name" required>
          <option value="" disabled>Select class</option>
          <option v-for="name in classNames" :key="name" :value="name">{{ name }}</option>
        </select></label
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
      <div class="directory-heading"><div><p class="eyebrow">SEATING CLASSES</p><h2>Accommodation directory</h2><p class="directory-hint">{{ table.records.value.length }} of {{ rows.length }} classes</p></div><Button :disabled="busy || loading || !vessels.length" @click="start()"><IonIcon :icon="addOutline" aria-hidden="true" />Add accommodation</Button></div>
      <RecordsGrid title="Accommodation directory" :columns="['Class', 'Vessel', 'Description', 'Capacity', 'Extra fare', 'Status']" :rows="gridRows" :loading="loading" density="compact" :column-min-widths="[110, 160, 220, 100, 110, 100]" :action-width="110" :max-grid-height="360">
        <template #cell="{ row, index, value }">
          <strong v-if="index === 0" class="class-name">{{ value }}</strong>
          <strong v-else-if="index === 1" class="vessel-name">{{ value }}</strong>
          <span v-else-if="index === 3 || index === 4" class="class-number">{{ value }}</span>
          <Badge v-else-if="index === 5" :variant="row.source.isActive ? 'success' : 'destructive'">{{ value }}</Badge>
          <span v-else class="class-description" :title="String(value)">{{ value }}</span>
        </template>
        <template #actions="{ row }"><button type="button" class="class-edit" :disabled="busy || loading" :aria-label="`Edit ${row.source.name} on ${row.source.vesselName}`" @click="start(row.source)">Edit</button></template>
      </RecordsGrid>
      <p class="directory-footer">Existing bookings keep their selected class and price.</p>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { IonIcon, IonModal } from "@ionic/vue";
import { addOutline, bedOutline, closeOutline, peopleOutline, searchOutline } from "ionicons/icons";
import RecordsGrid from "../shared/RecordsGrid.vue";
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
const classNames = computed(() => [...new Set(['Economy', 'Tourist', 'Premium', 'Business', ...rows.value.map(row => row.name), ...(form.name ? [form.name] : [])])]);
const gridRows = computed(() => table.records.value.map(accommodation => ({
  key: accommodation.id,
  cells: [accommodation.name, accommodation.vesselName || vessels.value.find(vessel => vessel.id === accommodation.vesselId)?.name || 'Unavailable vessel', accommodation.description || 'Standard seating', `${accommodation.capacity} seats`, `PHP ${accommodation.surcharge.toLocaleString()}`, accommodation.isActive ? 'Active' : 'Inactive'],
  sortValues: [accommodation.name, accommodation.vesselName, accommodation.description || 'Standard seating', accommodation.capacity, accommodation.surcharge, accommodation.isActive ? 'Active' : 'Inactive'],
  source: accommodation,
  statusIndex: 5,
})));
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
.accommodation-workspace { display: grid; gap: 16px; min-width: 0; font-family: var(--ion-font-family); }
.directory-filters { display: grid; grid-template-columns: minmax(0, 1fr) 130px 190px auto; align-items: end; gap: 12px; padding: 12px 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
label { display: grid; gap: 8px; min-width: 0; font-size: 12px; font-weight: 600; color: var(--muted); }
input:not([type="checkbox"]), select, textarea { width: 100%; min-width: 0; min-height: 40px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); color: var(--ink); font: inherit; font-size: 12px; }
textarea { resize: vertical; line-height: 1.5; }
.directory-search { grid-column: 1 / -1; }
.search-input { display: flex; align-items: center; gap: 8px; padding-left: 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); }
.search-input input { border: 0; background: transparent; outline: none; }
.search-input ion-icon { flex: none; font-size: 17px; }
.search-input:focus-within { outline: 2px solid var(--ocean); outline-offset: 2px; }
.accommodation-workspace button, .accommodation-dialog button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; font-family: inherit; font-size: 12px; }
.accommodation-directory { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: var(--surface); min-width: 0; }
.directory-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.directory-heading > button { flex: none; }
.directory-heading > button ion-icon { font-size: 17px; }
.eyebrow { margin: 0 0 6px; font-size: 10px; font-weight: 800; letter-spacing: .1em; color: var(--ocean); }
h2 { margin: 0; font-size: 17px; color: var(--ink); }
.directory-hint { margin: 5px 0 0; color: var(--muted); font-size: 11px; line-height: 1.5; }
.accommodation-directory :deep(.grid-tools) { padding: 8px 16px; border-bottom: 1px solid var(--line); background: var(--surface); }
.accommodation-directory :deep(.grid-tools button) { min-height: 34px; padding: 6px 8px; }
.accommodation-directory :deep(.desktop-grid) { padding: 8px; }
.accommodation-directory :deep(.grid-cell-content) { padding: 7px 0; font-size: 12px; line-height: 1.5; }
.accommodation-directory :deep(.grid-row-actions) { display: flex; align-items: center; min-height: 44px; padding: 7px 0; }
.accommodation-workspace .class-edit { min-height: 32px; padding: 5px 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface); color: var(--ocean); font-size: 11px; cursor: pointer; }
.class-name, .vessel-name { font-size: 12px; font-weight: 650; }
.class-number { white-space: nowrap; font-variant-numeric: tabular-nums; }
.class-description { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.directory-footer { margin: 0; padding: 10px 16px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; line-height: 1.5; }
.form-note { margin: 0; font-size: 11px; color: var(--muted); line-height: 1.6; }
.form-note a { color: var(--ocean); }
.accommodation-modal { --width: min(640px, calc(100vw - 32px)); --height: auto; --max-height: calc(100dvh - 40px); --border-radius: 16px; --background: var(--surface); }
.accommodation-dialog { display: flex; flex-direction: column; min-height: 0; max-height: calc(100dvh - 40px); overflow: hidden; background: var(--surface); color: var(--ink); font-family: var(--ion-font-family); }
.dialog-heading { display: flex; align-items: center; gap: 12px; padding: 18px 20px; border-bottom: 1px solid var(--line); flex: none; }
.dialog-symbol { display: grid; place-items: center; width: 40px; height: 40px; flex: none; border-radius: 10px; background: var(--light-blue); color: var(--ocean); font-size: 22px; }
.dialog-subtitle { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.accommodation-dialog .dialog-close { display: grid; place-items: center; width: 44px; height: 44px; flex: none; margin-left: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); color: var(--muted); font-size: 22px; cursor: pointer; }
.accommodation-form { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; overflow: hidden; }
.accommodation-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--muted) var(--surface); }
.accommodation-fields { border: 0; margin: 0; min-width: 0; padding: 16px 20px; }
.accommodation-field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 16px; margin-top: 12px; }
.description-field { grid-column: 1 / -1; }
.accommodation-fields label small { font-size: 11px; line-height: 1.5; font-weight: 400; }
.capacity-note { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: var(--light-blue); color: var(--ocean); margin: 14px 0 0; }
.capacity-note ion-icon { font-size: 20px; flex: none; }
.capacity-note span { display: grid; gap: 4px; }
.capacity-note strong { font-size: 12px; font-weight: 650; }
.capacity-note small { font-size: 11px; line-height: 1.5; color: var(--muted); }
.accommodation-availability { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); color: var(--ink); }
.accommodation-availability input { width: 17px; height: 17px; flex: none; accent-color: var(--ocean); }
.dialog-footer { display: flex; justify-content: flex-end; gap: 10px; flex: none; padding: 14px 20px; border-top: 1px solid var(--line); background: var(--surface-soft); }
.form-error { margin: 12px 20px 0; padding: 12px; border-radius: 9px; background: var(--danger-soft); color: var(--danger); font-size: 12px; line-height: 1.5; flex: none; }
input:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
button:disabled, input:disabled, select:disabled { opacity: .6; }
@media (max-width: 1000px) {
  .directory-filters { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .directory-filters > button { grid-column: 1 / -1; justify-self: start; }
}
@media (max-width: 699px) {
  .class-description { white-space: normal; overflow-wrap: anywhere; }
}
@media (max-width: 600px) {
  .directory-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .directory-filters, .directory-heading { padding: 16px; }
  .directory-filters > label[for="accommodation-sort"] { grid-column: 1 / -1; }
  .directory-filters > button { width: 100%; }
  .directory-heading { align-items: flex-start; flex-wrap: wrap; gap: 12px; }
  .accommodation-directory :deep(.grid-tools) { flex-wrap: wrap; }
  .accommodation-workspace .class-edit { min-height: 44px; }
  .accommodation-modal { --width: calc(100vw - 24px); --max-height: calc(100dvh - 24px); }
  .accommodation-dialog { max-height: calc(100dvh - 24px); }
  .dialog-heading, .accommodation-fields { padding: 16px; }
  .dialog-heading { align-items: flex-start; gap: 10px; }
  .accommodation-field-grid { grid-template-columns: 1fr; gap: 14px; }
  input:not([type="checkbox"]), select, textarea { min-height: 44px; font-size: 16px; }
  .dialog-footer { padding: 12px 16px; }
  .dialog-footer button { flex: 1; min-height: 44px; }
}
</style>
