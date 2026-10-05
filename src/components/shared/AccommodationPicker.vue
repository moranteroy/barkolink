<template>
  <section v-if="options.length" class="accommodation-picker">
    <h2>Choose accommodation</h2>
    <p>Additional fares apply per passenger after passenger discounts.</p>
    <div class="accommodation-options">
      <label
        v-for="item in options"
        :key="item.id"
        :class="{
          selected: modelValue === item.id,
          unavailable: (item.availableSeats ?? item.capacity) < passengerCount,
        }"
        ><input
          type="radio"
          name="accommodation"
          :value="item.id"
          :checked="modelValue === item.id"
          :disabled="(item.availableSeats ?? item.capacity) < passengerCount"
          @change="$emit('update:modelValue', item.id)"
        /><span
          ><strong>{{ item.name }}</strong
          ><small>{{ item.description }}</small
          ><small
            >{{ item.availableSeats ?? item.capacity }} seats available</small
          ></span
        ><b>{{
          item.surcharge
            ? `+ PHP ${item.surcharge.toLocaleString()}`
            : "Included"
        }}</b></label
      >
    </div>
  </section>
</template>
<script setup lang="ts">
import type { Accommodation } from "../../services/database/workspaces";
defineProps<{
  options: Accommodation[];
  modelValue: string;
  passengerCount: number;
}>();
defineEmits<{ "update:modelValue": [id: string] }>();
</script>
<style scoped>
.accommodation-picker {
  margin: 20px 0;
  color: var(--ink);
}
h2 {
  font-size: 16px;
  margin: 0 0 8px;
}
p {
  font-size: 11px;
  line-height: 1.6;
  color: var(--muted);
}
.accommodation-options {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}
label {
  display: flex;
  gap: 12px;
  padding: 15px;
  border: 1px solid var(--line);
  border-radius: 12px;
  align-items: center;
  background: var(--surface);
  cursor: pointer;
}
label.selected {
  border-color: #187dd1;
  background: var(--light-blue);
}
label.unavailable {
  opacity: 0.55;
  cursor: default;
}
input {
  accent-color: #187dd1;
  width: 17px;
  height: 17px;
  flex: none;
}
span {
  flex: 1;
  min-width: 0;
}
strong {
  font-size: 13px;
}
small {
  display: block;
  color: var(--muted);
  font-size: 10px;
  margin-top: 5px;
}
b {
  font-size: 11px;
  color: #1676c5;
  white-space: nowrap;
}
</style>
