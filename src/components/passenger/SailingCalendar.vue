<template>
  <section class="sailing-calendar" aria-labelledby="schedule-calendar-heading">
    <header><span class="calendar-icon"><CalendarDays :size="20" aria-hidden="true" /></span><div><h2 id="schedule-calendar-heading">Find a sailing date</h2><p>{{ routeLabel || 'All routes' }} · Philippine time</p></div></header>
    <div class="calendar-modes" role="group" aria-label="Calendar date type"><button v-for="mode in modes" :key="mode.value" type="button" :aria-pressed="event === mode.value" @click="emit('update:event', mode.value)"><component :is="mode.value === 'departure' ? ArrowUpRight : ArrowDownLeft" :size="14" aria-hidden="true" />{{ mode.label }}</button></div>
    <div class="month-controls"><button type="button" aria-label="Previous month" :disabled="month <= today.slice(0, 7)" @click="moveMonth(-1)"><ChevronLeft :size="18" aria-hidden="true" /></button><h3 aria-live="polite">{{ monthLabel }}</h3><button type="button" aria-label="Next month" @click="moveMonth(1)"><ChevronRight :size="18" aria-hidden="true" /></button></div>
    <div class="week-labels" aria-hidden="true"><span v-for="day in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="day">{{ day }}</span></div>
    <div class="calendar-days" role="group" :aria-label="`${monthLabel} sailing dates`">
      <template v-for="(date, index) in cells" :key="date || `blank-${index}`"><span v-if="!date" aria-hidden="true"></span><button v-else type="button" :class="{ available: days.has(date), selected: date === selectedDate, today: date === today }" :disabled="date < today" :aria-pressed="date === selectedDate" :aria-current="date === today ? 'date' : undefined" :aria-label="dayLabel(date)" @click="emit('select', date)"><strong>{{ Number(date.slice(-2)) }}</strong><small v-if="days.has(date)">{{ days.get(date)!.length }}<span class="sr-only"> sailings</span></small><span v-else class="day-dot" aria-hidden="true"></span></button></template>
    </div>
    <p class="calendar-legend"><span class="legend-dot"></span>Marked days have {{ event === 'arrival' ? 'arrivals' : 'departures' }} with enough seats for your group.</p>
    <button v-if="selectedDate" type="button" class="all-dates" @click="emit('select', '')">Show all dates</button>
    <button v-if="nextDate && !cells.some(date => date && days.has(date))" type="button" class="next-date" @click="jumpToAvailable">Jump to listed date: {{ label(nextDate) }}<ArrowRight :size="14" aria-hidden="true" /></button>
    <div class="calendar-preview" aria-live="polite">
      <template v-if="selectedDate"><h3>{{ label(selectedDate) }} <span>{{ selectedSailings.length }} {{ event === 'arrival' ? 'arrivals' : 'departures' }}</span></h3><p v-if="!selectedSailings.length">No listed {{ event === 'arrival' ? 'arrivals' : 'departures' }} for this day. Choose a marked day{{ nextDate ? ' or jump to a listed date' : ', or try another route' }}.</p><button v-if="!selectedSailings.length && nextDate && cells.some(date => date && days.has(date))" type="button" class="next-date" @click="jumpToAvailable">Jump to listed date: {{ label(nextDate) }}<ArrowRight :size="14" aria-hidden="true" /></button>
        <ul v-else><li v-for="sailing in selectedSailings.slice(0, 3)" :key="sailing.code"><strong>{{ sailing.origin.city }} <ArrowRight :size="12" aria-hidden="true" /> {{ sailing.destination.city }}</strong><small>{{ sailing.vessel.name }} · {{ sailing.code }}</small><dl><div><dt>Departure</dt><dd>{{ timestamp(sailing.departureAt) }}</dd></div><div><dt>Arrival</dt><dd>{{ timestamp(sailing.arrivalAt) }}</dd></div></dl></li></ul><p v-if="selectedSailings.length > 3">Compare sailings in the results below. Departure-time filters can narrow the list.</p>
      </template>
      <p v-else>{{ days.size ? 'Choose a marked date to see its sailings and scheduled departure / arrival times.' : 'No upcoming schedules are listed for this route and passenger count. Try another route or check again later.' }}</p>
    </div>
    <p class="calendar-note">Based on published schedules. Operator updates may change times.</p>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CalendarDays, ArrowUpRight, ArrowDownLeft, ChevronLeft, ChevronRight, ArrowRight } from '@lucide/vue';
import { sailingDays, calendarMonth, type CalendarSailing, type ScheduleEvent } from '../../data/sailingCalendar';
import { philippineDateKey } from '../../data/travelDate';
const props = defineProps<{ sailings: CalendarSailing[]; selectedDate: string; event: ScheduleEvent; routeLabel: string }>();
const emit = defineEmits<{ select: [date: string]; 'update:event': [event: ScheduleEvent] }>();
const modes = [{ value: 'departure', label: 'Departures' }, { value: 'arrival', label: 'Arrivals' }] as const;
const today = philippineDateKey();
const days = computed(() => sailingDays(props.sailings, props.event));
const nextDate = computed(() => {
  const dates = [...days.value.keys()].filter(date => date >= today).sort();
  return dates.find(date => date >= (props.selectedDate || today)) || dates[0] || '';
});
const month = ref(today.slice(0, 7));
watch(() => [props.selectedDate, nextDate.value], () => {
  const date = props.selectedDate >= today ? props.selectedDate : nextDate.value || today;
  month.value = date.slice(0, 7);
}, { immediate: true });
const cells = computed(() => calendarMonth(month.value));
const monthLabel = computed(() => new Date(`${month.value}-01T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'long', year: 'numeric' }));
const selectedSailings = computed(() => days.value.get(props.selectedDate) || []);
function label(date: string) { return new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }); }
function timestamp(at: string) { return new Date(at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); }
function dayLabel(date: string) { return `${label(date)}: ${days.value.get(date)?.length || 0} ${props.event === 'arrival' ? 'arrivals' : 'departures'}`; }
function moveMonth(step: number) {
  const [year, index] = month.value.split('-').map(Number);
  const date = new Date(Date.UTC(year, index - 1 + step, 1));
  month.value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
function jumpToAvailable() { if (nextDate.value) { month.value = nextDate.value.slice(0, 7); emit('select', nextDate.value); } }
</script>
<style scoped>
.sailing-calendar { padding:17px; margin:18px 0; border:1px solid var(--line); border-radius:17px; background:var(--surface); }header { display:flex; align-items:center; gap:10px; }header h2 { margin:0; font-size:14px; }header p { margin:4px 0 0; color:var(--muted); font-size:10px; line-height:1.6; }.calendar-icon { display:grid; place-items:center; width:36px; height:36px; flex-shrink:0; border-radius:10px; color:var(--ocean); background:var(--light-blue); }
button { font:inherit; cursor:pointer; }button:disabled { opacity:.4; cursor:default; }button:focus-visible { outline:2px solid var(--ocean); outline-offset:2px; }.calendar-modes { display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:14px; padding:4px; border-radius:10px; background:var(--surface-soft); }.calendar-modes button { display:flex; align-items:center; justify-content:center; gap:6px; min-height:44px; border:0; border-radius:8px; color:var(--muted); background:transparent; font-size:11px; font-weight:650; }.calendar-modes button[aria-pressed="true"] { background:var(--light-blue); color:var(--ocean); }
.month-controls { display:flex; align-items:center; justify-content:space-between; margin:12px 0 8px; }.month-controls h3 { margin:0; font-size:14px; }.month-controls button { display:grid; place-items:center; width:44px; height:44px; border:1px solid var(--line); border-radius:10px; color:var(--ocean); background:var(--surface-soft); }
.week-labels,.calendar-days { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:3px; }.week-labels { margin-bottom:6px; text-align:center; color:var(--muted); font-size:9px; }.calendar-days button { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; min-width:0; min-height:48px; border:1px solid transparent; border-radius:9px; color:var(--muted); background:var(--surface-soft); }.calendar-days strong { font-size:12px; font-weight:550; }.calendar-days small { display:grid; place-items:center; min-width:15px; height:13px; padding:0 3px; border-radius:4px; font-size:8px; background:color-mix(in srgb,var(--ocean) 14%,transparent); }.calendar-days .available { color:var(--ocean); background:var(--light-blue); }.calendar-days .selected { border-color:var(--ocean); color:#fff; background:var(--action); }.calendar-days .selected small { background:#ffffff25; }.calendar-days .today:not(.selected) strong { text-decoration:underline; text-underline-offset:3px; }.day-dot { width:3px; height:13px; }.legend-dot { width:6px; height:6px; flex-shrink:0; border-radius:50%; background:var(--ocean); }.calendar-legend { display:flex; align-items:center; gap:6px; font-size:9px; line-height:1.7; color:var(--muted); }
.next-date { display:flex; align-items:center; justify-content:space-between; gap:7px; width:100%; min-height:44px; padding:10px; border:1px solid var(--line); border-radius:9px; background:var(--light-blue); color:var(--ocean); font-size:11px; font-weight:650; text-align:left; }
.all-dates { min-height:44px; margin-bottom:6px; padding:5px 9px; border:1px solid var(--line); border-radius:8px; color:var(--ocean); background:var(--surface-soft); font-size:10px; }
.calendar-preview { margin-top:13px; padding-top:13px; border-top:1px solid var(--line); }.calendar-preview h3 { display:flex; align-items:center; flex-wrap:wrap; gap:7px; margin:0 0 8px; font-size:12px; }.calendar-preview h3 span { color:var(--muted); font-size:10px; font-weight:400; }.calendar-preview p,.calendar-note { margin:6px 0 0; color:var(--muted); font-size:10px; line-height:1.7; }.calendar-note { font-size:9px; margin-top:12px; }ul { display:grid; gap:8px; list-style:none; padding:0; margin:0; }li { padding:11px; border:1px solid var(--line); border-radius:10px; background:var(--surface-soft); }li > strong { display:flex; align-items:center; flex-wrap:wrap; gap:5px; font-size:11px; }li > small { display:block; margin-top:4px; font-size:9px; color:var(--muted); }dl { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:10px 0 0; }dt { color:var(--muted); font-size:9px; }dd { margin:4px 0 0; font-size:10px; font-weight:600; line-height:1.6; }
@container passenger (max-width:360px) { .sailing-calendar { padding:13px 10px; }.calendar-days { gap:2px; }.calendar-days button { border-radius:7px; min-height:46px; } }
</style>
