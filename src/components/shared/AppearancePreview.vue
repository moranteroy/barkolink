<template>
  <div class="appearance-previews" aria-label="Theme previews">
    <Card v-for="option in options" :key="option.mode" :class="{ active: mode === option.mode }">
      <button type="button" :aria-label="`Use ${option.label.toLowerCase()} appearance`"
        :aria-pressed="mode === option.mode" @click="setMode(option.mode)">
        <span class="preview-canvas" :class="option.mode"><i /><span><i /><i /><i /></span></span>
        <span class="preview-label"><component :is="option.icon" />{{ option.label }}<Check v-if="mode === option.mode" /></span>
        <small>{{ option.note }}</small>
      </button>
    </Card>
  </div>
  <p class="resolved-theme" role="status">Currently using {{ resolvedTheme }} appearance.</p>
</template>
<script setup lang="ts">
import { Sun, Moon, Monitor, Check } from "@lucide/vue";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/composables/useTheme";
const { mode, resolvedTheme, setMode } = useTheme();
const options = [
  { mode: "light", label: "Light", icon: Sun, note: "Bright and clear" },
  { mode: "dark", label: "Dark", icon: Moon, note: "Comfort in low light" },
  { mode: "system", label: "System", icon: Monitor, note: "Follow your device" },
] as const;
</script>
<style scoped>
.appearance-previews { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; margin-top: 22px; }
.active { border-color: var(--ocean); box-shadow: 0 0 0 1px var(--ocean); }
button { width: 100%; padding: 10px; border: 0; background: transparent; text-align: left; color: var(--ink); cursor: pointer; }
.preview-canvas { display: flex; gap: 8px; height: 80px; padding: 14px 10px; border-radius: 8px; background: #eef3f9; border: 1px solid #d8e2ed; }
.preview-canvas.dark { background: #101d2d; border-color: #263b50; }
.preview-canvas.system { background: linear-gradient(90deg,#eef3f9 50%,#101d2d 50%); }
.preview-canvas > i { width: 18%; background: #2375c4; border-radius: 4px; }
.preview-canvas > span { flex: 1; display: grid; gap: 6px; }
.preview-canvas > span i { background: #8a9bab66; border-radius: 3px; }
.preview-label { display: flex; align-items: center; gap: 5px; margin-top: 12px; font-size: 12px; font-weight: 650; }
.preview-label svg { width: 14px; height: 14px; }
.preview-label svg:last-child:not(:first-child) { margin-left: auto; color: var(--ocean); }
small { display: block; color: var(--muted); font-size: 10px; margin-top: 6px; line-height: 1.5; }
.resolved-theme { color: var(--muted); font-size: 12px; margin-top: 14px; }
</style>
