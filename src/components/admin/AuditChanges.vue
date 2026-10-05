<template>
  <dl v-if="changes.length" class="readable-changes">
    <div v-for="(change, index) in changes" :key="index">
      <dt>{{ change.label }}</dt>
      <dd>{{ change.text }}</dd>
    </div>
  </dl>
  <span v-else class="no-changes">No additional details</span>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { auditChanges } from "../../data/auditPresentation";
const props = defineProps<{ details?: Record<string, unknown> | null }>();
const changes = computed(() => auditChanges(props.details));
</script>
<style scoped>
.readable-changes {
  display: grid;
  gap: 12px;
  margin: 12px 0 0;
  min-width: 150px;
  max-width: 340px;
  font-size: 12px;
  text-align: left;
  line-height: 1.6;
}
.readable-changes > div {
  padding-left: 10px;
  border-left: 2px solid var(--line);
}
dt {
  font-size: 10px;
  font-weight: 650;
  color: var(--muted);
  margin-bottom: 3px;
}
dd {
  margin: 0;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.no-changes {
  font-size: 11px;
  color: var(--muted);
}
</style>
