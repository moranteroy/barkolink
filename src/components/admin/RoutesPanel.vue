<template>
  <section class="catalog-panel">
    <div class="catalog-tools">
      <p>
        Manage ferry routes between active ports and their expected sailing
        duration.
      </p>
      <button class="primary-button" @click="start()">Add route</button>
    </div>
    <p v-if="error" class="catalog-error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <form v-if="editing" class="catalog-form" @submit.prevent="save">
      <h2>{{ form.id ? "Edit route" : "Add route" }}</h2>
      <label
        >Route code<input
          v-model.trim="form.code"
          required
          maxlength="30" /></label
      ><label
        >Origin<select v-model="form.originPortId" required>
          <option value="" disabled>Select port</option>
          <option v-for="p in ports" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select></label
      ><label
        >Destination<select v-model="form.destinationPortId" required>
          <option value="" disabled>Select port</option>
          <option v-for="p in ports" :key="p.id" :value="p.id" :disabled="p.id === form.originPortId">
            {{ p.name }}
          </option>
        </select></label
      ><label
        >Estimated duration (minutes)<input
          v-model.number="form.durationMinutes"
          type="number"
          min="1"
          max="10080"
          required /></label
      ><label class="catalog-checkbox"
        ><input v-model="form.isActive" type="checkbox" />Active route</label
      >
      <div class="catalog-actions">
        <button class="primary-button" :disabled="busy || loading || form.originPortId === form.destinationPortId">Save route</button
        ><button type="button" :disabled="busy" @click="editing = false">
          Cancel
        </button>
      </div>
    </form>
    <p v-if="loading" role="status">Loading routes...</p>
    <button v-if="error && !loading" type="button" @click="load">Retry loading routes</button>
    <p v-if="editing && form.originPortId && form.originPortId === form.destinationPortId" role="alert">Choose different origin and destination ports.</p>
    <TableControls v-model:query="table.query.value" v-model:sort="table.sort.value" :columns="[{ key: 'code', label: 'Code' }, { key: 'origin.name', label: 'Origin' }, { key: 'durationMinutes', label: 'Duration' }]" />
    <div class="catalog-table" v-if="!loading && !error">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Origin</th>
            <th>Destination</th>
            <th>Duration</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in table.records.value" :key="r.id">
            <td data-label="Code">{{ r.code }}</td>
            <td data-label="Origin">{{ r.origin.name }}</td>
            <td data-label="Destination">{{ r.destination.name }}</td>
            <td data-label="Duration">{{ r.durationMinutes }} min</td>
            <td data-label="Status">
              {{ r.isActive ? "Active" : "Inactive" }}
            </td>
            <td data-label="Actions">
              <button @click="start(r)">Edit</button>
            </td>
          </tr>
          <tr v-if="!table.records.value.length">
            <td colspan="6">No matching routes.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref, reactive } from "vue";
import TableControls from "../shared/TableControls.vue";
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
const form = reactive({
  id: "",
  code: "",
  originPortId: "",
  destinationPortId: "",
  durationMinutes: 120,
  isActive: true,
});
const table = useTableRecords(rows);
let initialForm = JSON.stringify(form);
const hasUnsavedChanges = () => editing.value && JSON.stringify(form) !== initialForm;
useUnsavedChanges(hasUnsavedChanges);
defineExpose({ hasUnsavedChanges });
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
  if (form.originPortId === form.destinationPortId) { error.value = "Choose different origin and destination ports."; return; }
  busy.value = true;
  error.value = "";
  try {
    await saveRoute(staffDatabase, { ...form, id: form.id || undefined });
    editing.value = false;
    await load();
    notice.value = "Route saved.";
  } catch (e) {
    error.value = databaseRequestError(e, "Could not save route.");
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
