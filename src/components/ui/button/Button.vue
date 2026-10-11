<script setup lang="ts">
import { Primitive, type PrimitiveProps } from "reka-ui";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";
defineOptions({ name: "UiButton" });

const props = withDefaults(defineProps<PrimitiveProps & {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  class?: HTMLAttributes["class"];
}>(), { as: "button", variant: "default", size: "default" });
</script>
<template>
  <Primitive :as="as" :as-child="asChild" :type="as === 'button' ? 'button' : undefined"
    data-slot="button" :data-variant="variant" :data-size="size" :class="cn('shrink-0', props.class)">
    <slot />
  </Primitive>
</template>
