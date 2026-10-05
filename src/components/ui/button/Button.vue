<script setup lang="ts">
import { Primitive, type PrimitiveProps } from "reka-ui";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";
defineOptions({ name: "UiButton" });

const props = withDefaults(defineProps<PrimitiveProps & {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  class?: HTMLAttributes["class"];
}>(), { as: "button", variant: "default", size: "default" });
const variants = cva("shrink-0 focus-visible:outline-2 disabled:pointer-events-none", {
  variants: { size: { default: "", sm: "text-xs", icon: "aspect-square px-2" } },
});
</script>
<template>
  <Primitive :as="as" :as-child="asChild" :type="as === 'button' ? 'button' : undefined"
    data-slot="button" :data-variant="variant" :class="cn(variants({ size }), props.class)">
    <slot />
  </Primitive>
</template>
