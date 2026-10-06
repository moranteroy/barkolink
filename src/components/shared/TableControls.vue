<template>
  <div class="catalog-tools">
    <label>Filter loaded records<input v-model="query" type="search" placeholder="Search this loaded list" /></label>
    <label>Sort loaded records<select v-model="sort"><option value="">Original order</option><template v-for="column in columns" :key="column.key"><option :value="`${column.key}:asc`">{{ column.label }}: ascending</option><option :value="`${column.key}:desc`">{{ column.label }}: descending</option></template></select></label>
  </div>
</template>
<script setup lang="ts">
defineProps<{ columns: { key: string; label: string }[] }>();
const query = defineModel<string>('query', { default: '' });
const sort = defineModel<string>('sort', { default: '' });
</script>
<style scoped>
label { display: grid; gap: 6px; font-size: 12px; }
input, select { min-height: 44px; max-width: 100%; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); padding: 8px; }
</style>
