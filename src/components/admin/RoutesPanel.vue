<template>
  <section class="routes-workspace">
    <p v-if="error" class="catalog-error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="loading" role="status">Loading routes...</p>
    <button v-if="error && !loading" type="button" @click="load">Retry loading routes</button>
    <div class="route-filters">
      <label class="route-search" for="route-search">Search routes<div class="search-input"><IonIcon :icon="searchOutline" aria-hidden="true" /><input id="route-search" v-model="table.query.value" type="search" placeholder="Route code or port name" /></div></label>
      <label for="route-filter-status">Route status<select id="route-filter-status" v-model="status"><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
      <label for="route-sort">Sort routes<select id="route-sort" v-model="table.sort.value"><option value="">Original order</option><option value="code:asc">Code: A–Z</option><option value="code:desc">Code: Z–A</option><option value="origin.name:asc">Origin: A–Z</option><option value="durationMinutes:asc">Duration: shortest first</option><option value="durationMinutes:desc">Duration: longest first</option></select></label>
      <Button variant="ghost" :disabled="!table.query.value && !table.sort.value && status === 'ALL'" @click="resetFilters">Reset filters</Button>
    </div>
    <p v-if="!loading && !error && ports.length < 2" class="route-note">Add at least two active ports to create a route. <router-link to="/admin/ports">Manage ports</router-link></p>
    <div class="route-directory" v-if="!loading && !error">
      <div class="directory-heading"><div><p class="eyebrow">FERRY NETWORK</p><h2>Route directory</h2><p class="directory-hint">{{ table.records.value.length }} of {{ rows.length }} routes · {{ rows.filter(r => r.isActive).length }} active</p></div><Button :disabled="busy || ports.length < 2" @click="start()"><IonIcon :icon="addOutline" aria-hidden="true" />Add route</Button></div>
      <RecordsGrid title="Route directory" :columns="['Code', 'Origin', 'Destination', 'Duration', 'Status']" :rows="gridRows" density="compact" :column-min-widths="[110, 170, 170, 110, 100]" :action-width="110" :max-grid-height="360">
        <template #cell="{ row, index, value }">
          <strong v-if="index === 0" class="route-code">{{ value }}</strong>
          <strong v-else-if="index === 1 || index === 2" class="route-port-name">{{ value }}</strong>
          <span v-else-if="index === 3" class="route-duration"><IonIcon :icon="timeOutline" aria-hidden="true" />{{ value }}</span>
          <Badge v-else :variant="row.source.isActive ? 'success' : 'destructive'">{{ value }}</Badge>
        </template>
        <template #actions="{ row }"><button type="button" class="route-edit" :disabled="busy" :aria-label="`Edit route ${row.source.code}`" @click="start(row.source)">Edit</button></template>
      </RecordsGrid>
      <p class="directory-footer">{{ table.records.value.length }} of {{ rows.length }} routes · Sailing durations are shown in minutes.</p>
    </div>
    <IonModal :is-open="editing" :can-dismiss="canDismiss" class="route-modal" @didDismiss="editing = false">
      <div class="route-dialog">
        <header class="route-modal-header"><span class="route-symbol"><IonIcon :icon="navigateOutline" aria-hidden="true" /></span><div><p class="eyebrow">ROUTE DIRECTORY</p><h2>{{ form.id ? 'Edit route' : 'Add route' }}</h2><p class="route-subtitle">Connect two ports and set the expected sailing duration.</p></div><button type="button" class="route-close" aria-label="Close dialog" :disabled="busy" @click="close"><IonIcon :icon="closeOutline" aria-hidden="true" /></button></header>
        <p v-if="formError" class="route-form-error" role="alert">{{ formError }}</p>
        <form class="route-form" @submit.prevent="save">
          <fieldset class="route-fields" :disabled="busy">
            <div class="route-preview" aria-label="Route connection preview"><div><span>DEPARTURE</span><strong>{{ ports.find(p => p.id === form.originPortId)?.name || 'Origin port' }}</strong></div><IonIcon :icon="arrowForwardOutline" aria-hidden="true" /><div><span>ARRIVAL</span><strong>{{ ports.find(p => p.id === form.destinationPortId)?.name || 'Destination port' }}</strong></div></div>
            <p class="route-note">Complete all fields to {{ form.id ? 'update' : 'create' }} this route.</p>
            <div class="route-field-grid">
              <label for="new-route-code">Route code<input id="new-route-code" v-model.trim="form.code" required maxlength="30" placeholder="e.g. BTG-CAL" /></label>
              <label for="new-route-duration">Estimated duration (minutes)<input id="new-route-duration" v-model.number="form.durationMinutes" type="number" min="1" max="10080" required /><small>Used when planning departure and arrival times.</small></label>
              <label for="new-route-origin">Origin<select id="new-route-origin" v-model="form.originPortId" required><option value="" disabled>Select origin port</option><option v-for="p in ports" :key="p.id" :value="p.id">{{ p.name }}</option></select></label>
              <label for="new-route-destination">Destination<select id="new-route-destination" v-model="form.destinationPortId" required><option value="" disabled>Select destination port</option><option v-for="p in ports" :key="p.id" :value="p.id" :disabled="p.id === form.originPortId">{{ p.name }}</option></select></label>
            </div>
            <p v-if="form.originPortId && form.originPortId === form.destinationPortId" class="route-form-error" role="alert">Choose different origin and destination ports.</p>
            <label class="route-availability"><input v-model="form.isActive" type="checkbox" /><span><strong>Active route</strong><small>Available when creating new sailings.</small></span></label>
          </fieldset>
          <footer class="route-modal-footer"><Button variant="outline" type="button" :disabled="busy" @click="close">Cancel</Button><Button type="submit" :disabled="busy || loading || !form.originPortId || !form.destinationPortId || form.originPortId === form.destinationPortId">{{ busy ? 'Saving…' : 'Save route' }}</Button></footer>
        </form>
      </div>
    </IonModal>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, reactive } from "vue";
import { IonIcon, IonModal } from "@ionic/vue";
import { addOutline, arrowForwardOutline, closeOutline, navigateOutline, searchOutline, timeOutline } from "ionicons/icons";
import RecordsGrid from "../shared/RecordsGrid.vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { confirmAction } from "../../composables/confirmation";
import { useTableRecords } from "../../composables/tableRecords";
import { useUnsavedChanges } from "../../composables/unsavedChanges";
import { staffDatabase } from "../../services/session";
import {
  routes,
  saveRoute,
  type FerryRoute,
} from "../../services/database/workspaces";
import { adminPorts } from "../../services/database/staff";
import { databaseRequestError } from "../../data/databaseErrors";
const rows = ref<FerryRoute[]>([]),
  ports = ref<Array<{ id: string; name: string }>>([]),
  editing = ref(false),
  busy = ref(false),
  loading = ref(false),
  error = ref(""),
  notice = ref("");
const status = ref('ALL'), formError = ref('');
const form = reactive({
  id: "",
  code: "",
  originPortId: "",
  destinationPortId: "",
  durationMinutes: 120,
  isActive: true,
});
const filteredRows = computed(() => rows.value.filter(row => status.value === 'ALL' || row.isActive === (status.value === 'ACTIVE')));
const table = useTableRecords(filteredRows);
const gridRows = computed(() => table.records.value.map(route => ({
  key: route.id,
  cells: [route.code, route.origin.name, route.destination.name, `${route.durationMinutes} min`, route.isActive ? 'Active' : 'Inactive'],
  sortValues: [route.code, route.origin.name, route.destination.name, route.durationMinutes, route.isActive ? 'Active' : 'Inactive'],
  source: route,
  statusIndex: 4,
})));
function resetFilters() { table.query.value = ''; table.sort.value = ''; status.value = 'ALL'; }
let initialForm = JSON.stringify(form);
const hasUnsavedChanges = () => editing.value && JSON.stringify(form) !== initialForm;
useUnsavedChanges(hasUnsavedChanges);
defineExpose({ hasUnsavedChanges });
async function canDismiss() {
  if (busy.value) return false;
  return !hasUnsavedChanges() || await confirmAction({ title: 'Discard route changes?', message: 'Your route changes have not been saved.', confirmText: 'Discard changes' });
}
async function close() { if (await canDismiss()) editing.value = false; }
function start(r?: FerryRoute) {
  Object.assign(
    form,
    r || {
      id: "",
      code: "",
      originPortId: "",
      destinationPortId: "",
      durationMinutes: 120,
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
    const [r, p] = await Promise.all([
      routes(staffDatabase),
      adminPorts(staffDatabase),
    ]);
    rows.value = r.data.routes;
    ports.value = p.data.ports.filter((p) => p.isActive);
  } catch (e) {
    error.value = databaseRequestError(e, "Could not load routes.");
  } finally {
    loading.value = false;
  }
}
async function save() {
  if (!staffDatabase || busy.value) return;
  if (!form.code.trim() || !form.originPortId || !form.destinationPortId) { formError.value = 'Complete the route code, origin, and destination.'; return; }
  if (form.originPortId === form.destinationPortId) { formError.value = "Choose different origin and destination ports."; return; }
  busy.value = true;
  formError.value = "";
  try {
    await saveRoute(staffDatabase, { ...form, id: form.id || undefined });
    initialForm = JSON.stringify(form);
    busy.value = false;
    editing.value = false;
    await load();
    notice.value = "Route saved.";
  } catch (e) {
    formError.value = databaseRequestError(e, "Could not save route.");
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<style scoped>
.routes-workspace { display: grid; gap: 16px; min-width: 0; font-family: var(--ion-font-family); }
.route-filters { display: grid; grid-template-columns: minmax(220px, 1fr) 150px 180px auto; align-items: end; gap: 12px; padding: 12px 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
label { display: grid; gap: 8px; min-width: 0; font-size: 12px; font-weight: 600; color: var(--muted); }
input:not([type="checkbox"]), select { box-sizing: border-box; width: 100%; min-width: 0; min-height: 40px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); color: var(--ink); font: inherit; font-size: 12px; }
.route-search { flex: 1; }
.search-input { display: flex; align-items: center; gap: 8px; padding-left: 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); }
.search-input input { border: 0; background: transparent; outline: none; }
.search-input ion-icon { flex: none; font-size: 17px; }
.search-input:focus-within { outline: 2px solid var(--ocean); outline-offset: 2px; }
.route-filters > button { flex: none; min-height: 40px; }
.route-directory { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: var(--surface); min-width: 0; }
.directory-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.eyebrow { margin: 0 0 6px; font-size: 10px; font-weight: 800; letter-spacing: .1em; color: var(--ocean); }
h2 { margin: 0; font-size: 17px; color: var(--ink); }
.directory-hint { margin: 5px 0 0; color: var(--muted); font-size: 11px; line-height: 1.5; }
.route-directory :deep(.grid-tools) { padding: 8px 16px; border-bottom: 1px solid var(--line); background: var(--surface); }
.route-directory :deep(.grid-tools button) { min-height: 34px; padding: 6px 8px; }
.route-directory :deep(.desktop-grid) { padding: 8px; }
.route-directory :deep(.grid-cell-content) { padding: 7px 0; font-size: 12px; line-height: 1.5; }
.route-directory :deep(.grid-row-actions) { display: flex; align-items: center; min-height: 44px; padding: 7px 0; }
.route-port-name { font-size: 12px; font-weight: 650; }
.directory-footer { margin: 0; padding: 10px 16px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; line-height: 1.5; }
.routes-workspace button, .route-dialog button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-family: inherit; font-size: 12px; min-height: 40px; }
.routes-workspace .route-edit { min-height: 32px; padding: 5px 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface); color: var(--ocean); font-size: 11px; cursor: pointer; }
.routes-workspace button ion-icon { font-size: 17px; }
.route-code { color: var(--ocean); font-weight: 650; }
.route-duration { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.route-duration ion-icon { color: var(--muted); font-size: 16px; }
.route-note { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.6; }
.route-note a { color: var(--ocean); }
.route-modal { --width: min(640px, calc(100vw - 32px)); --height: auto; --max-height: calc(100dvh - 40px); --border-radius: 16px; --background: var(--surface); }
.route-dialog { display: flex; flex-direction: column; min-height: 0; max-height: calc(100dvh - 40px); overflow: hidden; background: var(--surface); color: var(--ink); font-family: var(--ion-font-family); }
.route-modal-header { display: flex; align-items: center; gap: 12px; padding: 18px 20px; border-bottom: 1px solid var(--line); flex: none; }
.route-symbol { display: grid; place-items: center; width: 44px; height: 44px; flex: none; border-radius: 12px; background: var(--light-blue); color: var(--ocean); font-size: 24px; }
.route-subtitle { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.route-dialog .route-close { display: grid; place-items: center; width: 44px; height: 44px; flex: none; margin-left: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); color: var(--muted); font-size: 22px; cursor: pointer; }
.route-form { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; overflow: hidden; }
.route-fields { flex: 1 1 auto; border: 0; margin: 0; min-width: 0; min-height: 0; padding: 16px 20px; overflow-y: auto; scrollbar-width: thin; }
.route-preview { display: grid; grid-template-columns: minmax(0, 1fr) 20px minmax(0, 1fr); align-items: center; gap: 12px; padding: 12px; margin-bottom: 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); }
.route-preview div { display: grid; gap: 8px; min-width: 0; }
.route-preview div:last-child { text-align: right; }
.route-preview span { font-size: 10px; font-weight: 700; letter-spacing: .08em; color: var(--muted); }
.route-preview strong { font-size: 12px; overflow-wrap: anywhere; }
.route-preview > ion-icon { color: var(--ocean); font-size: 22px; }
.route-field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 16px; margin-top: 12px; }
.route-fields label small { font-size: 12px; line-height: 1.5; font-weight: 400; }
.route-availability { display: flex; align-items: center; gap: 10px; margin-top: 16px; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); }
.route-availability input { width: 17px; height: 17px; flex: none; accent-color: var(--ocean); }
.route-availability span { display: grid; gap: 4px; }
.route-availability strong { color: var(--ink); font-size: 12px; }
.route-modal-footer { display: flex; justify-content: flex-end; gap: 10px; flex: none; padding: 14px 20px; border-top: 1px solid var(--line); background: var(--surface-soft); }
.route-modal-footer button { min-height: 40px; }
.route-form-error { margin: 16px 24px 0; padding: 12px; border-radius: 9px; background: var(--danger-soft); color: var(--danger); font-size: 12px; line-height: 1.5; }
.route-fields .route-form-error { margin: 16px 0 0; }
input:focus-visible, select:focus-visible, button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
button:disabled { opacity: .6; }
@media (max-width: 1100px) {
  .route-filters { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 12px; }
  .route-search { grid-column: 1 / -1; }
}
@media (max-width: 600px) {
  .route-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .route-filters, .directory-heading { padding: 16px; }
  .route-filters > button { width: 100%; grid-column: 1 / -1; }
  .directory-heading { align-items: flex-start; }
  .directory-hint { max-width: 190px; }
  .directory-heading > button { padding: 10px 12px; }
  .route-modal { --width: calc(100vw - 24px); --max-height: calc(100dvh - 24px); }
  .route-dialog { max-height: calc(100dvh - 24px); }
  .route-modal-header, .route-fields { padding: 18px; }
  .route-modal-header { align-items: flex-start; gap: 10px; }
  .route-field-grid { grid-template-columns: 1fr; gap: 16px; }
  .route-modal-footer { padding: 14px 18px; }
  .route-modal-footer button { flex: 1; }
  .routes-workspace .route-edit { min-height: 44px; }
  .route-directory :deep(.grid-tools) { flex-wrap: wrap; }
  input:not([type="checkbox"]), select { min-height: 44px; font-size: 16px; }
}
</style>
