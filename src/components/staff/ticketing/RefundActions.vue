<template>
  <form class="refund-actions" @submit.prevent="refund">
    <p>
      Cash refund due: <strong>PHP {{ amount.toLocaleString() }}</strong
      >. Record only after returning the cash.
    </p>
    <label
      >Refund receipt / note
      <input
        v-model.trim="note"
        minlength="3"
        maxlength="160"
        required
        :disabled="busy"
    /></label>
    <button :disabled="busy || note.length < 3">
      {{ busy ? "Recording..." : "Confirm cash returned" }}
    </button>
    <p v-if="error" role="alert">{{ error }}</p>
  </form>
</template>
<script setup lang="ts">
import { confirmAction } from "../../../composables/confirmation";
import { ref } from "vue";
import { staffDatabase } from "../../../services/session";
import { refundBooking } from "../../../services/database/operations";
import { databaseRequestError } from "../../../data/databaseErrors";
const props = defineProps<{ bookingId: string; amount: number }>();
const emit = defineEmits<{ refunded: [] }>();
const note = ref(""),
  busy = ref(false),
  error = ref("");
async function refund() {
  if (
    !staffDatabase ||
    busy.value ||
    note.value.length < 3 ||
    !(await confirmAction({
      title: "Confirm cash refund?",
      message: `Confirm you returned PHP ${props.amount.toLocaleString()} in cash?`,
      confirmText: "Confirm cash received",
      danger: false,
    }))
  )
    return;
  busy.value = true;
  error.value = "";
  try {
    await refundBooking(staffDatabase, props.bookingId, note.value);
    emit("refunded");
  } catch (cause) {
    error.value = databaseRequestError(cause, "Could not record refund.");
  } finally {
    busy.value = false;
  }
}
</script>
<style scoped>
.refund-actions {
  display: grid;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
label {
  display: grid;
  gap: 7px;
}
input,
button {
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-soft);
  color: var(--ink);
}
button {
  background: var(--light-blue);
  color: var(--ocean);
}
button:disabled {
  opacity: 0.5;
}
</style>
