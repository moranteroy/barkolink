<template>
  <div class="boarding-progress">
    <span
      >Boarding progress <strong>{{ boarded }} / {{ total }}</strong></span
    >
    <div
      class="progress-track"
      role="progressbar"
      aria-label="Passengers boarded"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <i :style="{ width: `${percent}%` }"></i>
    </div>
    <strong>{{ percent }}%</strong>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{ boarded: number; total: number }>();
const percent = computed(() =>
  props.total
    ? Math.min(100, Math.round((props.boarded / props.total) * 100))
    : 0,
);
</script>
<style scoped>
.boarding-progress {
  display: flex;
  align-items: center;
  gap: 18px;
  margin: 18px 0;
  color: var(--muted);
  font-size: 11px;
}
.boarding-progress > span {
  display: flex;
  gap: 12px;
  white-space: nowrap;
}
.boarding-progress strong {
  color: var(--ink);
}
.progress-track {
  flex: 1;
  height: 7px;
  border-radius: 99px;
  background: var(--line);
  overflow: hidden;
}
.progress-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ocean);
  transition: width 0.2s;
}
@media (max-width: 580px) {
  .boarding-progress {
    flex-wrap: wrap;
  }
  .boarding-progress > span {
    font-size: 10px;
    gap: 8px;
  }
  .progress-track {
    min-width: 90px;
  }
}
</style>
