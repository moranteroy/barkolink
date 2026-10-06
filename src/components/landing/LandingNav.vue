<template>
  <header class="landing-nav" :class="{ solid: scrolled || open }" @keydown.esc="closeMenu(true)">
    <div class="landing-container nav-row">
      <RouterLink to="/" aria-label="BarkoLink home"><BrandMark /></RouterLink>
      <nav class="desktop-links" aria-label="Main navigation"><a v-for="link in links" :key="link.id" :href="`#${link.id}`" @click.prevent="emit('navigate', link.id)">{{ link.label }}</a></nav>
      <div class="desktop-actions"><RouterLink to="/login">Sign in</RouterLink><RouterLink class="landing-button small" to="/search?all=1">Book Now</RouterLink></div>
      <button ref="toggle" class="menu-toggle" type="button" :aria-expanded="open" aria-controls="landing-mobile-menu" :aria-label="open ? 'Close navigation' : 'Open navigation'" @click="open = !open"><IonIcon :icon="open ? closeOutline : menuOutline" aria-hidden="true" /></button>
    </div>
    <nav v-if="open" id="landing-mobile-menu" class="mobile-links landing-container" aria-label="Mobile navigation">
      <a v-for="link in links" :key="link.id" :href="`#${link.id}`" @click.prevent="closeMenu(); emit('navigate', link.id)">{{ link.label }}</a>
      <RouterLink to="/login" @click="closeMenu()">Sign in</RouterLink><RouterLink class="landing-button" to="/search?all=1" @click="closeMenu()">Book Now</RouterLink>
    </nav>
  </header>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import { closeOutline, menuOutline } from 'ionicons/icons';
import BrandMark from '../shared/BrandMark.vue';
defineProps<{ scrolled: boolean }>();
const emit = defineEmits<{ navigate: [id: string] }>();
const open = ref(false), toggle = ref<HTMLButtonElement>();
const links = [{ id: 'routes', label: 'Routes' }, { id: 'features', label: 'Features' }, { id: 'how-it-works', label: 'How it works' }, { id: 'fleet', label: 'Fleet' }];
function closeMenu(restoreFocus = false) { open.value = false; if (restoreFocus) toggle.value?.focus(); }
</script>
