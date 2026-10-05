<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";
defineOptions({ name: "UiSkeleton" });
const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>
<template><div data-slot="skeleton" aria-hidden="true" :class="cn(props.class)" /></template>
