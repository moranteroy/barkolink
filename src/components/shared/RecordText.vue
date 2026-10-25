<template>
  <div class="record-text">
    <span>{{ expanded || text.length <= limit ? text : text.slice(0, limit).trimEnd() + '…' }}</span>
    <button v-if="text.length > limit" type="button" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? 'Show less' : 'Read more' }}</button>
  </div>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';
const props = withDefaults(defineProps<{ text: string; limit?: number }>(), { limit: 90 });
const expanded = ref(false);
watch(() => props.text, () => { expanded.value = false; });
</script>
<style scoped>
.record-text { display: grid; gap: 4px; min-width: 0; white-space: normal; overflow-wrap: anywhere; line-height: 1.5; }
.record-text button { justify-self: start; min-height: 32px; padding: 3px 0; border: 0; background: transparent; color: var(--ocean); font: inherit; font-size: var(--text-caption); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.record-text button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
@media(max-width:699px) { .record-text button { min-height: 44px; } }
</style>
