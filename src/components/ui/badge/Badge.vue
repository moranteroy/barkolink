<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";
defineOptions({ name: "UiBadge" });
const props = withDefaults(defineProps<{
  variant?: "default" | "success" | "warning" | "destructive";
  class?: HTMLAttributes["class"];
}>(), { variant: "default" });
</script>
<template><span data-slot="badge" :data-variant="variant" :class="cn(props.class)"><slot /></span></template>
