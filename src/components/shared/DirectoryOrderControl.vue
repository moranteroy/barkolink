<template>
  <label class="directory-order-control" :for="'directory-order-' + section">
    <span>Sort all records</span>
    <select
      :id="'directory-order-' + section"
      :value="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">{{ section === 'trips' ? 'Today first (PH)' : 'Default order' }}</option>
      <template v-if="section === 'trips'">
        <option value="departure:asc">Departure: earliest first</option>
        <option value="departure:desc">Departure: latest first</option>
        <option value="name:asc">Vessel: A–Z</option>
      </template>
      <template v-else
        ><option value="name:asc">Name: A–Z</option>
        <option value="name:desc">Name: Z–A</option></template
      >
    </select>
  </label>
</template>
<script setup lang="ts">
defineProps<{ modelValue: string; section: string }>();
defineEmits<{ 'update:modelValue': [value: string] }>();
</script>
<style scoped>
.directory-order-control {
  display: grid;
  gap: 6px;
  min-width: 0;
  margin: 0;
  color: var(--muted);
  font-size: var(--text-label);
  font-weight: 600;
}
.directory-order-control select {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  padding: 8px 30px 8px 10px;
  border: 1px solid var(--line);
  border-radius: var(--button-radius);
  background: var(--surface-soft);
  color: var(--ink);
  font: inherit;
  font-weight: 400;
}
.directory-order-control select:focus-visible {
  outline: 2px solid var(--ocean);
  outline-offset: 2px;
}
@media (max-width: 600px) {
  .directory-order-control select {
    min-height: 44px;
    font-size: 16px;
  }
}
</style>
