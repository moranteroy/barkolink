<template>
  <div class="brand-mark" aria-label="BarkoLink home">
    <span class="brand-symbol"><img :src="brandMarkSrc" alt="" width="38" height="38" /></span>
    <span class="brand-copy"
      ><strong>Barko</strong><b>Link</b
      ><small>Travel smarter. Sail easier.</small></span
    >
  </div>
</template>

<script setup lang="ts">
// Public assets use their served URL in both the browser and server-side tests.
const brandMarkSrc = '/images/brand/barkolink-mark.svg';
</script>

<style scoped>
.brand-mark {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--ink);
}
.brand-symbol {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: transparent;
  color: #fff;
  box-shadow: 0 8px 18px rgba(21, 101, 192, 0.2);
}
.brand-symbol img {
  display: block;
  width: 100%;
  height: 100%;
}
.brand-copy {
  display: block;
  line-height: 1;
}
.brand-copy strong {
  font-size: 18px;
  letter-spacing: -0.5px;
}
.brand-copy b {
  color: var(--ocean);
  font-size: 18px;
}
.brand-copy small {
  display: block;
  max-width: 120px;
  margin-top: 5px;
  color: var(--muted);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.3;
  text-transform: uppercase;
}
</style>
