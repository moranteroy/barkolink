<template>
  <details class="published-references">
    <summary>{{ mode === 'schedules' ? 'Published daily schedules' : 'Published accommodation classes' }}</summary>
    <div class="reference-content">
      <p class="reference-intro">{{ mode === 'schedules' ? 'Operator timetables in Philippine time (Asia/Manila). Choose a date and departure to prepare a trip.' : 'Official operator classes. Confirm availability on the selected vessel, seat allocation, and extra fare before opening bookings.' }}</p>
      <div class="reference-filters">
        <label>Operator<select v-model="operator" aria-label="Operator"><option value="">All operators</option><option v-for="name in operators" :key="name">{{ name }}</option></select></label>
        <label v-if="mode === 'schedules'">Trip date<input v-model="date" type="date" :min="today" required></label>
      </div>
      <p v-if="mode === 'schedules'" class="reference-intro">Confirm departure times and vessel assignments before opening bookings.</p>
      <div class="reference-cards">
        <article v-for="item in records" :key="`${item.operator}-${item.routeCode}`">
          <strong>{{ item.operator }}</strong><h3>{{ routeLabel(item.routeCode) }}</h3>
          <template v-if="mode === 'schedules'">
            <p>Daily · Philippine time</p>
            <div class="departure-times"><Button v-for="time in item.departureTimes" :key="time" variant="outline" size="sm" :disabled="!canPlan(item.routeCode) || !date || date < today || disabled" @click="$emit('plan', { operator: item.operator, routeCode: item.routeCode, departureAt: `${date}T${time}`, durationMinutes: item.durationMinutes })">{{ displayTime(time) }}</Button></div>
            <small v-if="!canPlan(item.routeCode)">Inactive route · outside the active service area</small>
          </template>
          <template v-else><p>{{ item.classes?.join(' · ') }}</p><small>Seat allocation and extra fare: awaiting confirmation</small></template>
        </article>
      </div>
      <p v-for="[name, note] in pendingNotes" :key="name" class="reference-intro"><strong>{{ name }}:</strong> {{ note }}</p>
      <p v-if="!records.length" class="reference-intro">A fixed daily timetable or accommodation class list has not been verified for this operator.</p>
    </div>
  </details>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { Button } from '@/components/ui/button';
import catalog from '@/data/ferryReferenceCatalog.json';
export type PublishedDeparture = { operator: string; routeCode: string; routeId?: string; departureAt: string; durationMinutes: number | null };
const props = defineProps<{ mode: 'schedules' | 'classes'; ports?: Array<{ code: string; isActive: boolean }>; disabled?: boolean }>();
defineEmits<{ plan: [departure: PublishedDeparture] }>();
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const date = ref(today), operator = ref('');
const operators = [...new Set(catalog.vessels.map(v => v.operator))].sort();
type Card = { operator: string; routeCode: string; sourceId: string; published?: string | null; departureTimes?: string[]; durationMinutes: number | null; classes?: string[] };
const records = computed<Card[]>(() => {
  const all: Card[] = props.mode === 'schedules' ? catalog.schedules : catalog.accommodationProfiles.flatMap(p => p.routeCodes.map(routeCode => ({ ...p, routeCode, durationMinutes: null })));
  return all.filter(item => !operator.value || item.operator === operator.value);
});
const pendingNotes = computed(() => Object.entries(catalog.scheduleNotes).filter(([name]) => (!operator.value || operator.value === name) && (name === 'Montenegro Shipping Lines' || name === 'OceanJet')));
function canPlan(code: string) { return code.split('-').every(c => props.ports?.find(p => p.code === c)?.isActive === true) && catalog.routes.find(r => r.code === code)?.isActive === true; }
function routeLabel(code: string) { return code.split('-').map(c => catalog.ports.find(p => p.code === c)?.name || c).join(' → '); }
function displayTime(time: string) { const [h, m] = time.split(':').map(Number); return `${h! % 12 || 12}:${String(m).padStart(2, '0')} ${h! < 12 ? 'AM' : 'PM'}`; }
</script>
<style scoped>
.published-references { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; margin: 16px 0; color: var(--ink); }
summary { cursor: pointer; padding: 18px; font-weight: 600; font-size: 14px; }
.reference-content { padding: 0 18px 18px; }.reference-intro { color: var(--muted); font-size: var(--text-label); line-height: 1.6; }
.reference-filters { display: flex; flex-wrap: wrap; gap: 16px; }label { display: grid; gap: 6px; font-size: var(--text-label); max-width: 100%; }
select,input { background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 8px; padding: 9px; max-width: 100%; }
.reference-cards { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,270px),1fr)); gap: 12px; margin-top: 16px; }
article { border: 1px solid var(--line); padding: 14px; border-radius: 10px; min-width: 0; font-size: var(--text-label); }h3 { font-size: 13px; margin: 8px 0; }
.departure-times { display: flex; flex-wrap: wrap; gap: 6px; }small { display: block; color: var(--muted); margin-top: 10px; }a { display: inline-block; margin-top: 12px; color: var(--primary); }
</style>
