<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { IonIcon } from "@ionic/vue";
import { resolveIcon } from "./icons";

// Keep existing Ionic icon values valid for toast APIs and data-driven menus,
// while rendering the same Lucide artwork used elsewhere in the application.
const props = defineProps<{ icon?: string }>();
const attrs = useAttrs();
const hidden = computed(() => attrs["aria-hidden"] ?? (attrs["aria-label"] || attrs["aria-labelledby"] ? undefined : true));
const artwork = computed(() => props.icon ? resolveIcon(props.icon) : undefined);
</script>

<template>
  <component v-if="artwork" :is="artwork" class="app-icon" size="1em" :aria-hidden="hidden" :role="hidden ? undefined : 'img'" focusable="false" />
  <IonIcon v-else :icon="icon" class="app-icon" :aria-hidden="hidden" />
</template>

<style scoped>
.app-icon { display: inline-block; width: 1em; height: 1em; flex-shrink: 0; vertical-align: middle; }
</style>
