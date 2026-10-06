<template>
  <div class="operator-contact">
    <p v-if="operatorName"><strong>{{ operatorName }}</strong></p>
    <p v-if="email"><a :href="`mailto:${email}`">{{ email }}</a></p>
    <p v-if="phone"><a :href="`tel:${phone.replace(/[^+\d]/g, '')}`">{{ phone }}</a></p>
    <p v-if="!email && !phone">For assistance, visit the terminal ticketing desk with your booking reference.</p>
  </div>
</template>
<script setup lang="ts">
const operatorName = String(import.meta.env.VITE_OPERATOR_NAME || "").trim();
const email = String(import.meta.env.VITE_SUPPORT_EMAIL || "").trim();
const phone = String(import.meta.env.VITE_SUPPORT_PHONE || "").trim();
</script>
