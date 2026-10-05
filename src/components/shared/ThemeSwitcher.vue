<template>
  <ToggleGroup class="theme-switcher" type="single" :model-value="mode" aria-label="Color theme" @update:model-value="selectMode">
    <ToggleGroupItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :class="{ selected: mode === option.value }"
      :aria-label="`${option.label} theme`"
      :title="`${option.label} theme`"
    >
      <component :is="option.icon" aria-hidden="true" /><span>{{ option.label }}</span>
    </ToggleGroupItem>
  </ToggleGroup>
</template>
<script setup lang="ts">
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Monitor, Moon, Sun } from "@lucide/vue";
import { useTheme, type ThemeMode } from "../../composables/useTheme";
const { mode, setMode } = useTheme();
const options: {
  value: ThemeMode;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];
function selectMode(value: unknown) {
  if (value === "light" || value === "dark" || value === "system") setMode(value);
}
</script>
<style scoped>
.theme-switcher {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 5px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: 0 5px 18px rgba(16, 43, 76, 0.08);
}
.theme-switcher button {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 10px 16px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.theme-switcher button svg {
  width: 17px;
  height: 17px;
}
.theme-switcher button.selected {
  background: var(--light-blue);
  color: var(--ocean);
}
@media (max-width: 620px) {
  .theme-switcher {
    width: 100%;
  }
  .theme-switcher button span {
    display: inline;
  }
  .theme-switcher button {
    flex: 1;
    justify-content: center;
    padding: 10px;
  }
}
</style>
