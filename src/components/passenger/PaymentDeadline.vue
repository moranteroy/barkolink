<template>
  <div
    v-if="valid"
    class="deadline"
    :class="{ urgent: seconds <= 3600 }"
  >
    <ion-icon :icon="timeOutline" aria-hidden="true" />
    <div role="status" aria-live="polite" aria-atomic="true">
      <strong>{{
        seconds > 0 ? "Pay at the ticketing desk" : "Payment deadline reached"
      }}</strong
      ><small>{{
        seconds > 0
          ? `Reservation expires ${formatted}`
          : "Checking your reservation status…"
      }}</small>
    </div>
    <b v-if="seconds > 0" aria-live="off" :aria-label="`Time remaining: ${remaining}`">{{ remaining }}</b>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { IonIcon } from "@ionic/vue";
import { timeOutline } from "ionicons/icons";
const props = defineProps<{ deadline: string }>();
const emit = defineEmits<{ expired: [] }>();
const now = ref(Date.now());
const valid = computed(() => Number.isFinite(Date.parse(props.deadline)));
const seconds = computed(() =>
  Math.max(0, Math.ceil((Date.parse(props.deadline) - now.value) / 1000)),
);
const formatted = computed(() =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(props.deadline)),
);
const remaining = computed(
  () =>
    `${Math.floor(seconds.value / 3600)}h ${String(Math.floor((seconds.value % 3600) / 60)).padStart(2, "0")}m ${String(seconds.value % 60).padStart(2, "0")}s`,
);
let timer: ReturnType<typeof setInterval> | undefined;
let notified = false;
watch(
  () => props.deadline,
  () => {
    notified = false;
  },
);
function checkDeadline() {
  if (valid.value && seconds.value === 0 && !notified) {
    notified = true;
    emit("expired");
  }
}
watch(seconds, checkDeadline);
onMounted(() => {
  checkDeadline();
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onUnmounted(() => clearInterval(timer));
</script>
<style scoped>
.deadline {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 0;
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--light-blue);
  color: var(--ocean);
}
.deadline ion-icon {
  font-size: 22px;
  flex: none;
}
.deadline div {
  display: grid;
  gap: 5px;
  flex: 1;
}
.deadline strong {
  font-size: 12px;
}
.deadline small {
  font-size: 11px;
  color: var(--muted);
}
.deadline b {
  font-size: 12px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.urgent {
  border-color: #b7791f;
  background: var(--surface-soft);
}
@media (max-width: 420px) {
  .deadline {
    flex-wrap: wrap;
  }
  .deadline b {
    margin-left: 32px;
  }
}
</style>
