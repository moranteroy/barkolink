<script setup lang="ts">
import { DropdownMenuContent, DropdownMenuPortal, useForwardPropsEmits,
  type DropdownMenuContentProps, type DropdownMenuContentEmits } from "reka-ui";
defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<DropdownMenuContentProps>(), { sideOffset: 6 });
const emits = defineEmits<DropdownMenuContentEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>
<template>
  <DropdownMenuPortal>
    <DropdownMenuContent v-bind="{ ...forwarded, ...$attrs }" class="ui-menu">
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
