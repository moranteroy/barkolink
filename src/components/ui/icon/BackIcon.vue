<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue';
</script>

<template>
  <ArrowLeft class="app-icon back-icon" :size="20" :stroke-width="2" aria-hidden="true" focusable="false" />
</template>

<style scoped>
.back-icon { display: inline-block; width: 20px; height: 20px; flex-shrink: 0; vertical-align: middle; }
</style>
