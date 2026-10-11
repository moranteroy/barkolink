<template>
  <IonModal class="catalog-details-modal" :is-open="!!record" @didDismiss="$emit('close')">
    <div class="reference-dialog">
      <header><div><p class="eyebrow">FERRY DETAILS</p><h2>{{ record?.name || record?.code }}</h2></div><button type="button" class="dialog-close" aria-label="Close details" @click="$emit('close')"><AppIcon :icon="closeOutline" aria-hidden="true" /></button></header>
      <div class="details-content">
      <template v-if="record?.referenceMetadata?.kind === 'demo-archive'"><p>This demonstration record is retained for existing ticket history.</p></template>
      <template v-else>
        <section v-if="record?.referenceMetadata?.operators?.length"><h3>Shipping operators</h3><ul><li v-for="operator in record.referenceMetadata.operators" :key="operator">{{ operator }}</li></ul></section>
        <p v-if="record?.referenceMetadata?.operator"><strong>Shipping operator</strong><br>{{ record.referenceMetadata.operator }}</p>
        <p v-if="record?.referenceMetadata?.terminalOperator"><strong>Terminal services operator</strong><br>{{ record.referenceMetadata.terminalOperator }}</p>
        <p v-if="record?.referenceMetadata?.capacityStatus"><strong>Passenger capacity</strong><br>{{ record.referenceMetadata.publishedCapacities?.length === 1 ? `${record.referenceMetadata.publishedCapacities[0]} passengers` : 'Awaiting confirmation' }}</p>
        <p v-if="record?.referenceMetadata?.inactiveReason" role="status">{{ record.referenceMetadata.inactiveReason }}</p>
        <section v-if="record?.referenceMetadata?.schedules?.length"><h3>Daily departures</h3><ul><li v-for="schedule in record.referenceMetadata.schedules" :key="schedule.operator"><strong>{{ schedule.operator }}</strong><span>{{ schedule.departureTimes.join(' · ') }} · {{ schedule.timezone }}</span><small>Daily · confirm before scheduling</small></li></ul></section>
        <section v-if="record?.referenceMetadata?.accommodationProfiles?.length"><h3>Accommodation classes</h3><ul><li v-for="profile in record.referenceMetadata.accommodationProfiles" :key="profile.operator"><strong>{{ profile.operator }}</strong><span>{{ profile.classes.join(' · ') }}</span><small>Accommodation availability · confirm availability and class seat allocation on the assigned vessel</small></li></ul></section>
        <section v-if="record?.routes?.length"><h3>Vessel routes</h3><ul><li v-for="route in activeFirst(record.routes, route => !route.isActive)" :key="route.id"><strong>{{ route.code }}</strong><span>{{ route.origin }} → {{ route.destination }}</span><small v-if="!route.isActive">Inactive · confirm service resumption</small></li></ul></section>
        <section v-if="record?.vessels?.length"><h3>Assigned vessels</h3><ul><li v-for="v in record.vessels" :key="v.id"><strong>{{ v.name }}</strong><span>{{ v.operator }}</span></li></ul></section>
      </template>
      </div>
    </div>
  </IonModal>
</template>
<script setup lang="ts">
import { activeFirst } from '../../data/statusOrder';
import { IonModal } from '@ionic/vue';
import AppIcon from '@/components/ui/icon/AppIcon.vue';
import { closeOutline } from 'ionicons/icons';
import type { ReferenceRecord } from '@/data/ferryReferences';
defineProps<{ record: ReferenceRecord | null }>();
defineEmits<{ close: [] }>();
</script>
<style scoped>
.catalog-details-modal { --width: min(640px, calc(100vw - 32px)); --height: auto; --max-height: calc(100dvh - 48px); --border-radius: 16px; --background: var(--surface); }
.reference-dialog { display: flex; flex-direction: column; max-height: calc(100dvh - 48px); color: var(--ink); background: var(--surface); font-family: var(--ion-font-family); }
header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 24px; border-bottom: 1px solid var(--line); flex: none; }
.dialog-close { display: grid; place-items: center; width: 44px; height: 44px; flex: none; margin-left: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); color: var(--muted); cursor: pointer; }
.dialog-close .app-icon { font-size: 22px; }
.dialog-close:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
.eyebrow { margin: 0 0 6px; color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .08em; }
h2 { font-size: 20px; margin: 0; overflow-wrap: anywhere; }
.details-content { padding: 8px 24px 24px; overflow-y: auto; min-height: 0; scrollbar-width: thin; }
h3 { font-size: 13px; margin: 20px 0 10px; font-weight: 650; }
p { font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
li { display: grid; gap: 5px; font-size: 12px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); }
li span, li small { color: var(--muted); line-height: 1.5; }
@media (max-width: 600px) { header { padding: 16px; } .details-content { padding: 4px 16px 20px; } h2 { font-size: 18px; } }
</style>
