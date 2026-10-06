<template>
  <nav class="workspace-pagination" :aria-label="label">
    <span class="pagination-note"><slot>{{ total.toLocaleString() }} {{ itemLabel }}</slot></span>
    <div class="pagination-controls">
      <Button variant="outline" :disabled="disabled || page <= 0" @click="move(-1)">Previous</Button>
      <span class="pagination-position" aria-live="polite">Page {{ page + 1 }} of {{ pageCount }}</span>
      <Button variant="outline" :disabled="disabled || page + 1 >= pageCount" @click="move(1)">Next</Button>
    </div>
  </nav>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { Button } from '@/components/ui/button';
const props = withDefaults(defineProps<{ page: number; total: number; pageSize?: number; disabled?: boolean; label?: string; itemLabel?: string }>(), { pageSize: 30, disabled: false, label: 'Record pages', itemLabel: 'records' });
const emit = defineEmits<{ change: [page: number] }>();
const pageCount = computed(() => Math.max(1, Math.ceil(props.total / Math.max(1, props.pageSize))));
function move(delta: number) {
  const next = props.page + delta;
  if (!props.disabled && next >= 0 && next < pageCount.value) emit('change', next);
}
</script>
<style scoped>
.workspace-pagination { border-top:1px solid var(--line); padding:18px 22px; display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; align-items:center; font-size:11px; color:var(--muted); background:var(--surface); }
.pagination-controls { display:flex; align-items:center; gap:12px; }
.pagination-position { white-space:nowrap; font-variant-numeric:tabular-nums; }
.workspace-pagination button { display:inline-flex; align-items:center; justify-content:center; min-height:40px; padding:9px 14px; border:1px solid var(--line); border-radius:10px; background:var(--surface); color:var(--ink); font:inherit; font-size:12px; font-weight:600; margin:0; }
.workspace-pagination button:disabled { opacity:.5; cursor:default; }
@media(max-width:600px) { .workspace-pagination { padding:16px; } .pagination-controls { width:100%; justify-content:space-between; gap:8px; } }
</style>
