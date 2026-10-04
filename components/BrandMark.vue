<template>
  <div class="brand-mark" aria-label="BarkoLink home">
    <span class="brand-symbol"><ion-icon :icon="boatOutline" /></span>
    <span class="brand-copy"><strong>Barko</strong><b>Link</b><small>Travel smarter. Sail easier.</small></span>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { boatOutline } from 'ionicons/icons'
</script>

<style scoped>
.brand-mark { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); }
.brand-symbol { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; background: var(--ocean); color: #fff; font-size: 21px; box-shadow: 0 8px 18px rgba(21,101,192,.2); }
.brand-copy { display: grid; line-height: 1; }
.brand-copy strong { font-size: 18px; letter-spacing: -.5px; }
.brand-copy b { color: var(--ocean); font-size: 18px; }
.brand-copy small { margin-top: 5px; color: var(--muted); font-size: 9px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
</style>
