<template>
  <div class="discount-verification">
    <small v-if="verified">Discount eligibility verified.</small>
    <template v-else>
      <label
        ><input v-model="checked" type="checkbox" :disabled="busy" /> I checked
        this passenger's discount eligibility.</label
      >
      <label
        >Verification note
        <input
          v-model.trim="note"
          maxlength="160"
          placeholder="Student ID checked; do not enter ID numbers"
          :disabled="busy"
      /></label>
      <button
        type="button"
        :disabled="busy || !checked || note.length < 3"
        @click="verify"
      >
        {{ busy ? "Saving..." : "Verify discount" }}
      </button>
    </template>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { staffDatabase } from "../../../services/session";
import { verifyPassengerDiscount } from "../../../services/database/operations";
import { databaseRequestError } from "../../../data/databaseErrors";
const props = defineProps<{ passengerId: string; verified: boolean }>();
const emit = defineEmits<{ verified: [] }>();
const checked = ref(false),
  note = ref(""),
  busy = ref(false),
  error = ref("");
async function verify() {
  if (!staffDatabase || busy.value || !checked.value || note.value.length < 3)
    return;
  busy.value = true;
  error.value = "";
  try {
    await verifyPassengerDiscount(staffDatabase, props.passengerId, note.value);
    emit("verified");
  } catch (cause) {
    error.value = databaseRequestError(cause, "Could not verify discount.");
  } finally {
    busy.value = false;
  }
}
</script>
<style scoped>
.discount-verification {
  display: grid;
  gap: 9px;
  width: 100%;
  margin-top: 10px;
  font-size: 12px;
}
label {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
input:not([type="checkbox"]) {
  width: 100%;
  padding: 9px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
  color: var(--ink);
}
button {
  padding: 9px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--light-blue);
  color: var(--ocean);
}
button:disabled {
  opacity: 0.5;
}
p {
  color: #b8463c;
}
</style>
