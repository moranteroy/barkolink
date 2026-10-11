<template><section class="landing-container cta-section"><div class="landing-cta"><span class="cta-icon"><AppIcon :icon="boatOutline" aria-hidden="true" /></span><h2>Ready to set sail?</h2><p>Find your next ferry trip and start planning your journey today.</p><RouterLink class="landing-button white" to="/trips?all=1">Book a Trip <AppIcon :icon="ticketOutline" aria-hidden="true" /></RouterLink></div></section></template>
<script setup lang="ts">
import AppIcon from "@/components/ui/icon/AppIcon.vue";
import { RouterLink } from 'vue-router';
import { ticketOutline, boatOutline } from 'ionicons/icons';
</script>
