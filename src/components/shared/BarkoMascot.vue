<template>
  <span class="barko-mascot" :class="{ 'barko-mascot--portrait': portrait }" aria-hidden="true">
    <img :src="mascotUrl" alt="" width="1024" height="1536" decoding="async" draggable="false" />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = withDefaults(defineProps<{ portrait?: boolean; character?: 'male' | 'female' }>(), { portrait: false, character: 'male' });
const mascotUrl = computed(() => `${import.meta.env.BASE_URL}images/mascot/${props.character === 'female' ? 'barkolink-passenger-service-female-anime-v1.png' : 'barkolink-captain-anime-v1.png'}`);
</script>

<style scoped>
.barko-mascot { display: block; width: 104px; aspect-ratio: 2 / 3; flex-shrink: 0; }
img { display: block; width: 100%; height: 100%; object-fit: contain; }
.barko-mascot--portrait { position: relative; width: 36px; aspect-ratio: 1; border-radius: 50%; overflow: hidden; background: var(--light-blue); }
.barko-mascot--portrait img { position: absolute; width: 140%; max-width: none; height: auto; left: -20%; top: -4%; }
</style>
