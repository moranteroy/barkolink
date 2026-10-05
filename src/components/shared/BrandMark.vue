<template>
  <div class="brand-mark" aria-label="BarkoLink home">
    <span class="brand-symbol"
      ><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 13l1.5-5h15L21 13"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M2.5 13h19l-1.6 4.2a1 1 0 0 1-.93.63H5.03a1 1 0 0 1-.93-.63L2.5 13Z"
          fill="currentColor"
          fill-opacity=".9"
        />
        <path
          d="M8 8V5.5M12 8V5M16 8V5.5"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
        <path
          d="M2 20c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          opacity=".7"
        /></svg
    ></span>
    <span class="brand-copy"
      ><strong>Barko</strong><b>Link</b
      ><small>Travel smarter. Sail easier.</small></span
    >
  </div>
</template>

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
  background: linear-gradient(140deg, var(--ocean), #087ea4);
  color: #fff;
  box-shadow: 0 8px 18px rgba(21, 101, 192, 0.2);
}
.brand-symbol svg {
  width: 27px;
  height: 27px;
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
