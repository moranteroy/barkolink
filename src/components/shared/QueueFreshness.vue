<script setup lang="ts">
import { computed } from 'vue';
import { Clock3, RefreshCw, WifiOff } from '@lucide/vue';
const props = defineProps<{ updatedAt: number | null; loading: boolean; error?: string; interval?: number }>();
const updated = computed(() => props.updatedAt ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(props.updatedAt) : '');
</script>

<template>
  <div class="queue-freshness" :class="{ stale: error }" role="status" aria-live="polite">
    <WifiOff v-if="error" :size="16" aria-hidden="true" />
    <RefreshCw v-else-if="loading" :size="16" aria-hidden="true" />
    <Clock3 v-else :size="16" aria-hidden="true" />
    <span v-if="error">Update unavailable. {{ updatedAt ? `Showing records last updated at ${updated} (PH).` : 'Refresh to load records.' }} Refresh before recording a payment or attendance.</span>
    <span v-else-if="loading">{{ updatedAt ? `Refreshing · last updated ${updated} (PH)` : 'Loading current records…' }}</span>
    <span v-else-if="updatedAt">Updated {{ updated }} (PH) · Auto-update: {{ interval || 15 }}s</span>
    <span v-else>Waiting for the first update</span>
  </div>
</template>

<style scoped>
.queue-freshness { display:flex; align-items:center; gap:8px; margin:12px 0; color:var(--muted); font-size:13px; line-height:1.6; }
.queue-freshness svg { flex:none; }.queue-freshness.stale { padding:12px; border:1px solid var(--warning-border, var(--line)); border-radius:var(--button-radius); color:var(--warning-text, var(--ink)); background:var(--surface-soft); }
</style>
