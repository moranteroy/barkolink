<template>
  <div class="city-picker" :class="{ destination: destination }">
    <span :id="`${id}-label`" class="field-label">{{ label }}</span>
    <SelectRoot :model-value="modelValue" :disabled="disabled" @update:model-value="update">
      <SelectTrigger class="city-trigger" :aria-labelledby="`${id}-label ${id}-value`">
        <span class="city-icon"><component :is="destination ? Flag : MapPin" :size="18" aria-hidden="true" /></span>
        <span :id="`${id}-value`" class="city-value"><strong>{{ modelValue || (disabled ? 'Loading ports…' : 'Choose a city') }}</strong><small>{{ destination ? 'Arrival port' : 'Departure port' }}</small></span>
        <ChevronDown :size="16" class="city-chevron" aria-hidden="true" />
      </SelectTrigger>
      <SelectPortal><SelectContent class="barkolink-city-menu" position="popper" :side-offset="7" :collision-padding="12">
        <div class="city-menu-title">{{ destination ? 'Where are you heading?' : 'Where are you sailing from?' }}</div>
        <SelectViewport class="city-options"><SelectItem v-for="option in options" :key="option.value" :value="option.value" class="city-option">
          <span class="option-icon"><Anchor :size="16" aria-hidden="true" /></span><SelectItemText class="option-copy"><strong>{{ option.value }}</strong><small>{{ option.description }}</small></SelectItemText><SelectItemIndicator class="city-check"><Check :size="16" aria-hidden="true" /></SelectItemIndicator>
        </SelectItem></SelectViewport>
      </SelectContent></SelectPortal>
    </SelectRoot>
  </div>
</template>
<script setup lang="ts">
import { useId } from 'vue';
import { MapPin, Flag, ChevronDown, Anchor, Check } from '@lucide/vue';
import { SelectRoot, SelectTrigger, SelectPortal, SelectContent, SelectViewport, SelectItem, SelectItemText, SelectItemIndicator } from 'reka-ui';
defineProps<{ modelValue: string; label: string; options: { value: string; description: string }[]; disabled?: boolean; destination?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const id = useId();
function update(value: unknown) { if (typeof value === 'string') emit('update:modelValue', value); }
</script>
<style scoped>
.city-picker { min-width:0; --city-accent:var(--ocean); }.city-picker.destination { --city-accent:#299e91; }
.field-label { display:block; margin-bottom:7px; color:var(--muted); font-size:10px; font-weight:700; letter-spacing:.04em; }
.city-trigger { display:flex; align-items:center; gap:9px; min-height:60px; width:100%; padding:10px; border:1px solid var(--line); border-radius:12px; background:var(--surface-soft); color:var(--ink); font:inherit; text-align:left; cursor:pointer; transition:border-color .18s,background .18s; }
.city-trigger:hover,.city-trigger[data-state="open"] { border-color:var(--city-accent); background:color-mix(in srgb,var(--city-accent) 5%,var(--surface-soft)); }.city-trigger:disabled { opacity:.6; cursor:default; }
.city-icon { display:grid; place-items:center; width:32px; height:32px; flex-shrink:0; border-radius:9px; background:color-mix(in srgb,var(--city-accent) 12%,transparent); color:var(--city-accent); }
.city-value { flex:1; min-width:0; display:grid; gap:3px; }.city-value strong { font-size:13px; line-height:1.4; overflow-wrap:anywhere; }.city-value small { color:var(--muted); font-size:9px; line-height:1.5; }
.city-chevron { flex-shrink:0; color:var(--city-accent); transition:transform .18s; }.city-trigger[data-state="open"] .city-chevron { transform:rotate(180deg); }
.city-trigger:focus-visible { outline:2px solid var(--city-accent); outline-offset:3px; }
:global(.barkolink-city-menu) { z-index:20000; box-sizing:border-box; width:var(--reka-select-trigger-width); min-width:min(240px,calc(100vw - 24px)); max-width:calc(100vw - 24px); max-height:var(--reka-select-content-available-height); border:1px solid var(--line); border-radius:14px; padding:6px; background:var(--surface); color:var(--ink); box-shadow:0 14px 40px #061a3533; }
.city-menu-title { padding:8px 10px; color:var(--muted); font-size:10px; line-height:1.5; }.city-options { max-height:250px; overflow-y:auto; }
.city-option { display:flex; align-items:center; gap:9px; min-height:56px; padding:8px 10px; border-radius:9px; outline:none; cursor:pointer; }.city-option[data-highlighted],.city-option[data-state="checked"] { background:var(--light-blue); }
.option-icon { display:grid; place-items:center; flex-shrink:0; width:30px; height:30px; border-radius:9px; background:var(--light-blue); color:var(--ocean); }.option-copy { display:grid; flex:1; min-width:0; gap:3px; }.option-copy strong { font-size:12px; line-height:1.4; }.option-copy small { color:var(--muted); font-size:10px; line-height:1.5; overflow-wrap:anywhere; }.city-check { color:var(--ocean); flex-shrink:0; }
@media(prefers-reduced-motion:reduce) { .city-trigger,.city-chevron { transition:none; } }
</style>
