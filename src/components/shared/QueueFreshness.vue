<script setup lang="ts">
import { RefreshCw, WifiOff } from '@lucide/vue';
defineProps<{ updatedAt: number | null; loading: boolean; error?: string; interval?: number }>();
</script>

<template>
  <div v-if="error || (loading && !updatedAt)" class="queue-freshness" :class="{ stale: error }" role="status" aria-live="polite">
    <WifiOff v-if="error" :size="16" aria-hidden="true" />
    <RefreshCw v-else-if="loading" :size="16" aria-hidden="true" />
    <span v-if="error">Update unavailable. {{ updatedAt ? 'Showing previously loaded records.' : 'Refresh to load records.' }} Refresh before recording a payment or attendance.</span>
    <span v-else>Loading current records…</span>
  </div>
</template>

<style scoped>
.queue-freshness { display:flex; align-items:center; gap:8px; margin:12px 0; color:var(--muted); font-size:13px; line-height:1.6; }
.queue-freshness svg { flex:none; }.queue-freshness.stale { padding:12px; border:1px solid var(--warning-border, var(--line)); border-radius:var(--button-radius); color:var(--warning-text, var(--ink)); background:var(--surface-soft); }
</style>
