<template>
  <section class="accommodation-workspace">
    <p v-if="error" role="alert" class="catalog-error">{{ error }}</p>
    <button v-if="error && !loading && !busy" type="button" @click="load">
      Retry loading accommodations
    </button>
    <p v-if="notice" role="status">{{ notice }}</p>
    <IonModal
      :is-open="editing"
      :can-dismiss="canDismiss"
      class="accommodation-modal"
      @didDismiss="editing = false"
    >
      <div class="accommodation-dialog">
        <header class="dialog-heading">
          <span class="dialog-symbol"><AppIcon :icon="bedOutline" aria-hidden="true" /></span>
          <div>
            <p class="eyebrow">VESSEL ACCOMMODATION</p>
            <h2>{{ form.id ? 'Edit accommodation' : 'Add accommodation' }}</h2>
            <p class="dialog-subtitle">Set the seating class, capacity, and extra fare.</p>
          </div>
          <button
            type="button"
            class="dialog-close"
            aria-label="Close dialog"
            :disabled="busy"
            @click="close"
          >
            <AppIcon :icon="closeOutline" aria-hidden="true" />
          </button>
        </header>
        <p v-if="formError" role="alert" class="form-error">{{ formError }}</p>
        <form class="accommodation-form" @submit.prevent="save">
          <div class="accommodation-scroll">
            <fieldset class="accommodation-fields" :disabled="busy">
              <p class="form-note">Vessel, class name, capacity, and extra fare are required.</p>
              <div class="accommodation-field-grid">
                <label for="accommodation-form-vessel"
                  >Vessel<select
                    id="accommodation-form-vessel"
                    v-model="form.vesselId"
                    @change="
                      form.name = '';
                      form.description = '';
                    "
                    required
                    :disabled="!!form.id || busy"
                  >
                    <option value="" disabled>Select vessel</option>
                    <option v-for="v in vessels" :key="v.id" :value="v.id">
                      {{ v.name }} · {{ v.passengerCapacity }} seats
                    </option>
                  </select></label
                ><label for="accommodation-class-name"
                  >Class name<select
                    id="accommodation-class-name"
                    v-model="form.name"
                    required
                    :disabled="!form.vesselId"
                    @change="fillDescription"
                  >
                    <option value="" disabled>Select class</option>
                    <option v-for="name in classNames" :key="name" :value="name">{{ name }}</option>
                  </select></label
                ><label class="description-field"
                  >Description (optional)<textarea
                    v-model.trim="form.description"
                    maxlength="500"
                    rows="3"
                    placeholder="Select a class to fill its description."
                  /><small
                    >Filled from the selected class. You can edit it for this vessel.</small
                  ></label
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
                >
              </div>
              <p v-if="form.vesselId" class="capacity-note">
                <AppIcon :icon="peopleOutline" aria-hidden="true" /><span
                  ><strong>{{ remainingCapacity }} seats available to allocate</strong
                  ><small
                    >Capacity already assigned to other active classes is excluded.</small
                  ></span
                >
              </p>
              <label class="accommodation-availability"
                ><input
                  v-model="form.isActive"
                  type="checkbox"
                  role="switch"
                  class="ui-switch"
                />Available for new bookings</label
              >
            </fieldset>
          </div>
          <footer class="dialog-footer">
            <Button variant="outline" type="button" :disabled="busy" @click="close">Cancel</Button
            ><Button type="submit" :disabled="busy || loading || !form.vesselId">{{
              busy ? 'Saving…' : 'Save accommodation'
            }}</Button>
          </footer>
        </form>
      </div>
    </IonModal>
    <div class="directory-filters">
      <label class="directory-search" for="accommodation-search"
        >Search accommodation
        <div class="search-input">
          <AppIcon :icon="searchOutline" aria-hidden="true" /><input
            id="accommodation-search"
            v-model="table.query.value"
            type="search"
            placeholder="Class name, vessel, or description"
          /></div
      ></label>
      <label for="accommodation-vessel"
        >Vessel<select id="accommodation-vessel" v-model="vesselFilter">
          <option value="ALL">All vessels</option>
          <option v-for="v in vessels" :key="v.id" :value="v.id">{{ v.name }}</option>
        </select></label
      >
      <label for="accommodation-status"
        >Status<select id="accommodation-status" v-model="status">
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select></label
      >
      <label for="accommodation-sort"
        >Sort classes<select id="accommodation-sort" v-model="table.sort.value">
          <option value="">Original order</option>
          <option value="name:asc">Class: A–Z</option>
          <option value="capacity:desc">Capacity: highest first</option>
          <option value="surcharge:asc">Extra fare: lowest first</option>
          <option value="surcharge:desc">Extra fare: highest first</option>
        </select></label
      >
      <Button
        variant="ghost"
        :disabled="
          !table.query.value && !table.sort.value && status === 'ALL' && vesselFilter === 'ALL'
        "
        @click="resetFilters"
        >Reset filters</Button
      >
    </div>
    <p v-if="!loading && !error && !vessels.length" class="form-note">
      Add an active vessel before creating accommodation.
      <router-link to="/admin/vessels">Manage vessels</router-link>
    </p>
    <div class="accommodation-directory">
      <div class="directory-heading">
        <div>
          <p class="eyebrow">SEATING CLASSES</p>
          <h2>Accommodations by vessel</h2>
          <p class="directory-hint">
            {{ table.records.value.length }} of {{ rows.length }} classes · Edit a class under its
            vessel.
          </p>
        </div>
        <Button variant="outline" :disabled="busy || loading || !vessels.length" @click="start()"
          ><AppIcon :icon="addOutline" aria-hidden="true" />Add accommodation</Button
        >
      </div>
      <p v-if="loading" class="vessel-class-message" role="status">
        Loading vessel accommodations…
      </p>
      <p v-else-if="!vesselCards.length && !error" class="vessel-class-message" role="status">
        {{
          rows.length
            ? 'No classes match these filters.'
            : 'No accommodation classes have been configured yet.'
        }}
      </p>
      <div class="vessel-class-cards">
        <article
          v-for="vessel in vesselCards"
          :key="vessel.id"
          class="vessel-class-card"
          :aria-label="`${vessel.name} accommodations`"
        >
          <header>
            <h3>{{ vessel.name }}</h3>
            <p>
              <strong>{{ vessel.allocated }} / {{ vessel.passengerCapacity }}</strong> seats
              allocated
              <span
                >· {{ Math.max(0, vessel.passengerCapacity - vessel.allocated) }} unallocated</span
              >
            </p>
          </header>
          <ul>
            <li v-for="item in vessel.classes" :key="item.id">
              <div class="vessel-class-copy">
                <strong>{{ item.name }}</strong
                ><span
                  >{{ item.capacity }} seats · PHP {{ item.surcharge.toLocaleString() }} extra</span
                ><small v-if="!item.isActive">Inactive</small>
              </div>
              <button
                type="button"
                class="vessel-class-edit"
                :disabled="busy || loading"
                :aria-label="`Edit ${item.name} for ${vessel.name}`"
                @click="start(item)"
              >
                Edit
              </button>
            </li>
          </ul>
        </article>
      </div>
      <details class="class-directory-details">
        <summary>View detailed class directory</summary>
        <RecordsGrid
          title="Accommodation directory"
          :columns="['Class', 'Vessel', 'Description', 'Capacity', 'Extra fare', 'Status']"
          :column-types="['text', 'text', 'text', 'number', 'number', 'text']"
          :rows="gridRows"
          :loading="loading"
          density="compact"
          :column-min-widths="[160, 210, 260, 110, 125, 125]"
          :action-width="110"
          :max-grid-height="360"
        >
          <template #cell="{ row, index, value }">
            <strong v-if="index === 0" class="class-name">{{ value }}</strong>
            <strong v-else-if="index === 1" class="vessel-name">{{ value }}</strong>
            <span v-else-if="index === 3 || index === 4" class="class-number">{{ value }}</span>
            <Badge
              v-else-if="index === 5"
              :variant="row.source.isActive ? 'success' : 'destructive'"
              >{{ value }}</Badge
            >
            <RecordText v-else class="class-description" :text="String(value)" />
          </template>
          <template #actions="{ row }"
            ><button
              type="button"
              class="class-edit"
              :disabled="busy || loading"
              :aria-label="`Edit ${row.source.name} on ${row.source.vesselName}`"
              @click="start(row.source)"
            >
              Edit
            </button></template
          >
        </RecordsGrid>
      </details>
      <p class="directory-footer">Existing bookings keep their selected class and price.</p>
    </div>
  </section>
</template>
<script setup lang="ts">
import { notifyError, notifySuccess } from '@/composables/toast';
import { computed, onMounted, reactive, ref } from 'vue';
import {
  starliteAccommodationClasses,
  starliteAccommodationDescriptions,
} from '@/data/starliteAccommodation';
import { IonModal } from '@ionic/vue';
import AppIcon from '@/components/ui/icon/AppIcon.vue';
import { addOutline, bedOutline, closeOutline, peopleOutline, searchOutline } from 'ionicons/icons';
import RecordsGrid from '../shared/RecordsGrid.vue';
import RecordText from '../shared/RecordText.vue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { confirmAction } from '../../composables/confirmation';
import { useTableRecords } from '../../composables/tableRecords';
import { useUnsavedChanges } from '../../composables/unsavedChanges';
import { staffDatabase } from '../../services/session';
import {
  accommodations,
  saveAccommodation,
  type Accommodation,
} from '../../services/database/workspaces';
import { adminVessels } from '../../services/database/staff';
import { databaseRequestError } from '../../data/databaseErrors';
const rows = ref<Accommodation[]>([]),
  vessels = ref<Array<{ id: string; name: string; passengerCapacity: number }>>([]),
  loading = ref(false),
  busy = ref(false),
  editing = ref(false),
  error = ref(''),
  notice = ref('');
const form = reactive({
  id: '',
  vesselId: '',
  name: '',
  description: '',
  capacity: 1,
  surcharge: 0,
  isActive: true,
});
const formError = ref(''),
  status = ref('ALL'),
  vesselFilter = ref('ALL');
const filteredRows = computed(() =>
  rows.value.filter(
    (row) =>
      (status.value === 'ALL' || row.isActive === (status.value === 'ACTIVE')) &&
      (vesselFilter.value === 'ALL' || row.vesselId === vesselFilter.value),
  ),
);
const table = useTableRecords(filteredRows);
const classNames = starliteAccommodationClasses;
const vesselCards = computed(() =>
  vessels.value
    .map((vessel) => ({
      ...vessel,
      allocated: rows.value
        .filter((row) => row.vesselId === vessel.id && row.isActive)
        .reduce((total, row) => total + row.capacity, 0),
      classes: table.records.value
        .filter((row) => row.vesselId === vessel.id)
        .sort((a, b) =>
          table.sort.value
            ? 0
            : (classNames.indexOf(a.name) < 0 ? 99 : classNames.indexOf(a.name)) -
              (classNames.indexOf(b.name) < 0 ? 99 : classNames.indexOf(b.name)),
        ),
    }))
    .filter((vessel) => vessel.classes.length),
);
function fillDescription() {
  const saved = rows.value.find((row) => row.vesselId === form.vesselId && row.name === form.name);
  form.description = saved?.description || starliteAccommodationDescriptions[form.name] || '';
}
const gridRows = computed(() =>
  table.records.value.map((accommodation) => ({
    key: accommodation.id,
    cells: [
      accommodation.name,
      accommodation.vesselName ||
        vessels.value.find((vessel) => vessel.id === accommodation.vesselId)?.name ||
        'Unavailable vessel',
      accommodation.description || 'Standard seating',
      `${accommodation.capacity} seats`,
      `PHP ${accommodation.surcharge.toLocaleString()}`,
      accommodation.isActive ? 'Active' : 'Inactive',
    ],
    sortValues: [
      accommodation.name,
      accommodation.vesselName,
      accommodation.description || 'Standard seating',
      accommodation.capacity,
      accommodation.surcharge,
      accommodation.isActive ? 'Active' : 'Inactive',
    ],
    source: accommodation,
    statusIndex: 5,
  })),
);
function resetFilters() {
  table.query.value = '';
  table.sort.value = '';
  status.value = 'ALL';
  vesselFilter.value = 'ALL';
}
let initialForm = JSON.stringify(form);
const hasUnsavedChanges = () => editing.value && JSON.stringify(form) !== initialForm;
useUnsavedChanges(hasUnsavedChanges);
defineExpose({ hasUnsavedChanges });
async function canDismiss() {
  if (busy.value) return false;
  return (
    !hasUnsavedChanges() ||
    (await confirmAction({
      title: 'Discard accommodation changes?',
      message: 'Your accommodation changes have not been saved.',
      confirmText: 'Discard changes',
    }))
  );
}
async function close() {
  if (await canDismiss()) editing.value = false;
}
const remainingCapacity = computed(() =>
  Math.max(
    0,
    (vessels.value.find((v) => v.id === form.vesselId)?.passengerCapacity || 0) -
      rows.value
        .filter((a) => a.vesselId === form.vesselId && a.isActive && a.id !== form.id)
        .reduce((sum, a) => sum + a.capacity, 0),
  ),
);
function start(a?: Accommodation) {
  Object.assign(
    form,
    a || {
      id: '',
      vesselId: '',
      name: '',
      description: '',
      capacity: 1,
      surcharge: 0,
      isActive: true,
    },
  );
  editing.value = true;
  initialForm = JSON.stringify(form);
  notice.value = '';
  formError.value = '';
}
async function load() {
  if (!staffDatabase) return;
  loading.value = true;
  error.value = '';
  try {
    const [a, v] = await Promise.all([accommodations(staffDatabase), adminVessels(staffDatabase)]);
    rows.value = a.data.accommodations;
    vessels.value = v.data.vessels
      .filter((v) => v.isActive && v.passengerCapacity != null)
      .map((v) => ({ id: v.id, name: v.name, passengerCapacity: v.passengerCapacity! }));
  } catch (e) {
    error.value = databaseRequestError(e, 'Could not load accommodations.');
  } finally {
    loading.value = false;
  }
}
async function save() {
  if (!staffDatabase || busy.value) return;
  if (!classNames.includes(form.name)) {
    formError.value = 'Choose a Starlite accommodation class.';
    return;
  }
  if (form.isActive && form.capacity > remainingCapacity.value) {
    formError.value = "Class capacity exceeds the vessel's remaining seats.";
    return;
  }
  busy.value = true;
  formError.value = '';
  try {
    await saveAccommodation(staffDatabase, {
      ...form,
      id: form.id || undefined,
    });
    initialForm = JSON.stringify(form);
    busy.value = false;
    editing.value = false;
    await load();
    notifySuccess('Accommodation saved.');
  } catch (e) {
    notifyError(databaseRequestError(e, 'Could not save accommodation.'));
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<style scoped>
.accommodation-workspace {
  display: grid;
  gap: 16px;
  min-width: 0;
  font-family: var(--ion-font-family);
}
.vessel-class-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
  gap: 16px;
  padding: 16px;
}
.vessel-class-card {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface);
}
.vessel-class-card header {
  padding: 14px 16px;
  background: var(--surface-soft);
  border-bottom: 1px solid var(--line);
}
.vessel-class-card h3 {
  margin: 0;
  color: var(--ink);
  font-size: 15px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.vessel-class-card header p {
  margin: 6px 0 0;
  font-size: var(--text-caption);
  color: var(--muted);
  line-height: 1.5;
}
.vessel-class-card header p strong {
  color: var(--ocean);
}
.vessel-class-card ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.vessel-class-card li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
}
.vessel-class-card li:last-child {
  border-bottom: 0;
}
.vessel-class-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.vessel-class-copy strong {
  color: var(--ink);
  font-size: var(--text-label);
}
.vessel-class-copy span,
.vessel-class-copy small {
  color: var(--muted);
  font-size: var(--text-caption);
  line-height: 1.5;
}
.vessel-class-edit {
  flex: none;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 14px;
  color: var(--ocean);
  background: var(--surface-soft);
  cursor: pointer;
}
.vessel-class-message {
  padding: 0 16px;
  color: var(--muted);
}
.class-directory-details {
  border-top: 1px solid var(--line);
}
.class-directory-details summary {
  padding: 14px 16px;
  color: var(--ocean);
  cursor: pointer;
  font-size: var(--text-label);
  font-weight: 600;
}
.directory-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 130px 190px auto;
  align-items: end;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
}
label {
  display: grid;
  gap: 8px;
  min-width: 0;
  font-size: var(--text-label);
  font-weight: 600;
  color: var(--muted);
}
input:not([type='checkbox']),
select,
textarea {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
  color: var(--ink);
  font: inherit;
  font-size: var(--text-label);
}
textarea {
  resize: vertical;
  line-height: 1.5;
}
.directory-search {
  grid-column: 1 / -1;
}
.search-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
}
.search-input input {
  border: 0;
  background: transparent;
  outline: none;
}
.search-input .app-icon {
  flex: none;
  font-size: 17px;
}
.search-input:focus-within {
  outline: 2px solid var(--ocean);
  outline-offset: 2px;
}
.accommodation-workspace button,
.accommodation-dialog button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 40px;
  font-family: inherit;
  font-size: var(--text-label);
}
.accommodation-directory {
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
  background: var(--surface);
  min-width: 0;
}
.directory-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
}
.directory-heading > button {
  flex: none;
}
.directory-heading > button .app-icon {
  font-size: 17px;
}
.eyebrow {
  margin: 0 0 6px;
  font-size: var(--text-caption);
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--ocean);
}
h2 {
  margin: 0;
  font-size: 17px;
  color: var(--ink);
}
.directory-hint {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: var(--text-caption);
  line-height: 1.5;
}
.accommodation-directory :deep(.grid-tools) {
  padding: 8px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}
.accommodation-directory :deep(.grid-tools button) {
  min-height: 34px;
  padding: 6px 8px;
}
.accommodation-directory :deep(.desktop-grid) {
  padding: 8px;
}
.accommodation-directory :deep(.grid-cell-content) {
  padding: 7px 0;
  font-size: var(--text-label);
  line-height: 1.5;
}
.accommodation-directory :deep(.grid-row-actions) {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 7px 0;
}
.accommodation-workspace .class-edit {
  min-height: 32px;
  padding: 5px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
  color: var(--ocean);
  font-size: var(--text-caption);
  cursor: pointer;
}
.class-name,
.vessel-name {
  font-size: var(--text-label);
  font-weight: 650;
}
.class-number {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.class-description {
  min-width: 0;
}
.directory-footer {
  margin: 0;
  padding: 10px 16px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: var(--text-caption);
  line-height: 1.5;
}
.form-note {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--muted);
  line-height: 1.6;
}
.form-note a {
  color: var(--ocean);
}
.accommodation-modal {
  --width: min(640px, calc(100vw - 32px));
  --height: auto;
  --max-height: calc(100dvh - 40px);
  --border-radius: 16px;
  --background: var(--surface);
}
.accommodation-dialog {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: calc(100dvh - 40px);
  overflow: hidden;
  background: var(--surface);
  color: var(--ink);
  font-family: var(--ion-font-family);
}
.dialog-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--line);
  flex: none;
}
.dialog-symbol {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 10px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 22px;
}
.dialog-subtitle {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: var(--text-label);
  line-height: 1.5;
}
.accommodation-dialog .dialog-close {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: none;
  margin-left: auto;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 22px;
  cursor: pointer;
}
.accommodation-form {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.accommodation-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--muted) var(--surface);
}
.accommodation-fields {
  border: 0;
  margin: 0;
  min-width: 0;
  padding: 16px 20px;
}
.accommodation-field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 16px;
  margin-top: 12px;
}
.description-field {
  grid-column: 1 / -1;
}
.accommodation-fields label small {
  font-size: var(--text-caption);
  line-height: 1.5;
  font-weight: 400;
}
.capacity-note {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--light-blue);
  color: var(--ocean);
  margin: 14px 0 0;
}
.capacity-note .app-icon {
  font-size: 20px;
  flex: none;
}
.capacity-note span {
  display: grid;
  gap: 4px;
}
.capacity-note strong {
  font-size: var(--text-label);
  font-weight: 650;
}
.capacity-note small {
  font-size: var(--text-caption);
  line-height: 1.5;
  color: var(--muted);
}
.accommodation-availability {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
  color: var(--ink);
}
.accommodation-availability input {
  width: 17px;
  height: 17px;
  flex: none;
  accent-color: var(--ocean);
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex: none;
  padding: 14px 20px;
  border-top: 1px solid var(--line);
  background: var(--surface-soft);
}
.form-error {
  margin: 12px 20px 0;
  padding: 12px;
  border-radius: 9px;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: var(--text-label);
  line-height: 1.5;
  flex: none;
}
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
button:focus-visible {
  outline: 2px solid var(--ocean);
  outline-offset: 2px;
}
button:disabled,
input:disabled,
select:disabled {
  opacity: 0.6;
}
@media (max-width: 1000px) {
  .directory-filters {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .directory-filters > button {
    grid-column: 1 / -1;
    justify-self: start;
  }
}
@media (max-width: 699px) {
  .class-description {
    white-space: normal;
    overflow-wrap: anywhere;
  }
}
@media (max-width: 600px) {
  .directory-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .directory-filters,
  .directory-heading {
    padding: 16px;
  }
  .directory-filters > label[for='accommodation-sort'] {
    grid-column: 1 / -1;
  }
  .directory-filters > button {
    width: 100%;
  }
  .directory-heading {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 12px;
  }
  .accommodation-directory :deep(.grid-tools) {
    flex-wrap: wrap;
  }
  .accommodation-workspace .class-edit {
    min-height: 44px;
  }
  .accommodation-modal {
    --width: calc(100vw - 24px);
    --max-height: calc(100dvh - 24px);
  }
  .accommodation-dialog {
    max-height: calc(100dvh - 24px);
  }
  .dialog-heading,
  .accommodation-fields {
    padding: 16px;
  }
  .dialog-heading {
    align-items: flex-start;
    gap: 10px;
  }
  .accommodation-field-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  input:not([type='checkbox']),
  select,
  textarea {
    min-height: 44px;
    font-size: 16px;
  }
  .dialog-footer {
    padding: 12px 16px;
  }
  .dialog-footer button {
    flex: 1;
    min-height: 44px;
  }
}
</style>
