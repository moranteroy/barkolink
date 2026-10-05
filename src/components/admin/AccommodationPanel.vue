<template>
  <section class="catalog-panel">
    <div class="catalog-tools">
      <p>
        Allocate seating classes within each vessel's capacity. Existing
        bookings keep their selected class and price.
      </p>
      <button class="primary-button" @click="start()">Add accommodation</button>
    </div>
    <p v-if="error" role="alert" class="catalog-error">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <form v-if="editing" class="catalog-form" @submit.prevent="save">
      <h2>{{ form.id ? "Edit accommodation" : "Add accommodation" }}</h2>
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
      ><label
        >Description<input
          v-model.trim="form.description"
          maxlength="500" /></label
      ><label
        >Class capacity<input
          v-model.number="form.capacity"
          type="number"
          min="1"
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
      ><label class="catalog-checkbox"
        ><input v-model="form.isActive" type="checkbox" />Available for new
        bookings</label
      >
      <div class="catalog-actions">
        <button class="primary-button" :disabled="busy">
          {{ busy ? "Saving…" : "Save accommodation" }}</button
        ><button type="button" :disabled="busy" @click="editing = false">
          Cancel
        </button>
      </div>
    </form>
    <div class="catalog-table">
      <table>
        <thead>
          <tr>
            <th>Class</th>
            <th>Vessel</th>
            <th>Description</th>
            <th>Capacity</th>
            <th>Extra fare</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in rows" :key="a.id">
            <td data-label="Class">
              <strong>{{ a.name }}</strong>
            </td>
            <td data-label="Vessel">{{ a.vesselName }}</td>
            <td data-label="Description">
              {{ a.description || "Standard seating" }}
            </td>
            <td data-label="Capacity">{{ a.capacity }}</td>
            <td data-label="Extra fare">
              PHP {{ a.surcharge.toLocaleString() }}
            </td>
            <td data-label="Status">
              <span class="status">{{
                a.isActive ? "Active" : "Inactive"
              }}</span>
            </td>
            <td data-label="Actions">
              <button @click="start(a)">Edit</button>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="7">
              {{
                loading
                  ? "Loading accommodations…"
                  : "No classes yet. Add the seating classes your operator offers."
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
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
  notice.value = "";
}
async function load() {
  if (!staffDatabase) return;
  loading.value = true;
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
  busy.value = true;
  error.value = "";
  try {
    await saveAccommodation(staffDatabase, {
      ...form,
      id: form.id || undefined,
    });
    editing.value = false;
    await load();
    notice.value = "Accommodation saved.";
  } catch (e) {
    error.value = databaseRequestError(e, "Could not save accommodation.");
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
