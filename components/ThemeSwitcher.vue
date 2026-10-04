<template>
  <div class="theme-switcher" role="group" aria-label="Color theme">
    <button v-for="option in options" :key="option.value" :class="{ selected: mode === option.value }" :aria-label="`${option.label} theme`" :title="`${option.label} theme`" @click="setMode(option.value)"><ion-icon :icon="option.icon" /><span>{{ option.label }}</span></button>
  </div>
</template>
<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { contrastOutline, moonOutline, sunnyOutline } from 'ionicons/icons'
import { useTheme, type ThemeMode } from '../src/composables/useTheme'
const { mode, setMode } = useTheme()
const options: { value: ThemeMode; label: string; icon: typeof sunnyOutline }[] = [{ value: 'light', label: 'Light', icon: sunnyOutline }, { value: 'dark', label: 'Dark', icon: moonOutline }, { value: 'system', label: 'System', icon: contrastOutline }]
</script>
<style scoped>
.theme-switcher{position:fixed;top:14px;right:18px;z-index:9999;display:flex;align-items:center;gap:2px;padding:3px;border:1px solid var(--line);border-radius:10px;background:var(--surface);box-shadow:0 5px 18px rgba(16,43,76,.08)}.theme-switcher button{display:flex;align-items:center;gap:4px;padding:6px 8px;border:0;border-radius:7px;background:transparent;color:var(--muted);font:inherit;font-size:9px;font-weight:800;cursor:pointer}.theme-switcher button ion-icon{font-size:14px}.theme-switcher button.selected{background:var(--ocean);color:#fff}@media(max-width:620px){.theme-switcher{top:auto;right:12px;bottom:76px}.theme-switcher button span{display:none}.theme-switcher button{padding:7px}}
</style>
